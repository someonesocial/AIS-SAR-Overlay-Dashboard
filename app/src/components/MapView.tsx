import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import type { AISShip, SARDetection, SARScene, MapLayer } from '@/types';
import { ShipMarkers } from './map/ShipMarkers';
import { SAROverlay } from './map/SAROverlay';
import { DarkVesselMarkers } from './map/DarkVesselMarkers';
import { HeatmapLayer } from './map/HeatmapLayer';
import { GridOverlay } from './map/GridOverlay';
import { MIN_SAR_DETECTION_ZOOM } from '@/lib/sarRecognition';

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
  theme: 'light' | 'dark';
  onZoomChange?: (zoom: number) => void;
  currentZoom?: number;
}

function StatusPanel({
  ships,
  sarScenes,
  darkVessels,
  aisEnabled,
  sarEnabled,
  currentZoom,
}: {
  ships: AISShip[];
  sarScenes: SARScene[];
  darkVessels: SARDetection[];
  aisEnabled: boolean;
  sarEnabled: boolean;
  currentZoom: number;
}) {
  const show = (aisEnabled && ships.length === 0) || (sarEnabled && sarScenes.length === 0);
  if (!show) return null;

  return (
    <div className="absolute top-4 left-4 z-[1000] max-w-md pointer-events-none">
      <div className="glass-panel map-overlay-panel rounded-xl px-4 py-3 text-sm shadow-lg">
        <p className="font-semibold app-text">Operational Status</p>
        {aisEnabled && ships.length === 0 && (
          <p className="mt-2 app-muted">
            The AIS websocket is connected, but no live ship position messages are arriving for the current key or subscription.
          </p>
        )}
        {sarEnabled && sarScenes.length === 0 && (
          <p className="mt-2 app-muted">
            No SAR scenes were returned for the selected area and time window.
          </p>
        )}
        <p className="mt-2 text-xs app-muted">
          Current counts: {ships.length} AIS ships, {sarScenes.length} SAR scenes, {darkVessels.length} dark-vessel candidates.
        </p>
        {currentZoom < MIN_SAR_DETECTION_ZOOM && (
          <p className="mt-2 text-xs text-amber-300">
            SAR target recognition is hidden until zoom level {MIN_SAR_DETECTION_ZOOM} or higher.
          </p>
        )}
      </div>
    </div>
  );
}

// Keep the map on the default location until real data arrives.
function DefaultView({ center, zoom }: { center?: [number, number]; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (center && zoom) {
      map.setView(center, zoom);
    }
  }, [map, center?.[0], center?.[1], zoom]); // explicitly depend on primitives!
  return null;
}

// Fit the map once to all currently visible ships so users can zoom from a shared view.
function FitShipsToView({ ships }: { ships: AISShip[] }) {
  const map = useMap();
  const hasFittedRef = useRef(false);

  useEffect(() => {
    if (hasFittedRef.current || ships.length === 0) {
      return;
    }

    const bounds = L.latLngBounds(
      ships.map((ship) => [ship.latitude, ship.longitude] as L.LatLngExpression)
    );

    if (!bounds.isValid()) return;

    if (ships.length === 1) {
      map.setView(bounds.getCenter(), Math.max(map.getZoom(), 7));
    } else {
      map.fitBounds(bounds.pad(0.2), {
        padding: [40, 40],
        maxZoom: 8
      });
    }

    hasFittedRef.current = true;
  }, [map, ships]);

  return null;
}

// Click handler for map to reset selected ship
function MapEvents({ onSelectShip }: { onSelectShip: (mmsi: string | null) => void }) {
  const map = useMap();
  useEffect(() => {
    const handler = () => onSelectShip(null);
    map.on('click', handler);
    return () => { map.off('click', handler); };
  }, [map, onSelectShip]);
  return null;
}

