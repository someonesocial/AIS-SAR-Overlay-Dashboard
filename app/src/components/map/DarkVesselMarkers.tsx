import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { SARDetection } from '@/types';

interface DarkVesselMarkersProps {
  vessels: SARDetection[];
  opacity?: number;
}

// Create dark vessel icon (pulsing red)
function createDarkVesselIcon(confidence: number, opacity: number): L.DivIcon {
  const size = 16 + confidence * 8;
  
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="overflow: visible;">
      <!-- Pulsing ring -->
      <circle 
        cx="${size/2}" cy="${size/2}" 
        r="${size}" 
        fill="none" 
        stroke="#ef4444" 
        stroke-width="1"
        opacity="${0.3 * opacity}"
      >
        <animate attributeName="r" from="${size}" to="${size * 2}" dur="1.5s" repeatCount="indefinite"/>
        <animate attributeName="opacity" from="${0.3 * opacity}" to="0" dur="1.5s" repeatCount="indefinite"/>
      </circle>
      
      <!-- Core marker -->
      <circle 
        cx="${size/2}" cy="${size/2}" 
        r="${size/2}" 
        fill="#ef4444"
        opacity="${opacity}"
      />
      
      <!-- Inner highlight -->
      <circle 
        cx="${size/2}" cy="${size/2}" 
        r="${size/4}" 
        fill="#fca5a5"
        opacity="${opacity}"
      />
      
      <!-- Warning triangle -->
      <text 
        x="${size/2}" y="${size/2 + 2}" 
        text-anchor="middle" 
        font-size="${size/2}"
        fill="white"
        font-weight="bold"
      >!</text>
    </svg>
  `;
  
  return L.divIcon({
    html: svg,
    className: 'dark-vessel-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

export function DarkVesselMarkers({ vessels, opacity = 0.9 }: DarkVesselMarkersProps) {
  const map = useMap();
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  
  useEffect(() => {
    const currentMarkers = markersRef.current;
    const newMarkers = new Map<string, L.Marker>();
    
    vessels.forEach(vessel => {
      const position: L.LatLngExpression = [vessel.latitude, vessel.longitude];
      
      let marker = currentMarkers.get(vessel.id);
      
      if (marker) {
        marker.setLatLng(position);
      } else {
        marker = L.marker(position, {
          icon: createDarkVesselIcon(vessel.confidence, opacity),
          zIndexOffset: 1000 // Ensure dark vessels appear on top
        });
        
        marker.bindTooltip(`
          <div class="text-xs">
            <p class="font-semibold text-red-400">🚨 DARK VESSEL DETECTED</p>
            <p class="text-gray-400 mt-1">No AIS transmission</p>
            <div class="mt-2 space-y-0.5">
              <p>Confidence: <span class="text-red-400">${(vessel.confidence * 100).toFixed(0)}%</span></p>
              <p>Satellite: ${vessel.satellite}</p>
              <p>Detected: ${new Date(vessel.timestamp).toLocaleString()}</p>
              ${(vessel as any).estimatedLength ? `<p>Est. Length: ${(vessel as any).estimatedLength.toFixed(0)}m</p>` : ''}
              ${(vessel as any).estimatedType ? `<p>Est. Type: ${(vessel as any).estimatedType}</p>` : ''}
            </div>
          </div>
        `, {
          direction: 'top',
          offset: [0, -10],
          className: 'bg-gray-900 text-white border border-red-500/50 rounded px-2 py-1'
        });
        
        marker.on('click', () => {
          // Could emit event to show details panel
          console.log('Dark vessel clicked:', vessel);
        });
        
        marker.addTo(map);
      }
      
      newMarkers.set(vessel.id, marker);
    });
    
    // Remove old markers
    currentMarkers.forEach((marker, id) => {
      if (!newMarkers.has(id)) {
        marker.remove();
      }
    });
    
    markersRef.current = newMarkers;
  }, [vessels, map, opacity]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach(marker => marker.remove());
    };
  }, []);
  
  return null;
}
