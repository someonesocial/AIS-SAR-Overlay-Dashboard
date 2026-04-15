import type { NavigationStatus, ShipType } from '@/types';

export const shipTypeConfig: Record<ShipType, { label: string; color: string }> = {
  cargo: { label: 'Cargo', color: '#06b6d4' },
  tanker: { label: 'Tanker', color: '#f59e0b' },
  passenger: { label: 'Passenger', color: '#10b981' },
  fishing: { label: 'Fishing', color: '#a855f7' },
  military: { label: 'Military', color: '#ef4444' },
  other: { label: 'Other', color: '#94a3b8' }
};

export const statusLabels: Record<NavigationStatus, string> = {
  underway: 'Underway',
  anchored: 'Anchored',
  moored: 'Moored',
  restricted: 'Restricted',
  fishing: 'Fishing',
  sailing: 'Sailing'
};
