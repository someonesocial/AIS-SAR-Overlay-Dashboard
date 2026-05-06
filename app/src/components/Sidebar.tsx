import { useState } from 'react';
import { 
  Layers, 
  Filter, 
  Ship, 
  BarChart3, 
  ChevronLeft, 
  ChevronRight,
  Eye,
  EyeOff,
  Search,
  SlidersHorizontal,
  Radar,
  Satellite,
  Crosshair
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import type { MapLayer, AISShip, FilterState, Statistics, NavigationStatus, SARDetection } from '@/types';
import { shipTypeConfig, shipTypeOrder, statusLabels } from '@/data/constants';

interface SidebarProps {
  layers: MapLayer[];
  onToggleLayer: (layerId: string) => void;
  onSetLayerOpacity: (layerId: string, opacity: number) => void;
  filters: FilterState;
  onUpdateFilters: (filters: Partial<FilterState>) => void;
  ships: AISShip[];
  statistics: Statistics;
  selectedShipMMSI: string | null;
  onSelectShip: (mmsi: string | null) => void;
  sarDetections?: SARDetection[];
  darkVessels?: SARDetection[];
}

const navStatuses: NavigationStatus[] = ['underway', 'anchored', 'moored', 'restricted', 'fishing', 'sailing'];

export function Sidebar({
  layers,
  onToggleLayer,
  onSetLayerOpacity,
  filters,
  onUpdateFilters,
  ships,
  statistics,
  selectedShipMMSI,
  onSelectShip,
  sarDetections = [],
  darkVessels = []
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'layers' | 'filters' | 'ships' | 'stats'>('layers');
  
  if (collapsed) {
    return (
      <div className="w-14 app-panel border-r app-panel-border flex flex-col items-center py-4 gap-2 z-40">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-800"
          onClick={() => setCollapsed(false)}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        
        <div className="w-px h-px bg-gray-700 my-1" />
        
        {[
          { id: 'layers', icon: Layers },
          { id: 'filters', icon: Filter },
          { id: 'ships', icon: Ship },
          { id: 'stats', icon: BarChart3 }
        ].map(({ id, icon: Icon }) => (
          <Button
            key={id}
            variant="ghost"
            size="icon"
            className={`h-8 w-8 ${activeTab === id ? 'text-cyan-400 bg-cyan-400/10' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
            onClick={() => {
              setActiveTab(id as typeof activeTab);
              setCollapsed(false);
            }}
          >
            <Icon className="w-4 h-4" />
          </Button>
        ))}
      </div>
    );
  }
  
  return (
    <div className="w-72 app-panel border-r app-panel-border flex flex-col z-40">
      {/* Header */}
      <div className="h-10 border-b border-gray-800 flex items-center justify-between px-3">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {activeTab === 'layers' && 'Layers'}
          {activeTab === 'filters' && 'Filters'}
          {activeTab === 'ships' && 'Active Ships'}
          {activeTab === 'stats' && 'Statistics'}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-gray-400 hover:text-white hover:bg-gray-800"
          onClick={() => setCollapsed(true)}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {[
          { id: 'layers', icon: Layers },
          { id: 'filters', icon: Filter },
          { id: 'ships', icon: Ship },
          { id: 'stats', icon: BarChart3 }
        ].map(({ id, icon: Icon }) => (
          <button
            key={id}
            className={`flex-1 h-9 flex items-center justify-center transition-colors ${
              activeTab === id 
                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-400/5' 
                : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
            }`}
            onClick={() => setActiveTab(id as typeof activeTab)}
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}
      </div>
      
      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          {/* Layers Tab */}
          {activeTab === 'layers' && (
            <div className="space-y-3">
              {/* AIS Tracks */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={layers.find(l => l.id === 'ais')?.enabled ?? true}
                      onCheckedChange={() => onToggleLayer('ais')}
                      className="data-[state=checked]:bg-cyan-500"
                    />
                    <span className={`text-sm ${layers.find(l => l.id === 'ais')?.enabled ? 'text-white' : 'text-gray-500'}`}>
                      AIS Tracks
                    </span>
                  </div>
                  {layers.find(l => l.id === 'ais')?.enabled ? (
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-gray-600" />
                  )}
                </div>
                
                {layers.find(l => l.id === 'ais')?.enabled && (
                  <div className="pl-10 pr-2">
                    <Slider
                      value={[layers.find(l => l.id === 'ais')!.opacity * 100]}
                      onValueChange={([v]) => onSetLayerOpacity('ais', v / 100)}
                      min={10}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                    <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                      <span>Opacity</span>
                      <span>{Math.round((layers.find(l => l.id === 'ais')?.opacity ?? 0.9) * 100)}%</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* SAR Imagery */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={layers.find(l => l.id === 'sar')?.enabled ?? false}
                      onCheckedChange={() => onToggleLayer('sar')}
                      className="data-[state=checked]:bg-amber-500"
                    />
                    <div className="flex items-center gap-1.5">
                      <Satellite className="w-3.5 h-3.5 text-amber-500" />
                      <span className={`text-sm ${layers.find(l => l.id === 'sar')?.enabled ? 'text-white' : 'text-gray-500'}`}>
                        SAR Imagery
                      </span>
                    </div>
                  </div>
                  {layers.find(l => l.id === 'sar')?.enabled ? (
                    <Eye className="w-3.5 h-3.5 text-amber-400" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-gray-600" />
                  )}
                </div>
                
                {layers.find(l => l.id === 'sar')?.enabled && (
                  <div className="pl-10 pr-2">
                    <Slider
                      value={[layers.find(l => l.id === 'sar')!.opacity * 100]}
                      onValueChange={([v]) => onSetLayerOpacity('sar', v / 100)}
                      min={10}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                    <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                      <span>Opacity</span>
                      <span>{Math.round((layers.find(l => l.id === 'sar')?.opacity ?? 0.6) * 100)}%</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Ship Detection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={layers.find(l => l.id === 'detection')?.enabled ?? true}
                      onCheckedChange={() => onToggleLayer('detection')}
                      className="data-[state=checked]:bg-emerald-500"
                    />
                    <div className="flex items-center gap-1.5">
                      <Radar className="w-3.5 h-3.5 text-emerald-500" />
                      <span className={`text-sm ${layers.find(l => l.id === 'detection')?.enabled ? 'text-white' : 'text-gray-500'}`}>
                        SAR Candidates
                      </span>
                    </div>
                  </div>
                  {layers.find(l => l.id === 'detection')?.enabled ? (
                    <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-gray-600" />
                  )}
                </div>
                
                {/* Detection stats */}
                {layers.find(l => l.id === 'detection')?.enabled && (
                  <div className="pl-10 space-y-2">
                    <div className="bg-gray-800/50 rounded p-2 text-[10px]">
                      <div className="flex justify-between text-gray-400">
                        <span>SAR Candidates:</span>
                        <span className="text-amber-400">{sarDetections.length}</span>
                      </div>
                      <div className="flex justify-between text-gray-400 mt-1">
                        <span>Dark Vessels:</span>
                        <span className="text-red-400">{darkVessels.length}</span>
                      </div>
                    </div>
                    
                    <Slider
                      value={[layers.find(l => l.id === 'detection')!.opacity * 100]}
                      onValueChange={([v]) => onSetLayerOpacity('detection', v / 100)}
                      min={10}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>Opacity</span>
                      <span>{Math.round((layers.find(l => l.id === 'detection')?.opacity ?? 0.8) * 100)}%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* SAR Match Layer */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={layers.find(l => l.id === 'match')?.enabled ?? true}
                      onCheckedChange={() => onToggleLayer('match')}
                      className="data-[state=checked]:bg-red-500"
                    />
                    <div className="flex items-center gap-1.5">
                      <Crosshair className="w-3.5 h-3.5 text-red-500" />
                      <span className={`text-sm ${layers.find(l => l.id === 'match')?.enabled ? 'text-white' : 'text-gray-500'}`}>
                        SAR Match Layer
                      </span>
                    </div>
                  </div>
                  {layers.find(l => l.id === 'match')?.enabled ? (
                    <Eye className="w-3.5 h-3.5 text-red-400" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-gray-600" />
                  )}
                </div>

                {layers.find(l => l.id === 'match')?.enabled && (
                  <div className="pl-10 pr-2">
                    <Slider
                      value={[layers.find(l => l.id === 'match')!.opacity * 100]}
                      onValueChange={([v]) => onSetLayerOpacity('match', v / 100)}
                      min={10}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                    <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                      <span>Opacity</span>
                      <span>{Math.round((layers.find(l => l.id === 'match')?.opacity ?? 0.9) * 100)}%</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Heat Map */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={layers.find(l => l.id === 'heatmap')?.enabled ?? false}
                      onCheckedChange={() => onToggleLayer('heatmap')}
                      className="data-[state=checked]:bg-purple-500"
                    />
                    <span className={`text-sm ${layers.find(l => l.id === 'heatmap')?.enabled ? 'text-white' : 'text-gray-500'}`}>
                      Heat Map
                    </span>
                  </div>
                  {layers.find(l => l.id === 'heatmap')?.enabled ? (
                    <Eye className="w-3.5 h-3.5 text-purple-400" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-gray-600" />
                  )}
                </div>
              </div>
              
              {/* Grid Lines */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={layers.find(l => l.id === 'grid')?.enabled ?? false}
                      onCheckedChange={() => onToggleLayer('grid')}
                      className="data-[state=checked]:bg-gray-500"
                    />
                    <span className={`text-sm ${layers.find(l => l.id === 'grid')?.enabled ? 'text-white' : 'text-gray-500'}`}>
                      Grid Lines
                    </span>
                  </div>
                  {layers.find(l => l.id === 'grid')?.enabled ? (
                    <Eye className="w-3.5 h-3.5 text-gray-400" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-gray-600" />
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Filters Tab */}
          {activeTab === 'filters' && (
            <div className="space-y-4">
              {/* Time Range */}
              <div className="space-y-2">
                <label className="text-xs text-gray-400">Time Range</label>
                <div className="grid grid-cols-3 gap-1">
                  {(['1h', '6h', '24h', '7d', 'all'] as const).map(range => (
                    <button
                      key={range}
                      className={`px-2 py-1 text-xs rounded ${
                        filters.timeRange === range
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                      onClick={() => onUpdateFilters({ timeRange: range })}
                    >
                      {range === 'all' ? 'All' : range}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Ship Types */}
              <div className="space-y-2">
                <label className="text-xs text-gray-400">Ship Types</label>
                <div className="space-y-1">
                  {shipTypeOrder.map(type => {
                    const config = shipTypeConfig[type];
                    const isSelected = filters.shipTypes.includes(type);
                    return (
                      <button
                        key={type}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                          isSelected
                            ? 'bg-gray-800 text-white'
                            : 'text-gray-500 hover:bg-gray-800/50'
                        }`}
                        onClick={() => {
                          const newTypes = isSelected
                            ? filters.shipTypes.filter(t => t !== type)
                            : [...filters.shipTypes, type];
                          onUpdateFilters({ shipTypes: newTypes });
                        }}
                      >
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: config.color }}
                        />
                        <span className="flex-1 text-left">{config.label}</span>
                        {isSelected && <Badge variant="secondary" className="h-4 text-[10px]">✓</Badge>}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Speed Range */}
              <div className="space-y-2">
                <label className="text-xs text-gray-400">Speed (knots)</label>
                <Slider
                  value={filters.speedRange}
                  onValueChange={([min, max]) => onUpdateFilters({ speedRange: [min, max] })}
                  min={0}
                  max={30}
                  step={1}
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{filters.speedRange[0]} kn</span>
                  <span>{filters.speedRange[1]} kn</span>
                </div>
              </div>
              
              {/* Status */}
              <div className="space-y-2">
                <label className="text-xs text-gray-400">Status</label>
                <div className="flex flex-wrap gap-1">
                  {navStatuses.map(status => {
                    const isSelected = filters.statuses.includes(status);
                    return (
                      <button
                        key={status}
                        className={`px-2 py-1 text-[10px] rounded capitalize ${
                          isSelected
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                        onClick={() => {
                          const newStatuses = isSelected
                            ? filters.statuses.filter(s => s !== status)
                            : [...filters.statuses, status];
                          onUpdateFilters({ statuses: newStatuses });
                        }}
                      >
                        {statusLabels[status]}
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Search */}
              <div className="space-y-2">
                <label className="text-xs text-gray-400">Search</label>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                  <Input
                    placeholder="MMSI, name, IMO..."
                    value={filters.searchQuery}
                    onChange={e => onUpdateFilters({ searchQuery: e.target.value })}
                    className="pl-8 h-8 text-xs bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                  />
                </div>
              </div>
              
              {/* Clear Filters */}
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800"
                onClick={() => onUpdateFilters({
                  timeRange: '24h',
                  shipTypes: [],
                  speedRange: [0, 30],
                  statuses: [],
                  searchQuery: ''
                })}
              >
                <SlidersHorizontal className="w-3 h-3 mr-1" />
                Reset Filters
              </Button>
            </div>
          )}
          
          {/* Ships Tab */}
          {activeTab === 'ships' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                <span>{ships.length} vessels</span>
                <span className="text-cyan-400">{statistics.activeShips} active</span>
              </div>
              
              <div className="space-y-1">
                {ships.slice(0, 20).map(ship => {
                  const config = shipTypeConfig[ship.type];
                  const isSelected = selectedShipMMSI === ship.mmsi;
                  
                  return (
                    <button
                      key={ship.mmsi}
                      className={`w-full p-2 rounded text-left transition-all ${
                        isSelected
                          ? 'bg-cyan-500/20 border border-cyan-500/50'
                          : 'bg-gray-800/50 hover:bg-gray-800 border border-transparent'
                      }`}
                      onClick={() => onSelectShip(isSelected ? null : ship.mmsi)}
                    >
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: config.color }}
                        />
                        <span className="text-xs font-medium text-white truncate flex-1">
                          {ship.name}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {ship.speed.toFixed(1)}kn
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 pl-4">
                        <span className="text-[10px] text-gray-500">{ship.mmsi}</span>
                        <span className="text-[10px] text-gray-600">•</span>
                        <span className="text-[10px] text-gray-500">{config.label}</span>
                      </div>
                    </button>
                  );
                })}
                
                {ships.length > 20 && (
                  <p className="text-center text-xs text-gray-500 py-2">
                    +{ships.length - 20} more vessels
                  </p>
                )}
              </div>
            </div>
          )}
          
          {/* Stats Tab */}
          {activeTab === 'stats' && (
            <div className="space-y-4">
              {/* Main Stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-800/50 p-3 rounded">
                  <p className="text-[10px] text-gray-500 uppercase">AIS Ships</p>
                  <p className="text-xl font-bold text-white">{statistics.totalShips}</p>
                </div>
                <div className="bg-gray-800/50 p-3 rounded">
                  <p className="text-[10px] text-gray-500 uppercase">Active</p>
                  <p className="text-xl font-bold text-emerald-400">{statistics.activeShips}</p>
                </div>
                <div className="bg-gray-800/50 p-3 rounded">
                  <p className="text-[10px] text-gray-500 uppercase">Avg Speed</p>
                  <p className="text-xl font-bold text-cyan-400">{statistics.averageSpeed.toFixed(1)}</p>
                  <p className="text-[10px] text-gray-500">knots</p>
                </div>
                <div className="bg-gray-800/50 p-3 rounded">
                  <p className="text-[10px] text-gray-500 uppercase">Alerts</p>
                  <p className="text-xl font-bold text-red-400">{statistics.alerts}</p>
                </div>
              </div>
              
              {/* SAR Stats */}
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Satellite className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-medium text-amber-400">SAR Detection</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-gray-500">Total Detections</p>
                    <p className="text-lg font-bold text-amber-400">{sarDetections.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500">Dark Vessels</p>
                    <p className="text-lg font-bold text-red-400">{darkVessels.length}</p>
                  </div>
                </div>
              </div>
              
              {/* By Type */}
              <div className="space-y-2">
                <label className="text-xs text-gray-400">By Type</label>
                <div className="space-y-1">
                  {shipTypeOrder.map(type => {
                    const count = statistics.byType[type] || 0;
                    const config = shipTypeConfig[type];
                    const percentage = statistics.totalShips > 0 
                      ? (count / statistics.totalShips) * 100 
                      : 0;
                    
                    return (
                      <div key={type} className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: config.color }}
                        />
                        <span className="text-xs text-gray-400 w-16">{config.label}</span>
                        <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all"
                            style={{ 
                              width: `${percentage}%`,
                              backgroundColor: config.color 
                            }}
                          />
                        </div>
                        <span className="text-xs text-white w-6 text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
