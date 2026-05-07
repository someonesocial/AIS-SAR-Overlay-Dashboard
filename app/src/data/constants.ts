import type { BoundingBox, NavigationStatus, RegionPresetId, RegionSelection } from '@/types';
export { normalizeShipType, shipTypeConfig, shipTypeOrder } from './shipTypes';

export const statusLabels: Record<NavigationStatus, string> = {
  underway: 'Underway',
  anchored: 'Anchored',
  moored: 'Moored',
  restricted: 'Restricted',
  fishing: 'Fishing',
  sailing: 'Sailing'
};

export const regionPresets: Array<{
  id: Exclude<RegionPresetId, 'custom'>;
  label: string;
  bbox: BoundingBox;
  center: [number, number];
  zoom: number;
}> = [
  {
    id: 'baltic',
    label: 'Baltic Sea',
    bbox: { minLat: 54.0, maxLat: 59.0, minLon: 10.0, maxLon: 20.0 },
    center: [55.0, 15.0],
    zoom: 8,
  },
  {
    id: 'north-sea',
    label: 'North Sea',
    bbox: { minLat: 51.0, maxLat: 61.0, minLon: -4.0, maxLon: 9.0 },
    center: [56.0, 2.5],
    zoom: 6,
  },
  {
    id: 'mediterranean',
    label: 'Mediterranean',
    bbox: { minLat: 30.0, maxLat: 46.0, minLon: -6.0, maxLon: 36.0 },
    center: [38.0, 15.0],
    zoom: 5,
  },
];

export const defaultRegion: RegionSelection = {
  presetId: 'baltic',
  bbox: regionPresets[0].bbox,
};

export function getRegionView(region: RegionSelection) {
  const preset = regionPresets.find((item) => item.id === region.presetId);
  if (preset) {
    return { center: preset.center, zoom: preset.zoom };
  }

  return {
    center: [
      (region.bbox.minLat + region.bbox.maxLat) / 2,
      (region.bbox.minLon + region.bbox.maxLon) / 2,
    ] as [number, number],
    zoom: 6,
  };
}

export function validateBoundingBox(bbox: BoundingBox): string | null {
  const values = [bbox.minLat, bbox.maxLat, bbox.minLon, bbox.maxLon];
  if (values.some((value) => !Number.isFinite(value))) {
    return 'All coordinates must be valid numbers.';
  }
  if (bbox.minLat < -90 || bbox.maxLat > 90) {
    return 'Latitude must be between -90 and 90.';
  }
  if (bbox.minLon < -180 || bbox.maxLon > 180) {
    return 'Longitude must be between -180 and 180.';
  }
  if (bbox.minLat >= bbox.maxLat) {
    return 'Min latitude must be smaller than max latitude.';
  }
  if (bbox.minLon >= bbox.maxLon) {
    return 'Min longitude must be smaller than max longitude.';
  }

  return null;
}