function ZoomReporter({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMap();

  useEffect(() => {
    const reportZoom = () => onZoomChange(map.getZoom());
    reportZoom();
    map.on('zoomend', reportZoom);
    map.on('moveend', reportZoom);
    return () => {
      map.off('zoomend', reportZoom);
      map.off('moveend', reportZoom);
    };
  }, [map, onZoomChange]);

  return null;
}

export function MapView({
  ships,
  sarScenes,
  sarDetections,
  darkVessels = [],
  layers,
  selectedShipMMSI,
  onSelectShip,
  center = [55.0, 15.0],
  zoom = 6,
  theme,
  onZoomChange,
  currentZoom = zoom
}: MapViewProps) {
  const aisLayer = layers.find((l) => l.id === 'ais');
  const aisEnabled = aisLayer?.enabled ?? true;
  const aisOpacity = aisLayer?.opacity ?? 1;

  const sarLayer = layers.find((l) => l.id === 'sar');
  const sarEnabled = sarLayer?.enabled ?? true;
  const sarOpacity = sarLayer?.opacity ?? 1;

  const detectionLayer = layers.find((l) => l.id === 'detection');
  const detectionEnabled = detectionLayer?.enabled ?? true;
  const detectionOpacity = detectionLayer?.opacity ?? 1;

  const matchLayer = layers.find((l) => l.id === 'match');
  const matchEnabled = matchLayer?.enabled ?? true;
  const matchOpacity = matchLayer?.opacity ?? 0.9;

  const heatmapLayer = layers.find((l) => l.id === 'heatmap');
  const heatmapEnabled = heatmapLayer?.enabled ?? false;

  const gridLayer = layers.find((l) => l.id === 'grid');
  const gridEnabled = gridLayer?.enabled ?? true;

  const mapTileUrl =
    theme === 'dark'
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

  return (
    <div className="relative flex-1 overflow-hidden h-full w-full app-map-surface">
      <MapContainer
        zoom={zoom}
        center={center}
        className="h-full w-full focus:outline-none"
        zoomControl={false}
        attributionControl={false}
        preferCanvas
      >
        <MapEvents onSelectShip={onSelectShip} />
        {onZoomChange && <ZoomReporter onZoomChange={onZoomChange} />}
        <ZoomControl position="bottomright" />
        
        <TileLayer
          url={mapTileUrl}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        <DefaultView center={center} zoom={zoom} />
        <FitShipsToView ships={ships} />

        {gridEnabled && <GridOverlay />}
        
        {heatmapEnabled && <HeatmapLayer ships={ships} />}
        
        {sarEnabled && (
          <SAROverlay 
            scenes={sarScenes} 
            detections={sarDetections} 
            opacity={sarOpacity} 
            showDetections={detectionEnabled}
            detectionOpacity={detectionOpacity}
          />
        )}
        
        {matchEnabled && <DarkVesselMarkers vessels={darkVessels} opacity={matchOpacity} />}
        
        {aisEnabled && (
          <ShipMarkers 
            ships={ships} 
            selectedMMSI={selectedShipMMSI} 
            onSelectShip={onSelectShip}
            opacity={aisOpacity}
          />
        )}
      </MapContainer>

      <StatusPanel
        ships={ships}
        sarScenes={sarScenes}
        darkVessels={darkVessels}
        aisEnabled={aisEnabled}
        sarEnabled={sarEnabled}
        currentZoom={currentZoom}
      />

      <div className="absolute bottom-6 left-6 z-[1000] pointer-events-none">
        <div className="glass-panel map-overlay-panel rounded px-3 py-1.5 text-xs app-muted shadow-lg">
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

      <div className="absolute top-4 right-4 z-[1000] pointer-events-none">
        <div className="glass-panel map-overlay-panel rounded-lg p-3 space-y-2 shadow-lg">
          <p className="text-[10px] font-semibold uppercase app-muted">Legend</p>
          <div className="space-y-1.5 text-[10px] app-muted">
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
