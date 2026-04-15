import { Radar, Settings, User, RefreshCw, AlertTriangle, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ConnectionStatus } from '@/types';

interface HeaderProps {
  connectionStatus: ConnectionStatus;
  statusMessage?: string;
  onRefresh: () => void;
  darkVesselCount?: number;
  onToggleDarkVesselPanel?: () => void;
}

export function Header({ 
  connectionStatus, 
  statusMessage,
  onRefresh,
  darkVesselCount = 0,
  onToggleDarkVesselPanel
}: HeaderProps) {
  const statusConfig = {
    online: { color: 'text-emerald-500', bg: 'bg-emerald-500', label: 'Online' },
    connecting: { color: 'text-amber-500', bg: 'bg-amber-500', label: 'Connecting...' },
    offline: { color: 'text-red-500', bg: 'bg-red-500', label: 'Offline' }
  };
  
  const status = statusConfig[connectionStatus];
  
  return (
    <header className="h-14 bg-[#0a0f1c] border-b border-gray-800 flex items-center justify-between px-4 z-50">
      {/* Logo and Title */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Radar className="w-6 h-6 text-cyan-500" />
          <div className="absolute inset-0 animate-pulse">
            <Radar className="w-6 h-6 text-cyan-500 opacity-50" />
          </div>
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white">
            EYE OF GOD
          </h1>
          <p className="text-[10px] text-gray-500 -mt-0.5 tracking-wider">
            MARITIME SURVEILLANCE
          </p>
        </div>
      </div>
      
      {/* Center - Status */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status.bg} ${connectionStatus === 'connecting' ? 'animate-pulse' : ''}`} />
          <span className={`text-xs font-medium ${status.color}`}>
            {statusMessage || status.label}
          </span>
        </div>
        
        <div className="hidden md:flex items-center gap-4 text-xs text-gray-400">
          <span>AIS: <span className="text-cyan-400">LIVE</span></span>
          <span>SAR: <span className="text-amber-400">ACTIVE</span></span>
          <span>AI: <span className="text-emerald-400">RUNNING</span></span>
        </div>
        
        {/* Dark Vessel Alert */}
        {darkVesselCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/30"
            onClick={onToggleDarkVesselPanel}
          >
            <AlertTriangle className="w-4 h-4 mr-1.5" />
            <span className="text-xs font-medium">{darkVesselCount} Dark Vessels</span>
          </Button>
        )}
      </div>
      
      {/* Right Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-800"
          onClick={onRefresh}
          disabled={connectionStatus === 'connecting'}
        >
          <RefreshCw className={`w-4 h-4 ${connectionStatus === 'connecting' ? 'animate-spin' : ''}`} />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-800"
          onClick={onToggleDarkVesselPanel}
        >
          <Eye className="w-4 h-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-800"
        >
          <Settings className="w-4 h-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-800"
        >
          <User className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
