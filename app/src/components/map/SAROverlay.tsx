import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { SARDetection } from '@/types';

interface SAROverlayProps {
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

export function SAROverlay({ 
  detections, 
  opacity = 0.6, 
  showDetections = true,
  detectionOpacity = 0.8 
}: SAROverlayProps) {
  const map = useMap();
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const overlayRef = useRef<L.Rectangle | null>(null);
  const scanLineRef = useRef<L.Polyline | null>(null);
  const scanAnimationRef = useRef<number | null>(null);
  
  // Create SAR overlay area
  useEffect(() => {
    // Define SAR coverage area (Strait of Hormuz region)
    const bounds: L.LatLngBoundsLiteral = [
      [23.5, 54.5],
      [26.5, 58.5]
    ];
    
    // Create semi-transparent overlay
    const overlay = L.rectangle(bounds, {
      color: '#f59e0b',
      weight: 1,
      fillColor: '#f59e0b',
      fillOpacity: 0.05 * opacity,
      dashArray: '5, 5'
    });
    
    overlay.addTo(map);
    overlayRef.current = overlay;
    
    // Create scan line
    const scanLine = createScanLine(L.latLngBounds(bounds));
    scanLine.addTo(map);
    scanLineRef.current = scanLine;
    
    // Animate scan line
    let direction = 1;
    let currentLat = bounds[0][0];
    const minLat = bounds[0][0];
    const maxLat = bounds[1][0];
    
    const animate = () => {
      if (!scanLineRef.current) return;
      
      currentLat += 0.01 * direction;
      
      if (currentLat >= maxLat) {
        direction = -1;
      } else if (currentLat <= minLat) {
        direction = 1;
      }
      
      const newLatlngs: L.LatLngExpression[] = [
        [currentLat, bounds[0][1]],
        [currentLat, bounds[1][1]]
      ];
      
      scanLineRef.current.setLatLngs(newLatlngs);
      scanAnimationRef.current = requestAnimationFrame(animate);
    };
    
    scanAnimationRef.current = requestAnimationFrame(animate);
    
    return () => {
      overlay.remove();
      scanLine.remove();
      if (scanAnimationRef.current) {
        cancelAnimationFrame(scanAnimationRef.current);
      }
    };
  }, [map, opacity]);
  
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
