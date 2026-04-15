import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

export function GridOverlay() {
  const map = useMap();
  
  useEffect(() => {
    // Create grid lines
    const gridLines: L.Polyline[] = [];
    
    // Get map bounds
    const bounds = map.getBounds();
    const south = Math.floor(bounds.getSouth());
    const north = Math.ceil(bounds.getNorth());
    const west = Math.floor(bounds.getWest());
    const east = Math.ceil(bounds.getEast());
    
    // Draw horizontal lines (latitude)
    for (let lat = south; lat <= north; lat += 1) {
      const line = L.polyline(
        [[lat, west], [lat, east]],
        {
          color: '#4b5563',
          weight: 0.5,
          opacity: 0.2,
          dashArray: '2, 4'
        }
      );
      line.addTo(map);
      gridLines.push(line);
    }
    
    // Draw vertical lines (longitude)
    for (let lng = west; lng <= east; lng += 1) {
      const line = L.polyline(
        [[south, lng], [north, lng]],
        {
          color: '#4b5563',
          weight: 0.5,
          opacity: 0.2,
          dashArray: '2, 4'
        }
      );
      line.addTo(map);
      gridLines.push(line);
    }
    
    return () => {
      gridLines.forEach(line => line.remove());
    };
  }, [map]);
  
  return null;
}
