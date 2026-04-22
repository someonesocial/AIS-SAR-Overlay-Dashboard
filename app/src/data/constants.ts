import type { NavigationStatus } from '@/types';
export { normalizeShipType, shipTypeConfig, shipTypeOrder } from './shipTypes';

export const statusLabels: Record<NavigationStatus, string> = {
  underway: 'Underway',
  anchored: 'Anchored',
  moored: 'Moored',
  restricted: 'Restricted',
  fishing: 'Fishing',
  sailing: 'Sailing'
};
