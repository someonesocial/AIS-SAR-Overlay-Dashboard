import { useState, useCallback, useMemo } from 'react';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { MapView } from '@/components/MapView';
import { BottomPanel } from '@/components/BottomPanel';
import { useRealTimeAIS } from '@/hooks/useRealTimeAIS';
import { useSARDetections } from '@/hooks/useSARDetections';
import { useMapLayers } from '@/hooks/useMapLayers';
import { Toaster } from '@/components/ui/sonner';
import type { FilterState } from '@/types';

function App() {
  // Real-time AIS data
  const { 
    ships, 
    connectionStatus, 
    statusMessage 
  } = useRealTimeAIS();
  
  // SAR detections with AI
  const { 
    scenes,
    detections, 
    darkVessels, 
    comparison, 
    refresh: refreshSAR 
  } = useSARDetections(ships);
  
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
        if (!matchesName && !matchesMMSI) {
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
    
    const byType = filteredShips.reduce((acc, ship) => {
      acc[ship.type] = (acc[ship.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalShips: filteredShips.length,
      activeShips: activeShips.length,
      averageSpeed: activeShips.length > 0 ? totalSpeed / activeShips.length : 0,
      alerts: filteredShips.filter(s => s.speed > 25).length,
      byType: byType as any,
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
  
  // Refresh all data
  const refreshData = useCallback(() => {
    refreshSAR();
  }, [refreshSAR]);
  
  return (
    <div className="h-screen flex flex-col bg-[#0a0f1c] overflow-hidden">
      {/* Header */}
      <Header 
        connectionStatus={connectionStatus}
        statusMessage={statusMessage}
        onRefresh={refreshData}
        darkVesselCount={darkVessels.length}
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
        />
        
        {/* Map and Bottom Panel */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Map */}
          <div className="flex-1 relative">
            <MapView
              ships={filteredShips}
              sarScenes={scenes}
              sarDetections={detections}
              darkVessels={darkVessels}
              layers={layers}
              selectedShipMMSI={selectedShipMMSI}
              onSelectShip={selectShip}
              center={[25.0, 56.5]}
              zoom={8}
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
        position="top-right"
        toastOptions={{
          style: {
            background: '#111827',
            border: '1px solid #374151',
            color: '#f9fafb'
          }
        }}
      />
    </div>
  );
}

export default App;
