import { useEffect, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { AISShip } from '@/types';

interface HeatmapLayerProps {
  ships: AISShip[];
}

// Simple heatmap implementation using canvas with throttling
export function HeatmapLayer({ ships }: HeatmapLayerProps) {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);
  const lastDrawTimeRef = useRef<number>(0);
  const pendingDrawRef = useRef<boolean>(false);
  const shipsRef = useRef<AISShip[]>([]);
  
  // Update ships reference without triggering redraws immediately
  shipsRef.current = ships;
  
  const draw = useCallback(() => {
    const layer = layerRef.current as any;
    if (!layer?._ctx || !layer?._canvas) return;
    
    const ctx = layer._ctx;
    const canvas = layer._canvas;
    const size = map.getSize();
    
    // Resize canvas
    canvas.width = size.x;
    canvas.height = size.y;
    
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw heatmap points - use ref to avoid stale closure
    shipsRef.current.forEach(ship => {
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
    
    lastDrawTimeRef.current = Date.now();
    pendingDrawRef.current = false;
  }, [map]);
  
  // Throttled redraw (max 10fps = 100ms)
  const throttledDraw = useCallback(() => {
    const now = Date.now();
    if (now - lastDrawTimeRef.current > 100) {
      draw();
    } else if (!pendingDrawRef.current) {
      pendingDrawRef.current = true;
      setTimeout(() => draw(), 100);
    }
  }, [draw]);
  
  useEffect(() => {
    // Create custom layer
    const HeatmapLayer = L.Layer.extend({
      onAdd: function() {
        const pane = map.getPane('overlayPane');
        if (!pane) return;
        
        const canvas = L.DomUtil.create('canvas', 'leaflet-heatmap-layer');
        canvas.style.position = 'absolute';
        
        this._canvas = canvas;
        this._ctx = canvas.getContext('2d');
        
        pane.appendChild(canvas);
        
        draw();
        
        map.on('moveend', () => throttledDraw(), this);
        map.on('zoomend', () => throttledDraw(), this);
      },
      
      onRemove: function() {
        if (this._canvas) {
          L.DomUtil.remove(this._canvas);
        }
        map.off('moveend zoomend', throttledDraw, this);
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
  }, [map, draw, throttledDraw]);
  
  // Redraw when ships change with throttling
  useEffect(() => {
    throttledDraw();
  }, [ships, throttledDraw]);
  
  return null;
}
