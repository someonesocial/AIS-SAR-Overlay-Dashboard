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

function buildClipPathFromFootprint(
  coords: [number, number][],
  bounds: L.LatLngBounds,
): string | null {
  if (!coords.length) return null;

  const minLat = bounds.getSouth();
  const maxLat = bounds.getNorth();
  const minLon = bounds.getWest();
  const maxLon = bounds.getEast();

  const latRange = maxLat - minLat;
  const lonRange = maxLon - minLon;
  if (latRange <= 0 || lonRange <= 0) return null;

  const uniqueCoords = [...coords];
  if (uniqueCoords.length > 1) {
    const first = uniqueCoords[0];
    const last = uniqueCoords[uniqueCoords.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) {
      uniqueCoords.pop();
    }
  }

  const points = uniqueCoords
    .map(([lat, lon]) => {
      const x = ((lon - minLon) / lonRange) * 100;
      const y = ((maxLat - lat) / latRange) * 100;
      return `${x.toFixed(3)}% ${y.toFixed(3)}%`;
    })
    .join(', ');

  return points ? `polygon(${points})` : null;
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
  
  // Render real SAR scene footprints and image overlays
  useEffect(() => {
    overlaysRef.current.forEach((layer) => layer.remove());
    overlaysRef.current = [];

    const sortedScenes = [...scenes]
      .sort((a, b) => {
        const aTime = a.acquisitionDate ? new Date(a.acquisitionDate).getTime() : 0;
        const bTime = b.acquisitionDate ? new Date(b.acquisitionDate).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 14);

    sortedScenes.forEach((scene, index) => {
      const coords = parseFootprint(scene.footprint);
      if (coords.length < 3) return;

      const polygon = L.polygon(coords, {
        color: '#f59e0b',
        weight: 0,
        fillColor: '#f59e0b',
        fillOpacity: 0,
        opacity: 0,
        dashArray: undefined
      });

      polygon.bindTooltip(`
        <div class="text-xs">
          <p class="font-semibold text-amber-400">${scene.sceneName}</p>        
          <p class="text-gray-400">${scene.acquisitionDate ? new Date(scene.acquisitionDate).toLocaleString() : 'Unknown acquisition time'}</p>
          <p>${scene.processingLevel || 'SAR scene'} ${scene.polarization ? `| ${scene.polarization}` : ''}</p>
        </div>
      `, {
        direction: 'top',
        className: 'sar-tooltip'
      });

      polygon.addTo(map);
      overlaysRef.current.push(polygon);

      if (scene.browseUrl) {
        const overlayBounds = polygon.getBounds();
        const imageOverlay = L.imageOverlay(scene.browseUrl, overlayBounds, {
          opacity: Math.min(Math.max(opacity, 0), 1),
          interactive: false,
          className: 'leaflet-sar-image'
        });

        const clipPath = buildClipPathFromFootprint(
          coords as [number, number][],
          overlayBounds,
        );

        if (clipPath) {
          imageOverlay.once('load', () => {
            const element = imageOverlay.getElement();
            if (!element) return;
            element.style.clipPath = clipPath;
            element.style.setProperty('-webkit-clip-path', clipPath);
          });
        }

        imageOverlay.addTo(map);
        imageOverlay.setZIndex(400 + (sortedScenes.length - index));
        overlaysRef.current.push(imageOverlay);
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
          className: 'sar-tooltip'
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
  }, [detections, showDetections, map, detectionOpacity]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach(marker => marker.remove());
    };
  }, []);
  
  return null;
}
