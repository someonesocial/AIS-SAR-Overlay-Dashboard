import { useState } from 'react';
import { 
  List, 
  Info, 
  BarChart3, 
  ChevronDown, 
  ChevronUp,
  MapPin,
  Radar,
  AlertTriangle,
  Satellite,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AISShip, SARDetection, Statistics } from '@/types';
import { shipTypeConfig, statusLabels } from '@/data/mockData';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface BottomPanelProps {
  ships: AISShip[];
  sarDetections: SARDetection[];
  darkVessels: SARDetection[];
  selectedShip: AISShip | null;
  statistics: Statistics;
  comparison: {
    totalAIS: number;
    totalSARDetections: number;
    matched: number;
    darkVessels: number;
    aisWithoutSAR: number;
  } | null;
  onSelectShip: (mmsi: string | null) => void;
}

export function BottomPanel({ 
  ships, 
  sarDetections, 
  darkVessels,
  selectedShip, 
  statistics,
  comparison,
  onSelectShip 
}: BottomPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  
  if (collapsed) {
    return (
      <div className="h-8 bg-[#111827] border-t border-gray-800 flex items-center justify-between px-4 z-30">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="text-cyan-400">{ships.length} AIS</span>
          <span>|</span>
          <span className="text-amber-400">{sarDetections.length} SAR</span>
          {darkVessels.length > 0 && (
            <>
              <span>|</span>
              <span className="text-red-400">{darkVessels.length} Dark</span>
            </>
          )}
          {selectedShip && (
            <>
              <span>|</span>
              <span className="text-white">Selected: {selectedShip.name}</span>
            </>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-gray-400 hover:text-white"
          onClick={() => setCollapsed(false)}
        >
          <ChevronUp className="w-4 h-4" />
        </Button>
      </div>
    );
  }
  
  // Prepare chart data
  const typeChartData = Object.entries(statistics.byType).map(([type, count]) => ({
    name: shipTypeConfig[type as keyof typeof shipTypeConfig]?.label || type,
    value: count,
    color: shipTypeConfig[type as keyof typeof shipTypeConfig]?.color || '#6b7280'
  }));
  
  const speedDistribution = [
    { range: '0-5 kn', count: ships.filter(s => s.speed >= 0 && s.speed < 5).length },
    { range: '5-10 kn', count: ships.filter(s => s.speed >= 5 && s.speed < 10).length },
    { range: '10-15 kn', count: ships.filter(s => s.speed >= 10 && s.speed < 15).length },
    { range: '15-20 kn', count: ships.filter(s => s.speed >= 15 && s.speed < 20).length },
    { range: '20+ kn', count: ships.filter(s => s.speed >= 20).length }
  ];
  
  return (
    <div className="h-64 bg-[#111827] border-t border-gray-800 flex flex-col z-30">
      {/* Header */}
      <div className="h-9 border-b border-gray-800 flex items-center justify-between px-3">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="h-8 bg-transparent border-0 p-0 gap-1">
            <TabsTrigger 
              value="list" 
              className="h-7 px-3 text-xs data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400"
            >
              <List className="w-3.5 h-3.5 mr-1" />
              Ship List
            </TabsTrigger>
            <TabsTrigger 
              value="details" 
              className="h-7 px-3 text-xs data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400"
              disabled={!selectedShip}
            >
              <Info className="w-3.5 h-3.5 mr-1" />
              Details
            </TabsTrigger>
            <TabsTrigger 
              value="comparison" 
              className="h-7 px-3 text-xs data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400"
            >
              <Satellite className="w-3.5 h-3.5 mr-1" />
              AIS vs SAR
            </TabsTrigger>
            <TabsTrigger 
              value="analytics" 
              className="h-7 px-3 text-xs data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400"
            >
              <BarChart3 className="w-3.5 h-3.5 mr-1" />
              Analytics
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-gray-400 hover:text-white"
          onClick={() => setCollapsed(true)}
        >
          <ChevronDown className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} className="h-full">
          {/* Ship List */}
          <TabsContent value="list" className="h-full m-0">
            <ScrollArea className="h-full">
              <table className="w-full text-xs">
                <thead className="bg-gray-800/50 sticky top-0">
                  <tr>
                    <th className="text-left py-2 px-3 text-gray-400 font-medium">MMSI</th>
                    <th className="text-left py-2 px-3 text-gray-400 font-medium">Name</th>
                    <th className="text-left py-2 px-3 text-gray-400 font-medium">Type</th>
                    <th className="text-left py-2 px-3 text-gray-400 font-medium">Speed</th>
                    <th className="text-left py-2 px-3 text-gray-400 font-medium">Course</th>
                    <th className="text-left py-2 px-3 text-gray-400 font-medium">Status</th>
                    <th className="text-left py-2 px-3 text-gray-400 font-medium">SAR Match</th>
                  </tr>
                </thead>
                <tbody>
                  {ships.map((ship, index) => {
                    const config = shipTypeConfig[ship.type];
                    const isSelected = selectedShip?.mmsi === ship.mmsi;
                    
                    // Check if this ship has a SAR detection match
                    const sarMatch = sarDetections.find(d => d.matchedMMSI === ship.mmsi);
                    
                    return (
                      <tr 
                        key={ship.mmsi}
                        className={`border-b border-gray-800/50 cursor-pointer transition-colors ${
                          isSelected ? 'bg-cyan-500/10' : index % 2 === 0 ? 'bg-gray-900/30' : ''
                        } hover:bg-gray-800/50`}
                        onClick={() => onSelectShip(ship.mmsi)}
                      >
                        <td className="py-2 px-3 font-mono text-gray-500">{ship.mmsi}</td>
                        <td className="py-2 px-3 text-white font-medium">{ship.name}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <div 
                              className="w-2 h-2 rounded-full" 
                              style={{ backgroundColor: config.color }}
                            />
                            <span className="text-gray-400">{config.label}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3 font-mono text-cyan-400">
                          {ship.speed.toFixed(1)} kn
                        </td>
                        <td className="py-2 px-3 font-mono text-gray-400">
                          {ship.course.toFixed(0)}deg
                        </td>
                        <td className="py-2 px-3">
                          <Badge 
                            variant="secondary" 
                            className={`text-[10px] ${
                              ship.status === 'underway' 
                                ? 'bg-emerald-500/20 text-emerald-400' 
                                : 'bg-gray-700 text-gray-400'
                            }`}
                          >
                            {statusLabels[ship.status]}
                          </Badge>
                        </td>
                        <td className="py-2 px-3">
                          {sarMatch ? (
                            <div className="flex items-center gap-1 text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span className="text-[10px]">{(sarMatch.confidence * 100).toFixed(0)}%</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-gray-600">
                              <XCircle className="w-3.5 h-3.5" />
                              <span className="text-[10px]">No match</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollArea>
          </TabsContent>
          
          {/* Ship Details */}
          <TabsContent value="details" className="h-full m-0 p-4">
            {selectedShip ? (
              <div className="grid grid-cols-4 gap-4 h-full">
                {/* Vessel Info */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-2">
                    <ShipIcon className="w-3.5 h-3.5" />
                    Vessel Information
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Name</span>
                      <span className="text-white font-medium">{selectedShip.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">MMSI</span>
                      <span className="font-mono text-gray-400">{selectedShip.mmsi}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Type</span>
                      <span className="text-gray-300">{shipTypeConfig[selectedShip.type].label}</span>
                    </div>
                  </div>
                </div>
                
                {/* Current Position */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5" />
                    Current Position
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Latitude</span>
                      <span className="font-mono text-cyan-400">{selectedShip.latitude.toFixed(6)}deg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Longitude</span>
                      <span className="font-mono text-cyan-400">{selectedShip.longitude.toFixed(6)}deg</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Speed</span>
                      <span className="font-mono text-emerald-400">{selectedShip.speed.toFixed(1)} kn</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Course</span>
                      <span className="font-mono text-gray-300">{selectedShip.course.toFixed(0)}deg</span>
                    </div>
                  </div>
                </div>
                
                {/* SAR Detection */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-2">
                    <Radar className="w-3.5 h-3.5" />
                    SAR Detection
                  </h4>
                  {(() => {
                    const sarMatch = sarDetections.find(d => d.matchedMMSI === selectedShip.mmsi);
                    return sarMatch ? (
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Status</span>
                          <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">
                            Detected
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Confidence</span>
                          <span className="font-mono text-emerald-400">{(sarMatch.confidence * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Satellite</span>
                          <span className="text-gray-300">{sarMatch.satellite}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Detected</span>
                          <span className="text-gray-400">{new Date(sarMatch.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <XCircle className="w-6 h-6 mx-auto mb-1 text-gray-600" />
                        <p className="text-xs text-gray-500">No SAR detection</p>
                        <p className="text-[10px] text-gray-600 mt-1">
                          Vessel not visible in recent SAR imagery
                        </p>
                      </div>
                    );
                  })()}
                </div>
                
                {/* Detection Sources */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase flex items-center gap-2">
                    <Satellite className="w-3.5 h-3.5" />
                    Detection Sources
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-cyan-400" />
                      <span className="text-gray-400">AIS Transponder</span>
                      <span className="text-gray-600 ml-auto">{selectedShip.lastUpdate.toLocaleTimeString()}</span>
                    </div>
                    {sarDetections.find(d => d.matchedMMSI === selectedShip.mmsi) && (
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-400" />
                        <span className="text-gray-400">SAR Satellite</span>
                        <span className="text-emerald-400 ml-auto">Verified</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <ShipIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Select a ship to view details</p>
                </div>
              </div>
            )}
          </TabsContent>
          
          {/* AIS vs SAR Comparison */}
          <TabsContent value="comparison" className="h-full m-0 p-4">
            {comparison ? (
              <div className="grid grid-cols-5 gap-4 h-full">
                {/* Summary Cards */}
                <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ShipIcon className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs text-cyan-400 uppercase">AIS Ships</span>
                  </div>
                  <p className="text-3xl font-bold text-white">{comparison.totalAIS}</p>
                  <p className="text-[10px] text-gray-500 mt-1">Vessels transmitting AIS</p>
                </div>
                
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Radar className="w-4 h-4 text-amber-400" />
                    <span className="text-xs text-amber-400 uppercase">SAR Detections</span>
                  </div>
                  <p className="text-3xl font-bold text-white">{comparison.totalSARDetections}</p>
                  <p className="text-[10px] text-gray-500 mt-1">AI-detected vessels in SAR</p>
                </div>
                
                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-emerald-400 uppercase">Matched</span>
                  </div>
                  <p className="text-3xl font-bold text-white">{comparison.matched}</p>
                  <p className="text-[10px] text-gray-500 mt-1">AIS + SAR correlation</p>
                </div>
                
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-xs text-red-400 uppercase">Dark Vessels</span>
                  </div>
                  <p className="text-3xl font-bold text-red-400">{comparison.darkVessels}</p>
                  <p className="text-[10px] text-gray-500 mt-1">SAR only (no AIS)</p>
                </div>
                
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-400 uppercase">Unverified</span>
                  </div>
                  <p className="text-3xl font-bold text-gray-400">{comparison.aisWithoutSAR}</p>
                  <p className="text-[10px] text-gray-500 mt-1">AIS only (no SAR match)</p>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <Satellite className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Loading comparison data...</p>
                </div>
              </div>
            )}
          </TabsContent>
          
          {/* Analytics */}
          <TabsContent value="analytics" className="h-full m-0 p-4">
            <div className="grid grid-cols-3 gap-4 h-full">
              {/* Ship Types Pie Chart */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-400 uppercase">Ship Types</h4>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={typeChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {typeChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#111827', 
                          border: '1px solid #374151',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {typeChartData.map((item) => (
                    <div key={item.name} className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-[10px] text-gray-400">{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Speed Distribution */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-400 uppercase">Speed Distribution</h4>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={speedDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis 
                        dataKey="range" 
                        tick={{ fontSize: 10, fill: '#6b7280' }}
                        axisLine={{ stroke: '#374151' }}
                      />
                      <YAxis 
                        tick={{ fontSize: 10, fill: '#6b7280' }}
                        axisLine={{ stroke: '#374151' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#111827', 
                          border: '1px solid #374151',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}
                      />
                      <Bar dataKey="count" fill="#06b6d4" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Activity Overview */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-gray-400 uppercase">Activity Overview</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-800/50 p-3 rounded">
                    <p className="text-[10px] text-gray-500 uppercase">Total</p>
                    <p className="text-lg font-bold text-white">{statistics.totalShips}</p>
                  </div>
                  <div className="bg-gray-800/50 p-3 rounded">
                    <p className="text-[10px] text-gray-500 uppercase">Active</p>
                    <p className="text-lg font-bold text-emerald-400">{statistics.activeShips}</p>
                  </div>
                  <div className="bg-gray-800/50 p-3 rounded">
                    <p className="text-[10px] text-gray-500 uppercase">Anchored</p>
                    <p className="text-lg font-bold text-amber-400">
                      {ships.filter(s => s.status === 'anchored').length}
                    </p>
                  </div>
                  <div className="bg-gray-800/50 p-3 rounded">
                    <p className="text-[10px] text-gray-500 uppercase">Alerts</p>
                    <p className="text-lg font-bold text-red-400">{statistics.alerts}</p>
                  </div>
                </div>
                
                <div className="pt-2 border-t border-gray-800">
                  <p className="text-[10px] text-gray-500 uppercase mb-1">Average Speed</p>
                  <p className="text-2xl font-bold text-cyan-400">
                    {statistics.averageSpeed.toFixed(1)}
                    <span className="text-sm text-gray-500 ml-1">knots</span>
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Ship icon component
function ShipIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76" />
      <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6" />
      <path d="M12 10v4" />
      <path d="M12 2v3" />
    </svg>
  );
}
