export type ShipType = 'cargo' | 'tanker' | 'passenger' | 'fishing' | 'military' | 'other';
export type NavigationStatus = 'underway' | 'anchored' | 'moored' | 'restricted' | 'fishing' | 'sailing';
export type ConnectionStatus = 'online' | 'connecting' | 'offline';

export interface ShipTrackPoint {
  latitude: number;
  longitude: number;
  timestamp?: Date;
}

export interface AISShip {
  mmsi: string;
  name: string;
  type: ShipType;
  latitude: number;
  longitude: number;
  course: number;
  speed: number;
  heading: number;
  status: NavigationStatus;
  timestamp: Date;
  lastUpdate: Date;
  track?: ShipTrackPoint[];
}

export interface SARDetection {
  id: string;
  latitude: number;
  longitude: number;
  confidence: number;
  satellite: string;
  timestamp: Date;
  matchedMMSI?: string | null;
  estimatedLength?: number;
  estimatedType?: ShipType;
}

export interface SARScene {
  id: string;
  sceneName: string;
  acquisitionDate?: string;
  centerLat?: number | null;
  centerLon?: number | null;
  footprint?: string | null;
  downloadUrl?: string;
  fileSize?: number | null;
  processingLevel?: string;
  polarization?: string;
  beamMode?: string;
  browseUrl?: string | null;
}

export interface MapLayer {
  id: 'ais' | 'sar' | 'detection' | 'heatmap' | 'grid';
  label: string;
  enabled: boolean;
  opacity: number;
}

export interface FilterState {
  timeRange: '1h' | '6h' | '24h' | '7d' | 'all';
  shipTypes: ShipType[];
  speedRange: [number, number];
  statuses: NavigationStatus[];
  searchQuery: string;
}

export interface Statistics {
  totalShips: number;
  activeShips: number;
  averageSpeed: number;
  alerts: number;
  byType: Record<string, number>;
  darkVessels: number;
}
