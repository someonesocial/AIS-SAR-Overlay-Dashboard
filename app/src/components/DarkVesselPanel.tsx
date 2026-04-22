import { X, AlertTriangle, MapPin, Radar, Ship, Clock, Crosshair } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { SARDetection } from '@/types';

type DarkVessel = SARDetection & {
  estimatedLength?: number;
  estimatedType?: string;
};

interface DarkVesselPanelProps {
  darkVessels: DarkVessel[];
  stats: {
    totalAIS: number;
    totalSAR: number;
    matched: number;
    darkVessels: number;
    lastUpdate: Date | null;
  };
  onClose: () => void;
  onSelectLocation: (lat: number, lon: number) => void;
}

export function DarkVesselPanel({ 
  darkVessels, 
  stats, 
  onClose,
  onSelectLocation 
}: DarkVesselPanelProps) {
  return (
    <div className="w-80 bg-[#111827] border-l border-gray-800 flex flex-col z-40 animate-in slide-in-from-right">
      {/* Header */}
      <div className="h-14 border-b border-gray-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <div>
            <h2 className="text-sm font-semibold text-white">Dark Vessel Detection</h2>
            <p className="text-[10px] text-gray-500">AIS vs SAR Mismatch Analysis</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-gray-400 hover:text-white"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Stats */}
      <div className="p-4 border-b border-gray-800">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-gray-800/50 p-2 rounded">
            <p className="text-[10px] text-gray-500 uppercase">AIS Ships</p>
            <p className="text-lg font-bold text-cyan-400">{stats.totalAIS}</p>
          </div>
          <div className="bg-gray-800/50 p-2 rounded">
            <p className="text-[10px] text-gray-500 uppercase">SAR Detections</p>
            <p className="text-lg font-bold text-amber-400">{stats.totalSAR}</p>
          </div>
          <div className="bg-gray-800/50 p-2 rounded">
            <p className="text-[10px] text-gray-500 uppercase">Matched</p>
            <p className="text-lg font-bold text-emerald-400">{stats.matched}</p>
          </div>
          <div className="bg-red-500/10 p-2 rounded border border-red-500/30">
            <p className="text-[10px] text-red-400 uppercase">Dark Vessels</p>
            <p className="text-lg font-bold text-red-500">{stats.darkVessels}</p>
          </div>
        </div>
        
        {stats.lastUpdate && (
          <p className="text-[10px] text-gray-500 mt-2 text-right">
            Last updated: {stats.lastUpdate.toLocaleTimeString()}
          </p>
        )}
      </div>
      
      {/* Dark Vessel List */}
      <div className="flex-1 overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-800">
          <h3 className="text-xs font-medium text-gray-400 uppercase">
            Detected Dark Vessels
          </h3>
          <p className="text-[10px] text-gray-500">
            Ships visible in SAR but not transmitting AIS
          </p>
        </div>
        
        <ScrollArea className="h-[calc(100%-40px)]">
          <div className="p-2 space-y-2">
            {darkVessels.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Radar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No dark vessels detected</p>
                <p className="text-[10px] mt-1">
                  All SAR detections match AIS transmissions
                </p>
              </div>
            ) : (
              darkVessels.map((vessel, index) => (
                <div 
                  key={vessel.id}
                  className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 hover:bg-red-500/10 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                        <Ship className="w-4 h-4 text-red-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          Dark Vessel #{index + 1}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          ID: {vessel.id.slice(-8)}
                        </p>
                      </div>
                    </div>
                    <Badge 
                      variant="secondary" 
                      className="bg-red-500/20 text-red-400 text-[10px]"
                    >
                      {(vessel.confidence * 100).toFixed(0)}% confidence
                    </Badge>
                  </div>
                  
                  <Separator className="my-2 bg-red-500/10" />
                  
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2 text-gray-400">
                      <MapPin className="w-3 h-3" />
                      <span className="font-mono">
                        {vessel.latitude.toFixed(6)}°, {vessel.longitude.toFixed(6)}°
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-gray-400">
                      <Radar className="w-3 h-3" />
                      <span>{vessel.satellite}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(vessel.timestamp).toLocaleString()}</span>
                    </div>
                    
                    {vessel.estimatedLength && (
                      <div className="flex items-center gap-2 text-gray-400">
                        <Crosshair className="w-3 h-3" />
                        <span>Est. length: {vessel.estimatedLength.toFixed(0)}m</span>
                      </div>
                    )}
                    
                    {vessel.estimatedType && (
                      <div className="flex items-center gap-2 text-gray-400">
                        <Ship className="w-3 h-3" />
                        <span className="capitalize">Est. type: {vessel.estimatedType}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-7 text-[10px] border-red-500/30 text-red-400 hover:bg-red-500/20"
                      onClick={() => onSelectLocation(vessel.latitude, vessel.longitude)}
                    >
                      <MapPin className="w-3 h-3 mr-1" />
                      Locate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-7 text-[10px] border-gray-700 text-gray-400 hover:bg-gray-800"
                    >
                      <Crosshair className="w-3 h-3 mr-1" />
                      Track
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
      
      {/* Footer */}
      <div className="p-3 border-t border-gray-800 bg-gray-900/50">
        <p className="text-[10px] text-gray-500 text-center">
          Dark vessels may have disabled AIS transponders
          <br />
          or be engaged in illegal activities
        </p>
      </div>
    </div>
  );
}
