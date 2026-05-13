import { useState, useCallback, useMemo, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { MapView } from '@/components/MapView';
import { BottomPanel } from '@/components/BottomPanel';
import { useRealTimeAIS } from '@/hooks/useRealTimeAIS';
import { useSARDetections } from '@/hooks/useSARDetections';
import { useMapLayers } from '@/hooks/useMapLayers';
import { Toaster } from '@/components/ui/sonner';
import { defaultRegion, getRegionView, regionPresets, validateBoundingBox, shipTypeOrder } from '@/data/constants';
import type { BoundingBox, FilterState, RegionSelection, ShipType } from '@/types';

type ThemeMode = 'light' | 'dark';

function readStoredRegion(): RegionSelection {
  try {
    const raw = localStorage.getItem('app-region');
    if (!raw) return defaultRegion;

    const parsed = JSON.parse(raw) as Partial<RegionSelection>;
    const preset = regionPresets.find((item) => item.id === parsed.presetId);
    const bbox = parsed.bbox as BoundingBox | undefined;
    if (!bbox || validateBoundingBox(bbox)) return defaultRegion;

    return {
      presetId: preset ? preset.id : 'custom',
      bbox: preset ? preset.bbox : bbox,
    };
  } catch {
    return defaultRegion;
  }
}

function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const storedTheme = localStorage.getItem('app-theme');
    if (storedTheme === 'light' || storedTheme === 'dark') {
      return storedTheme;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('app-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const [region, setRegion] = useState<RegionSelection>(readStoredRegion);
  const regionView = useMemo(() => getRegionView(region), [region]);

  useEffect(() => {
    localStorage.setItem('app-region', JSON.stringify(region));
  }, [region]);

  // Real-time AIS data
  const { 
    ships, 
    connectionStatus, 
    statusMessage 
  } = useRealTimeAIS(region.bbox);
  
  // SAR detections with AI
  const { 
    scenes,
    detections, 
    darkVessels, 
    comparison, 
    refresh: refreshSAR 
  } = useSARDetections(ships, region.bbox);
  
  // Map layers
  const {
    layers,
    toggleLayer,
    setLayerOpacity
  } = useMapLayers();
  
  // Filters
  const [filters, setFilters] = useState<FilterState>({
    timeRange: '24h',
    shipTypes: [],
    speedRange: [0, 30],
    statuses: [],
    searchQuery: ''
  });
  
  // Selected ship
  const [selectedShipMMSI, setSelectedShipMMSI] = useState<string | null>(null);

  // Filter ships
  const filteredShips = useMemo(() => {
    return ships.filter(ship => {
      // Ship type filter
      if (filters.shipTypes.length > 0 && !filters.shipTypes.includes(ship.type)) {
        return false;
      }
      
      // Speed filter
      if (ship.speed < filters.speedRange[0] || ship.speed > filters.speedRange[1]) {
        return false;
      }
      
      // Status filter
      if (filters.statuses.length > 0 && !filters.statuses.includes(ship.status)) {
        return false;
      }
      
      // Search query
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const matchesName = ship.name.toLowerCase().includes(query);
        const matchesMMSI = ship.mmsi.includes(query);
        const matchesIMO = (ship.imo || '').includes(query);
        if (!matchesName && !matchesMMSI && !matchesIMO) {
          return false;
        }
      }
      
      return true;
    });
  }, [ships, filters]);
  
  // Statistics
  const statistics = useMemo(() => {
    const activeShips = filteredShips.filter(s => s.status === 'underway');
    const totalSpeed = activeShips.reduce((sum, s) => sum + s.speed, 0);
    
    // Ensure a stable set of keys (including zero counts) so charts remain stable
    const byType = shipTypeOrder.reduce((acc, t) => {
      acc[t] = 0;
      return acc;
    }, {} as Record<string, number>);
    for (const ship of filteredShips) {
      const t = ship.type || 'other';
      byType[t] = (byType[t] || 0) + 1;
    }
    
    return {
      totalShips: filteredShips.length,
      activeShips: activeShips.length,
      averageSpeed: activeShips.length > 0 ? totalSpeed / activeShips.length : 0,
      alerts: filteredShips.filter(s => s.speed > 25).length,
      byType: byType as Record<ShipType, number>,
      darkVessels: darkVessels.length
    };
  }, [filteredShips, darkVessels]);
  
  // Selected ship
  const selectedShip = selectedShipMMSI 
    ? ships.find(s => s.mmsi === selectedShipMMSI) 
    : null;
  
  // Update filters
  const updateFilters = useCallback((newFilters: Partial<FilterState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  }, []);
  
  // Select ship
  const selectShip = useCallback((mmsi: string | null) => {
    setSelectedShipMMSI(mmsi);
  }, []);

  const updateRegion = useCallback((nextRegion: RegionSelection) => {
    setSelectedShipMMSI(null);
    setRegion(nextRegion);
  }, []);
  
  // Refresh all data
  const refreshData = useCallback(() => {
    refreshSAR();
  }, [refreshSAR]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);
  
  return (
    <div className={`h-screen flex flex-col overflow-hidden app-shell theme-${theme}`}>
      {/* Header */}
      <Header 
        connectionStatus={connectionStatus}
        statusMessage={statusMessage}
        onRefresh={refreshData}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          layers={layers}
          onToggleLayer={toggleLayer}
          onSetLayerOpacity={setLayerOpacity}
          filters={filters}
          onUpdateFilters={updateFilters}
          ships={filteredShips}
          statistics={statistics}
          selectedShipMMSI={selectedShipMMSI}
          onSelectShip={selectShip}
          sarDetections={detections}
          darkVessels={darkVessels}
          region={region}
          onSetRegion={updateRegion}
        />
        
        {/* Map and Bottom Panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Map */}
          <div className="flex-1 relative">
            <MapView
              key={`${region.bbox.minLat}-${region.bbox.maxLat}-${region.bbox.minLon}-${region.bbox.maxLon}`}
              ships={filteredShips}
              sarScenes={scenes}
              sarDetections={detections}
              darkVessels={darkVessels}
              layers={layers}
              selectedShipMMSI={selectedShipMMSI}
              onSelectShip={selectShip}
              center={regionView.center}
              zoom={regionView.zoom}
              theme={theme}
            />
          </div>
          
          {/* Bottom Panel */}
          <BottomPanel
            ships={filteredShips}
            sarDetections={detections}
            darkVessels={darkVessels}
            selectedShip={selectedShip || null}
            statistics={statistics}
            comparison={comparison}
            onSelectShip={selectShip}
          />
        </div>
        
      </div>
      
      {/* Toast notifications */}
      <Toaster 
        theme={theme}
        position="top-right"
        toastOptions={{
          style: {
            background: theme === 'dark' ? '#111827' : '#f8fafc',
            border: theme === 'dark' ? '1px solid #374151' : '1px solid #cbd5e1',
            color: theme === 'dark' ? '#f9fafb' : '#0f172a'
          }
        }}
      />
    </div>
  );
}

export default App;
