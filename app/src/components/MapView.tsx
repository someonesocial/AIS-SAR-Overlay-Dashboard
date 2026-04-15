import { useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { AISShip, SARDetection, MapLayer } from '@/types';
import { ShipMarkers } from './map/ShipMarkers';
import { SAROverlay } from './map/SAROverlay';
import { DarkVesselMarkers } from './map/DarkVesselMarkers';
import { HeatmapLayer } from './map/HeatmapLayer';
import { GridOverlay } from './map/GridOverlay';

// Fix Leaflet default icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapViewProps {
  ships: AISShip[];
  sarDetections: SARDetection[];
  darkVessels?: SARDetection[];
  layers: MapLayer[];
  selectedShipMMSI: string | null;
  onSelectShip: (mmsi: string | null) => void;
  center?: [number, number];
  zoom?: number;
}

// Map controller component for external control
function MapController({ 
  center, 
  zoom,
  selectedShip 
}: { 
  center?: [number, number]; 
  zoom?: number;
  selectedShip?: AISShip | null;
}) {
  const map = useMap();
  const initialCenterSet = useRef(false);
  
  // Set initial view
  useEffect(() => {
    if (center && zoom && !initialCenterSet.current) {
      map.setView(center, zoom);
      initialCenterSet.current = true;
    }
  }, [map, center, zoom]);
  
  // Pan to selected ship
  useEffect(() => {
    if (selectedShip) {
      map.panTo([selectedShip.latitude, selectedShip.longitude], {
        animate: true,
        duration: 0.5
      });
    }
  }, [map, selectedShip]);
  
  return null;
}

// Map events handler
function MapEvents({ onMapClick }: { onMapClick: () => void }) {
  useMapEvents({
    click: () => {
      onMapClick();
    }
  });
  return null;
}

export function MapView({
  ships,
  sarDetections,
  darkVessels = [],
  layers,
  selectedShipMMSI,
  onSelectShip,
  center = [25.0, 56.5],
  zoom = 8
}: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  
  const handleMapClick = useCallback(() => {
    onSelectShip(null);
  }, [onSelectShip]);
  
  // Get layer states
  const aisEnabled = layers.find(l => l.id === 'ais')?.enabled ?? true;
  const sarEnabled = layers.find(l => l.id === 'sar')?.enabled ?? false;
  const detectionEnabled = layers.find(l => l.id === 'detection')?.enabled ?? true;
  const heatmapEnabled = layers.find(l => l.id === 'heatmap')?.enabled ?? false;
  const gridEnabled = layers.find(l => l.id === 'grid')?.enabled ?? false;
  
  // Get opacities
  const aisOpacity = layers.find(l => l.id === 'ais')?.opacity ?? 0.9;
  const sarOpacity = layers.find(l => l.id === 'sar')?.opacity ?? 0.6;
  const detectionOpacity = layers.find(l => l.id === 'detection')?.opacity ?? 0.8;
  
  // Get selected ship
  const selectedShip = selectedShipMMSI 
    ? ships.find(s => s.mmsi === selectedShipMMSI) 
    : null;
  
  return (
    <div className="relative flex-1 bg-[#0a0f1c]">
      <MapContainer
        ref={mapRef}
        center={center}
        zoom={zoom}
        className="w-full h-full"
        style={{ background: '#0a0f1c' }}
        zoomControl={false}
        attributionControl={true}
      >
        {/* Base Map - Dark Matter */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={19}
        />
        
        {/* Grid Overlay */}
        {gridEnabled && <GridOverlay />}
        
        {/* Heatmap Layer */}
        {heatmapEnabled && <HeatmapLayer ships={ships} />}
        
        {/* SAR Imagery Overlay */}
        {sarEnabled && (
          <SAROverlay 
            detections={sarDetections} 
            opacity={sarOpacity}
            showDetections={detectionEnabled}
            detectionOpacity={detectionOpacity}
          />
        )}
        
        {/* Dark Vessel Markers */}
        {detectionEnabled && darkVessels.length > 0 && (
          <DarkVesselMarkers
            vessels={darkVessels}
            opacity={detectionOpacity}
          />
        )}
        
        {/* AIS Ship Markers */}
        {aisEnabled && (
          <ShipMarkers
            ships={ships}
            selectedMMSI={selectedShipMMSI}
            onSelectShip={onSelectShip}
            opacity={aisOpacity}
          />
        )}
        
        {/* Map Controller */}
        <MapController 
          center={center} 
          zoom={zoom}
          selectedShip={selectedShip}
        />
        
        {/* Map Events */}
        <MapEvents onMapClick={handleMapClick} />
      </MapContainer>
      
      {/* Custom Zoom Controls */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-1 z-[400]">
        <button
          className="w-8 h-8 bg-[#111827] border border-gray-700 rounded flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          onClick={() => mapRef.current?.zoomIn()}
        >
          +
        </button>
        <button
          className="w-8 h-8 bg-[#111827] border border-gray-700 rounded flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          onClick={() => mapRef.current?.zoomOut()}
        >
          −
        </button>
      </div>
      
      {/* Scale indicator */}
      <div className="absolute bottom-6 left-6 z-[400]">
        <div className="glass-panel px-3 py-1.5 rounded text-xs text-gray-400">
          <span className="font-mono">Strait of Hormuz Region</span>
          <span className="mx-2 text-gray-600">|</span>
          <span className="font-mono text-cyan-400">{ships.length}</span>
          <span className="text-gray-500 ml-1">AIS</span>
          <span className="mx-2 text-gray-600">|</span>
          <span className="font-mono text-amber-400">{sarDetections.length}</span>
          <span className="text-gray-500 ml-1">SAR</span>
          {darkVessels.length > 0 && (
            <>
              <span className="mx-2 text-gray-600">|</span>
              <span className="font-mono text-red-500">{darkVessels.length}</span>
              <span className="text-red-400 ml-1">Dark</span>
            </>
          )}
        </div>
      </div>
      
      {/* Legend */}
      <div className="absolute top-4 right-4 z-[400]">
        <div className="glass-panel p-3 rounded-lg space-y-2">
          <p className="text-[10px] text-gray-500 uppercase font-semibold">Legend</p>
          <div className="space-y-1">
            {[
              { color: '#06b6d4', label: 'Cargo' },
              { color: '#f59e0b', label: 'Tanker' },
              { color: '#10b981', label: 'Passenger' },
              { color: '#a855f7', label: 'Fishing' },
              { color: '#ef4444', label: 'Military' }
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[10px] text-gray-400">{label}</span>
              </div>
            ))}
            {darkVessels.length > 0 && (
              <div className="flex items-center gap-2 pt-1 border-t border-gray-700">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] text-red-400">Dark Vessel</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
