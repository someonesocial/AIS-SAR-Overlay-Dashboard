import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { SARDetection, SARScene } from '@/types';

interface SAROverlayProps {
  scenes: SARScene[];
  detections: SARDetection[];
  opacity?: number;
  showDetections?: boolean;
  detectionOpacity?: number;
}

// Create SAR detection marker
function createDetectionMarker(confidence: number, opacity: number): L.DivIcon {
  const size = 12 + confidence * 8;
  const alpha = 0.4 + confidence * 0.4;
  
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="overflow: visible;">
      <rect 
        x="0" y="0" 
        width="${size}" height="${size}" 
        fill="none" 
        stroke="#f59e0b" 
        stroke-width="1.5"
        opacity="${alpha * opacity}"
      />
      <circle 
        cx="${size/2}" cy="${size/2}" 
        r="2" 
        fill="#f59e0b"
        opacity="${opacity}"
      />
    </svg>
  `;
  
  return L.divIcon({
    html: svg,
    className: 'sar-detection-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

// Create scan line effect
function createScanLine(bounds: L.LatLngBounds): L.Polyline {
  const northEast = bounds.getNorthEast();
  const southWest = bounds.getSouthWest();
  
  // Create horizontal scan line
  const latlngs: L.LatLngExpression[] = [
    [northEast.lat, southWest.lng],
    [northEast.lat, northEast.lng]
  ];
  
  return L.polyline(latlngs, {
    color: '#f59e0b',
    weight: 2,
    opacity: 0.3,
    dashArray: '10, 5'
  });
}

function parseFootprint(footprint) {
  if (!footprint) return [];
  const matches = footprint.match(/-?\d+\.?\d*/g);
  if (!matches || matches.length < 6) return [];

  const coords = [];
  for (let i = 0; i < matches.length; i += 2) {
    const lon = Number(matches[i]);
    const lat = Number(matches[i + 1]);
    coords.push([lat, lon]);
  }
  return coords;
}

export function SAROverlay({ 
  scenes,
  detections, 
  opacity = 0.6, 
  showDetections = true,
  detectionOpacity = 0.8 
}: SAROverlayProps) {
  const map = useMap();
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const overlaysRef = useRef<L.Layer[]>([]);
  
  // Render real SAR scene footprints
  useEffect(() => {
    overlaysRef.current.forEach((layer) => layer.remove());
    overlaysRef.current = [];

    scenes.forEach((scene) => {
      const coords = parseFootprint(scene.footprint);
      if (coords.length < 3) return;

      const polygon = L.polygon(coords, {
        color: '#f59e0b',
        weight: 3,
        fillColor: '#f59e0b',
        fillOpacity: 0.14 * opacity,
        dashArray: '10, 6'
      });

      polygon.bindTooltip(`
        <div class="text-xs">
          <p class="font-semibold text-amber-400">${scene.sceneName}</p>
          <p class="text-gray-400">${scene.acquisitionDate ? new Date(scene.acquisitionDate).toLocaleString() : 'Unknown acquisition time'}</p>
          <p>${scene.processingLevel || 'SAR scene'} ${scene.polarization ? `| ${scene.polarization}` : ''}</p>
        </div>
      `, {
        direction: 'top',
        className: 'bg-gray-900 text-white border border-amber-500/50 rounded px-2 py-1'
      });

      polygon.addTo(map);
      overlaysRef.current.push(polygon);

      if (scene.centerLat && scene.centerLon) {
        const centerLabel = L.marker([scene.centerLat, scene.centerLon], {
          icon: L.divIcon({
            className: 'sar-scene-label',
            html: `<div style="padding:4px 8px;border:1px solid rgba(245,158,11,.5);background:rgba(17,24,39,.92);color:#fbbf24;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap">SAR Scene</div>`,
            iconSize: [0, 0]
          })
        });

        centerLabel.addTo(map);
        overlaysRef.current.push(centerLabel);
      }
    });

    return () => {
      overlaysRef.current.forEach((layer) => layer.remove());
      overlaysRef.current = [];
    };
  }, [map, scenes, opacity]);
  
  // Create/update detection markers
  useEffect(() => {
    if (!showDetections) {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current.clear();
      return;
    }
    
    const currentMarkers = markersRef.current;
    const newMarkers = new Map<string, L.Marker>();
    
    detections.forEach(detection => {
      const position: L.LatLngExpression = [detection.latitude, detection.longitude];
      
      let marker = currentMarkers.get(detection.id);
      
      if (marker) {
        marker.setLatLng(position);
      } else {
        marker = L.marker(position, {
          icon: createDetectionMarker(detection.confidence, detectionOpacity)
        });
        
        marker.bindTooltip(`
          <div class="text-xs">
            <p class="font-semibold text-amber-400">SAR Detection</p>
            <p class="text-gray-400">Satellite: ${detection.satellite}</p>
            <p>Confidence: ${(detection.confidence * 100).toFixed(0)}%</p>
            <p class="text-gray-500">${detection.timestamp.toLocaleString()}</p>
          </div>
        `, {
          direction: 'top',
          offset: [0, -10],
          className: 'bg-gray-900 text-white border border-amber-500/50 rounded px-2 py-1'
        });
        
        marker.addTo(map);
      }
      
      newMarkers.set(detection.id, marker);
    });
    
    // Remove old markers
    currentMarkers.forEach((marker, id) => {
      if (!newMarkers.has(id)) {
        marker.remove();
      }
    });
    
    markersRef.current = newMarkers;
    
    return () => {
      newMarkers.forEach(marker => marker.remove());
    };
  }, [detections, showDetections, map, detectionOpacity]);
  
  return null;
}
