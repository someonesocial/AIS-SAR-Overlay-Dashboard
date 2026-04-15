import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

export function GridOverlay() {
  const map = useMap();
  
  useEffect(() => {
    const gridLines: L.Layer[] = [];

    const drawGrid = () => {
      gridLines.forEach((line) => line.remove());
      gridLines.length = 0;

      const bounds = map.getBounds();
      const south = Math.floor(bounds.getSouth());
      const north = Math.ceil(bounds.getNorth());
      const west = Math.floor(bounds.getWest());
      const east = Math.ceil(bounds.getEast());

      for (let lat = south; lat <= north; lat += 1) {
        const line = L.polyline([[lat, west], [lat, east]], {
          color: '#475569',
          weight: 1,
          opacity: 0.42,
          dashArray: '4, 6'
        });
        line.addTo(map);
        gridLines.push(line);

        const label = L.marker([lat, west], {
          icon: L.divIcon({
            className: 'grid-label',
            html: `<div style="color:#64748b;font-size:10px;padding:2px 4px;background:rgba(2,6,23,.72);border-radius:4px">${lat}°N</div>`,
            iconSize: [0, 0]
          })
        });
        label.addTo(map);
        gridLines.push(label);
      }

      for (let lng = west; lng <= east; lng += 1) {
        const line = L.polyline([[south, lng], [north, lng]], {
          color: '#334155',
          weight: 1,
          opacity: 0.35,
          dashArray: '4, 6'
        });
        line.addTo(map);
        gridLines.push(line);

        const label = L.marker([south, lng], {
          icon: L.divIcon({
            className: 'grid-label',
            html: `<div style="color:#64748b;font-size:10px;padding:2px 4px;background:rgba(2,6,23,.72);border-radius:4px">${lng}°E</div>`,
            iconSize: [0, 0]
          })
        });
        label.addTo(map);
        gridLines.push(label);
      }
    };

    drawGrid();
    map.on('moveend zoomend', drawGrid);

    return () => {
      map.off('moveend zoomend', drawGrid);
      gridLines.forEach((line) => line.remove());
    };
  }, [map]);
  
  return null;
}
