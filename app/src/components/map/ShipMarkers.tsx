import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { AISShip } from '@/types';
import { shipTypeConfig } from '@/data/constants';

interface ShipMarkersProps {
  ships: AISShip[];
  selectedMMSI: string | null;
  onSelectShip: (mmsi: string) => void;
  opacity?: number;
}

// Create ship icon SVG
function createShipIcon(type: string, course: number, isSelected: boolean, opacity: number): L.DivIcon {
  const config = shipTypeConfig[type as keyof typeof shipTypeConfig] || shipTypeConfig.other;
  const color = config.color;
  
  const size = isSelected ? 24 : 16;
  const strokeWidth = isSelected ? 2.5 : 1.5;
  
  // Triangle pointing in direction of travel
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform: rotate(${course}deg); overflow: visible;">
      <polygon 
        points="${size/2},0 ${size},${size} 0,${size}" 
        fill="${color}" 
        stroke="white" 
        stroke-width="${strokeWidth}"
        opacity="${opacity}"
      />
      ${isSelected ? `
        <circle cx="${size/2}" cy="${size/2}" r="${size}" fill="none" stroke="${color}" stroke-width="1" opacity="0.5">
          <animate attributeName="r" from="${size}" to="${size * 2}" dur="1.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" from="0.5" to="0" dur="1.5s" repeatCount="indefinite"/>
        </circle>
      ` : ''}
    </svg>
  `;
  
  return L.divIcon({
    html: svg,
    className: 'ship-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

// Create track line
function createTrackLine(track: { latitude: number; longitude: number }[]): L.Polyline {
  const latlngs = track.map(p => [p.latitude, p.longitude] as L.LatLngExpression);
  return L.polyline(latlngs, {
    color: '#06b6d4',
    weight: 1.5,
    opacity: 0.5,
    dashArray: '5, 5'
  });
}

export function ShipMarkers({ ships, selectedMMSI, onSelectShip, opacity = 0.9 }: ShipMarkersProps) {
  const map = useMap();
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const tracksRef = useRef<Map<string, L.Polyline>>(new Map());
  
  // Create/update markers
  useEffect(() => {
    const currentMarkers = markersRef.current;
    const currentTracks = tracksRef.current;
    const newMarkers = new Map<string, L.Marker>();
    const newTracks = new Map<string, L.Polyline>();
    
    ships.forEach(ship => {
      const isSelected = ship.mmsi === selectedMMSI;
      const position: L.LatLngExpression = [ship.latitude, ship.longitude];
      
      // Create or update marker
      let marker = currentMarkers.get(ship.mmsi);
      
      if (marker) {
        // Update position
        marker.setLatLng(position);
        marker.setIcon(createShipIcon(ship.type, ship.course, isSelected, opacity));
      } else {
        // Create new marker
        marker = L.marker(position, {
          icon: createShipIcon(ship.type, ship.course, isSelected, opacity)
        });
        
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectShip(ship.mmsi);
        });
        
        // Tooltip
        marker.bindTooltip(`
          <div class="text-xs">
            <p class="font-semibold">${ship.name}</p>
            <p class="text-gray-400">${ship.mmsi}</p>
            <p>${ship.speed.toFixed(1)} kn | ${ship.course.toFixed(0)}°</p>
          </div>
        `, {
          direction: 'top',
          offset: [0, -10],
          className: 'bg-gray-900 text-white border border-gray-700 rounded px-2 py-1'
        });
        
        marker.addTo(map);
      }
      
      newMarkers.set(ship.mmsi, marker);
      
      // Create or update track
      if (ship.track && ship.track.length > 1) {
        let track = currentTracks.get(ship.mmsi);
        
        if (track) {
          track.remove();
        }
        
        track = createTrackLine(ship.track);
        track.addTo(map);
        newTracks.set(ship.mmsi, track);
      }
    });
    
    // Remove markers for ships that no longer exist
    currentMarkers.forEach((marker, mmsi) => {
      if (!newMarkers.has(mmsi)) {
        marker.remove();
      }
    });
    
    // Remove tracks for ships that no longer exist
    currentTracks.forEach((track, mmsi) => {
      if (!newTracks.has(mmsi)) {
        track.remove();
      }
    });
    
    markersRef.current = newMarkers;
    tracksRef.current = newTracks;
  }, [ships, selectedMMSI, onSelectShip, map, opacity]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach(marker => marker.remove());
      tracksRef.current.forEach(track => track.remove());
    };
  }, []);
  
  return null;
}
