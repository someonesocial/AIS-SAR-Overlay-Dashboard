import { useState } from 'react';
import type { MapLayer } from '@/types';

const initialLayers: MapLayer[] = [
  { id: 'ais', label: 'AIS Tracks', enabled: true, opacity: 0.9 },
  { id: 'sar', label: 'SAR Imagery', enabled: true, opacity: 0.6 },
  { id: 'detection', label: 'AI Detection', enabled: true, opacity: 0.85 },
  { id: 'heatmap', label: 'Heat Map', enabled: false, opacity: 0.7 },
  { id: 'grid', label: 'Grid', enabled: false, opacity: 0.4 }
];

export function useMapLayers() {
  const [layers, setLayers] = useState<MapLayer[]>(initialLayers);

  const toggleLayer = (layerId: string) => {
    setLayers((current) =>
      current.map((layer) =>
        layer.id === layerId ? { ...layer, enabled: !layer.enabled } : layer
      )
    );
  };

  const setLayerOpacity = (layerId: string, opacity: number) => {
    setLayers((current) =>
      current.map((layer) => (layer.id === layerId ? { ...layer, opacity } : layer))
    );
  };

  return { layers, toggleLayer, setLayerOpacity };
}
