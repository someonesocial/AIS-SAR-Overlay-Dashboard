import { useEffect, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { AISShip } from '@/types';

interface HeatmapLayerProps {
  ships: AISShip[];
}

interface HeatmapCanvasLayer extends L.Layer {
  _ctx?: CanvasRenderingContext2D | null;
  _canvas?: HTMLCanvasElement | null;
}

// Simple heatmap implementation using canvas with throttling
export function HeatmapLayer({ ships }: HeatmapLayerProps) {
  const map = useMap();
  const layerRef = useRef<HeatmapCanvasLayer | null>(null);
  const lastDrawTimeRef = useRef<number>(0);
  const pendingDrawRef = useRef<boolean>(false);
  const moveHandlerRef = useRef<(() => void) | null>(null);
  const zoomHandlerRef = useRef<(() => void) | null>(null);
  const shipsRef = useRef<AISShip[]>([]);
  
  // Keep the latest ship list available to the drawing routine.
  useEffect(() => {
    shipsRef.current = ships;
  }, [ships]);
  
  const draw = useCallback(() => {
    const layer = layerRef.current;
    if (!layer?._ctx || !layer?._canvas) return;

    const { _ctx: ctx, _canvas: canvas } = layer;
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
    let layerInstance: HeatmapCanvasLayer | null = null;
    const HeatmapLayerImpl = L.Layer.extend({
      onAdd() {
        const pane = map.getPane('overlayPane');
        if (!pane) return;

        const layer = layerInstance;
        if (!layer) return;
        
        const canvas = L.DomUtil.create('canvas', 'leaflet-heatmap-layer');
        canvas.style.position = 'absolute';
        
        layer._canvas = canvas;
        layer._ctx = canvas.getContext('2d');
        
        pane.appendChild(canvas);
        
        draw();
        
        const handleMoveEnd = () => throttledDraw();
        const handleZoomEnd = () => throttledDraw();
        moveHandlerRef.current = handleMoveEnd;
        zoomHandlerRef.current = handleZoomEnd;
        map.on('moveend', handleMoveEnd);
        map.on('zoomend', handleZoomEnd);
      },
      
      onRemove() {
        const layer = layerInstance;
        if (layer?._canvas) {
          L.DomUtil.remove(layer._canvas);
        }
        if (moveHandlerRef.current) {
          map.off('moveend', moveHandlerRef.current);
        }
        if (zoomHandlerRef.current) {
          map.off('zoomend', zoomHandlerRef.current);
        }
      }
    });
    
    const layer = new (HeatmapLayerImpl as unknown as { new (): HeatmapCanvasLayer })();
    layerInstance = layer;
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
