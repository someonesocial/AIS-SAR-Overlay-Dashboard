import { useMemo } from 'react';
import type { AISShip, SARDetection, SARScene, MapLayer } from '@/types';
import { shipTypeConfig } from '@/data/mockData';

interface MapViewProps {
  ships: AISShip[];
  sarScenes: SARScene[];
  sarDetections: SARDetection[];
  darkVessels?: SARDetection[];
  layers: MapLayer[];
  selectedShipMMSI: string | null;
  onSelectShip: (mmsi: string | null) => void;
  center?: [number, number];
  zoom?: number;
}

const AOI = {
  minLat: 23,
  maxLat: 27,
  minLon: 54,
  maxLon: 59
};

function project(lat: number, lon: number) {
  const x = ((lon - AOI.minLon) / (AOI.maxLon - AOI.minLon)) * 100;
  const y = ((AOI.maxLat - lat) / (AOI.maxLat - AOI.minLat)) * 100;
  return { x, y };
}

function parseFootprint(footprint?: string | null) {
  if (!footprint) return [];
  const matches = footprint.match(/-?\d+\.?\d*/g);
  if (!matches || matches.length < 6) return [];

  const coords: Array<[number, number]> = [];
  for (let i = 0; i < matches.length; i += 2) {
    coords.push([Number(matches[i + 1]), Number(matches[i])]);
  }
  return coords;
}

function StatusPanel({
  ships,
  sarScenes,
  darkVessels,
  aisEnabled,
  sarEnabled
}: {
  ships: AISShip[];
  sarScenes: SARScene[];
  darkVessels: SARDetection[];
  aisEnabled: boolean;
  sarEnabled: boolean;
}) {
  const show = (aisEnabled && ships.length === 0) || (sarEnabled && sarScenes.length === 0);
  if (!show) return null;

  return (
    <div className="absolute top-4 left-4 z-20 max-w-md">
      <div className="glass-panel rounded-xl px-4 py-3 text-sm">
        <p className="font-semibold text-white">Operational Status</p>
        {aisEnabled && ships.length === 0 && (
          <p className="mt-2 text-gray-300">
            The AIS websocket is connected, but no live ship position messages are arriving for the current key or subscription.
          </p>
        )}
        {sarEnabled && sarScenes.length === 0 && (
          <p className="mt-2 text-gray-300">
            No SAR scenes were returned for the selected area and time window.
          </p>
        )}
        <p className="mt-2 text-xs text-gray-500">
          Current counts: {ships.length} AIS ships, {sarScenes.length} SAR scenes, {darkVessels.length} dark-vessel candidates.
        </p>
      </div>
    </div>
  );
}

