import { useEffect, useRef, useState } from 'react';
import { Radar, Settings, User, RefreshCw, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { ConnectionStatus } from '@/types';

interface HeaderProps {
  connectionStatus: ConnectionStatus;
  statusMessage?: string;
  onRefresh: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export function Header({ 
  connectionStatus, 
  statusMessage,
  onRefresh,
  theme,
  onToggleTheme
}: HeaderProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!settingsRef.current) return;
      if (!settingsRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const statusConfig = {
    online: { color: 'text-emerald-500', bg: 'bg-emerald-500', label: 'Online' },
    connecting: { color: 'text-amber-500', bg: 'bg-amber-500', label: 'Connecting...' },
    offline: { color: 'text-red-500', bg: 'bg-red-500', label: 'Offline' }
  };
  
  const status = statusConfig[connectionStatus];
  
  return (
    <header className="h-14 app-panel border-b app-panel-border flex items-center justify-between px-4 z-[2200]">
      {/* Logo and Title */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Radar className="w-6 h-6 text-cyan-500" />
          <div className="absolute inset-0 animate-pulse">
            <Radar className="w-6 h-6 text-cyan-500 opacity-50" />
          </div>
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight app-text">
            EYE OF GOD
          </h1>
          <p className="text-[10px] app-muted -mt-0.5 tracking-wider">
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
        
        <div className="hidden md:flex items-center gap-4 text-xs app-muted">
          <span>AIS: <span className="text-cyan-400">LIVE</span></span>
          <span>SAR: <span className="text-amber-400">ACTIVE</span></span>
          <span>API: <span className="text-emerald-400">CONNECTED</span></span>
        </div>
      </div>
      
      {/* Right Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 app-muted hover:text-foreground hover:bg-secondary"
          onClick={onRefresh}
          disabled={connectionStatus === 'connecting'}
        >
          <RefreshCw className={`w-4 h-4 ${connectionStatus === 'connecting' ? 'animate-spin' : ''}`} />
        </Button>

        <div className="relative" ref={settingsRef}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 app-muted hover:text-foreground hover:bg-secondary"
            onClick={() => setSettingsOpen((open) => !open)}
          >
            <Settings className="w-4 h-4" />
          </Button>

          {settingsOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-lg border app-panel-border app-panel shadow-lg p-3 space-y-3 z-[2300]">
              <div>
                <p className="text-xs font-semibold app-text uppercase tracking-wide">Settings</p>
                <p className="text-[10px] app-muted mt-1">Display preferences</p>
              </div>

              <div className="flex items-center justify-between rounded-md border app-panel-border px-3 py-2">
                <div className="flex items-center gap-2">
                  {theme === 'dark' ? (
                    <Moon className="w-4 h-4 text-slate-500" />
                  ) : (
                    <Sun className="w-4 h-4 text-amber-500" />
                  )}
                  <div>
                    <p className="text-xs app-text font-medium">Theme</p>
                    <p className="text-[10px] app-muted">{theme === 'dark' ? 'Dark mode' : 'Light mode'}</p>
                  </div>
                </div>
                <Switch
                  checked={theme === 'dark'}
                  onCheckedChange={onToggleTheme}
                  className="data-[state=checked]:bg-cyan-500"
                />
              </div>
            </div>
          )}
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 app-muted hover:text-foreground hover:bg-secondary"
        >
          <User className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
