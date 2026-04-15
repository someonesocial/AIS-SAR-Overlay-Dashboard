import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { AISShip } from '@/types';

interface HeatmapLayerProps {
  ships: AISShip[];
}

// Simple heatmap implementation using canvas
export function HeatmapLayer({ ships }: HeatmapLayerProps) {
  const map = useMap();
  const canvasRef = useRef<L.Canvas | null>(null);
  const layerRef = useRef<L.Layer | null>(null);
  
  useEffect(() => {
    // Create canvas layer
    const canvas = L.canvas({ padding: 0.5 });
    canvasRef.current = canvas;
    
    // Create custom layer
    const HeatmapLayer = L.Layer.extend({
      onAdd: function() {
        const pane = map.getPane('overlayPane');
        if (!pane) return;
        
        const canvas = L.DomUtil.create('canvas', 'leaflet-heatmap-layer');
        const size = map.getSize();
        canvas.width = size.x;
        canvas.height = size.y;
        canvas.style.position = 'absolute';
        
        this._canvas = canvas;
        this._ctx = canvas.getContext('2d');
        
        pane.appendChild(canvas);
        
        this._draw();
        
        map.on('moveend zoomend', this._draw, this);
      },
      
      onRemove: function() {
        if (this._canvas) {
          L.DomUtil.remove(this._canvas);
        }
        map.off('moveend zoomend', this._draw, this);
      },
      
      _draw: function() {
        if (!this._ctx || !this._canvas) return;
        
        const ctx = this._ctx;
        const canvas = this._canvas;
        const size = map.getSize();
        
        // Resize canvas
        canvas.width = size.x;
        canvas.height = size.y;
        
        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw heatmap points
        ships.forEach(ship => {
          const point = map.latLngToContainerPoint([ship.latitude, ship.longitude]);
          
          // Create radial gradient
          const gradient = ctx.createRadialGradient(
            point.x, point.y, 0,
            point.x, point.y, 30
          );
          
          gradient.addColorStop(0, 'rgba(6, 182, 212, 0.4)');
          gradient.addColorStop(0.5, 'rgba(6, 182, 212, 0.1)');
          gradient.addColorStop(1, 'rgba(6, 182, 212, 0)');
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 30, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    });
    
    const layer = new HeatmapLayer();
    layer.addTo(map);
    layerRef.current = layer;
    
    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
      }
    };
  }, [map, ships]);
  
  // Redraw when ships change
  useEffect(() => {
    if (layerRef.current && (layerRef.current as any)._draw) {
      (layerRef.current as any)._draw();
    }
  }, [ships]);
  
  return null;
}