export function MapView({
  ships,
  sarScenes,
  sarDetections,
  darkVessels = [],
  layers,
  selectedShipMMSI,
  onSelectShip
}: MapViewProps) {
  const aisEnabled = layers.find((l) => l.id === 'ais')?.enabled ?? true;
  const sarEnabled = layers.find((l) => l.id === 'sar')?.enabled ?? true;
  const detectionEnabled = layers.find((l) => l.id === 'detection')?.enabled ?? true;
  const heatmapEnabled = layers.find((l) => l.id === 'heatmap')?.enabled ?? false;
  const gridEnabled = layers.find((l) => l.id === 'grid')?.enabled ?? true;

  const selectedShip = selectedShipMMSI ? ships.find((ship) => ship.mmsi === selectedShipMMSI) : null;

  const sceneShapes = useMemo(
    () =>
      sarScenes
        .map((scene) => ({
          scene,
          points: parseFootprint(scene.footprint)
            .map(([lat, lon]) => {
              const { x, y } = project(lat, lon);
              return `${x},${y}`;
            })
            .join(' ')
        }))
        .filter((shape) => shape.points.length > 0),
    [sarScenes]
  );

  return (
    <div className="relative flex-1 overflow-hidden bg-[#050b16]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.10),transparent_30%),linear-gradient(180deg,#08101d_0%,#050b16_100%)]" />

      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        onClick={() => onSelectShip(null)}
      >
        <defs>
          <pattern id="ops-grid-major" width="20" height="25" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 25" fill="none" stroke="rgba(51,65,85,0.85)" strokeWidth="0.3" />
          </pattern>
          <pattern id="ops-grid-minor" width="4" height="5" patternUnits="userSpaceOnUse">
            <path d="M 4 0 L 0 0 0 5" fill="none" stroke="rgba(30,41,59,0.8)" strokeWidth="0.12" />
          </pattern>
          <radialGradient id="heat-glow">
            <stop offset="0%" stopColor="rgba(168,85,247,0.32)" />
            <stop offset="100%" stopColor="rgba(168,85,247,0)" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width="100" height="100" fill="url(#ops-grid-minor)" />
        {gridEnabled && <rect x="0" y="0" width="100" height="100" fill="url(#ops-grid-major)" />}

        <rect
          x="0"
          y="0"
          width="100"
          height="100"
          fill="none"
          stroke="rgba(34,211,238,0.7)"
          strokeWidth="0.45"
          strokeDasharray="1.6 1"
        />

        <text x="1.8" y="4.4" fill="#67e8f9" fontSize="2.9" fontWeight="700">
          Strait of Hormuz Overlay
        </text>
        <text x="1.8" y="7.2" fill="#94a3b8" fontSize="2">
          Tactical AIS / SAR comparison surface
        </text>

        {gridEnabled &&
          [23, 24, 25, 26, 27].map((lat, index) => (
            <text key={`lat-${lat}`} x="1.2" y={92 - index * 25} fill="#64748b" fontSize="1.5">
              {lat}°N
            </text>
          ))}

        {gridEnabled &&
          [54, 55, 56, 57, 58, 59].map((lon, index) => (
            <text key={`lon-${lon}`} x={index * 20 + 1.5} y="98" fill="#64748b" fontSize="1.5">
              {lon}°E
            </text>
          ))}

        {heatmapEnabled &&
          ships.map((ship) => {
            const { x, y } = project(ship.latitude, ship.longitude);
            return <circle key={`heat-${ship.mmsi}`} cx={x} cy={y} r="4.5" fill="url(#heat-glow)" />;
          })}

        {sarEnabled &&
          sceneShapes.map(({ scene, points }) => (
            <g key={scene.id}>
              <polygon
                points={points}
                fill="rgba(245,158,11,0.18)"
                stroke="rgba(251,191,36,0.98)"
                strokeWidth="0.52"
                strokeDasharray="1.8 1.1"
              />
              {scene.centerLat != null && scene.centerLon != null && (
                <>
                  <circle {...project(scene.centerLat, scene.centerLon)} r="0.55" fill="#fbbf24" />
                  <text
                    x={project(scene.centerLat, scene.centerLon).x + 0.8}
                    y={project(scene.centerLat, scene.centerLon).y - 0.8}
                    fill="#fbbf24"
                    fontSize="1.7"
                    fontWeight="700"
                  >
                    SAR
                  </text>
                </>
              )}
            </g>
          ))}

        {detectionEnabled &&
          sarDetections.map((detection) => {
            const { x, y } = project(detection.latitude, detection.longitude);
            return (
              <g key={detection.id}>
                <rect
                  x={x - 0.8}
                  y={y - 0.8}
                  width="1.6"
                  height="1.6"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="0.25"
                />
              </g>
            );
          })}

        {detectionEnabled &&
          darkVessels.map((vessel) => {
            const { x, y } = project(vessel.latitude, vessel.longitude);
            return (
              <g key={vessel.id}>
                <circle cx={x} cy={y} r="1.2" fill="rgba(239,68,68,0.18)" stroke="rgba(248,113,113,0.95)" strokeWidth="0.35" />
                <circle cx={x} cy={y} r="0.35" fill="#ef4444" />
              </g>
            );
          })}

        {aisEnabled &&
          ships.map((ship) => {
            const { x, y } = project(ship.latitude, ship.longitude);
            const config = shipTypeConfig[ship.type] || shipTypeConfig.other;
            const selected = selectedShip?.mmsi === ship.mmsi;

            return (
              <g
                key={ship.mmsi}
                transform={`translate(${x},${y}) rotate(${ship.course})`}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectShip(ship.mmsi);
                }}
                style={{ cursor: 'pointer', pointerEvents: 'auto' }}
              >
                {selected && <circle cx="0" cy="0" r="2.1" fill="none" stroke={config.color} strokeWidth="0.28" opacity="0.8" />}
                <polygon
                  points="0,-1.45 1.05,1.15 -1.05,1.15"
                  fill={config.color}
                  stroke="white"
                  strokeWidth="0.22"
                />
              </g>
            );
          })}
      </svg>

      <StatusPanel
        ships={ships}
        sarScenes={sarScenes}
        darkVessels={darkVessels}
        aisEnabled={aisEnabled}
        sarEnabled={sarEnabled}
      />

      <div className="absolute bottom-6 left-6 z-20">
        <div className="glass-panel rounded px-3 py-1.5 text-xs text-gray-400">
          <span className="font-mono text-cyan-400">{ships.length}</span>
          <span className="ml-1 text-gray-500">AIS</span>
          <span className="mx-2 text-gray-600">|</span>
          <span className="font-mono text-amber-400">{sarScenes.length}</span>
          <span className="ml-1 text-gray-500">SAR scenes</span>
          <span className="mx-2 text-gray-600">|</span>
          <span className="font-mono text-red-400">{darkVessels.length}</span>
          <span className="ml-1 text-gray-500">Dark</span>
        </div>
      </div>

      <div className="absolute top-4 right-4 z-20">
        <div className="glass-panel rounded-lg p-3 space-y-2">
          <p className="text-[10px] font-semibold uppercase text-gray-500">Legend</p>
          <div className="space-y-1.5 text-[10px] text-gray-400">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-cyan-400" />
              <span>AIS Vessel</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-amber-400" />
              <span>SAR Scene</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-red-400" />
              <span>Dark Vessel</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
