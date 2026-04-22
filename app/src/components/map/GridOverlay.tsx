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
      const zoom = map.getZoom();
      const step = zoom >= 7 ? 1 : 2;
      const south = Math.floor(bounds.getSouth() / step) * step;
      const north = Math.ceil(bounds.getNorth() / step) * step;
      const west = Math.floor(bounds.getWest() / step) * step;
      const east = Math.ceil(bounds.getEast() / step) * step;

      for (let lat = south; lat <= north; lat += step) {
        const line = L.polyline([[lat, west], [lat, east]], {
          color: '#475569',
          weight: 1,
          opacity: 0.42,
          dashArray: '4, 6'
        });
        line.addTo(map);
        gridLines.push(line);

        if (zoom >= 7) {
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
      }

      for (let lng = west; lng <= east; lng += step) {
        const line = L.polyline([[south, lng], [north, lng]], {
          color: '#334155',
          weight: 1,
          opacity: 0.35,
          dashArray: '4, 6'
        });
        line.addTo(map);
        gridLines.push(line);

        if (zoom >= 7) {
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
