import type { ShipType } from '@/types';

export const shipTypeOrder: ShipType[] = [
  'cargo',
  'tanker',
  'passenger',
  'fishing',
  'tug',
  'pilot',
  'sar',
  'towing',
  'dredging',
  'diving',
  'military',
  'sailing',
  'pleasure',
  'wing_in_ground',
  'port_tender',
  'anti_pollution',
  'law_enforcement',
  'medical',
  'noncombatant',
  'sar_aircraft',
  'other'
];

export const shipTypeConfig: Record<ShipType, { label: string; color: string }> = {
  cargo: { label: 'Cargo', color: '#06b6d4' },
  tanker: { label: 'Tanker', color: '#f59e0b' },
  passenger: { label: 'Passenger', color: '#10b981' },
  fishing: { label: 'Fishing', color: '#a855f7' },
  tug: { label: 'Tug', color: '#14b8a6' },
  pilot: { label: 'Pilot', color: '#22c55e' },
  sar: { label: 'SAR Vessel', color: '#f97316' },
  towing: { label: 'Towing', color: '#0ea5e9' },
  dredging: { label: 'Dredging', color: '#84cc16' },
  diving: { label: 'Diving', color: '#6366f1' },
  military: { label: 'Military', color: '#ef4444' },
  sailing: { label: 'Sailing', color: '#8b5cf6' },
  pleasure: { label: 'Pleasure Craft', color: '#ec4899' },
  wing_in_ground: { label: 'Wing in Ground', color: '#38bdf8' },
  port_tender: { label: 'Port Tender', color: '#facc15' },
  anti_pollution: { label: 'Anti-pollution', color: '#f472b6' },
  law_enforcement: { label: 'Law Enforcement', color: '#fb7185' },
  medical: { label: 'Medical Transport', color: '#34d399' },
  noncombatant: { label: 'Noncombatant', color: '#94a3b8' },
  sar_aircraft: { label: 'SAR Aircraft', color: '#fb923c' },
  other: { label: 'Other', color: '#94a3b8' }
};

export function normalizeShipType(value: unknown): ShipType {
  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))
        ? Number(value)
        : null;

  if (numericValue !== null) {
    if (numericValue >= 20 && numericValue <= 28) return 'wing_in_ground';
    if (numericValue === 29) return 'sar_aircraft';
    if (numericValue === 30) return 'fishing';
    if (numericValue === 31 || numericValue === 32) return 'towing';
    if (numericValue === 33) return 'dredging';
    if (numericValue === 34) return 'diving';
    if (numericValue === 35) return 'military';
    if (numericValue === 36) return 'sailing';
    if (numericValue === 37) return 'pleasure';
    if (numericValue === 50) return 'pilot';
    if (numericValue === 51) return 'sar';
    if (numericValue === 52) return 'tug';
    if (numericValue === 53) return 'port_tender';
    if (numericValue === 54) return 'anti_pollution';
    if (numericValue === 55) return 'law_enforcement';
    if (numericValue === 58) return 'medical';
    if (numericValue === 59) return 'noncombatant';
    if (numericValue >= 60 && numericValue <= 69) return 'passenger';
    if (numericValue >= 70 && numericValue <= 79) return 'cargo';
    if (numericValue >= 80 && numericValue <= 89) return 'tanker';
    return 'other';
  }

  const input = String(value || '').toLowerCase();
  if (input.includes('cargo')) return 'cargo';
  if (input.includes('tank')) return 'tanker';
  if (input.includes('pass')) return 'passenger';
  if (input.includes('fish')) return 'fishing';
  if (input.includes('tug')) return 'tug';
  if (input.includes('pilot')) return 'pilot';
  if (input.includes('sar aircraft')) return 'sar_aircraft';
  if (input.includes('sar') || input.includes('search and rescue')) return 'sar';
  if (input.includes('tow')) return 'towing';
  if (input.includes('dredg')) return 'dredging';
  if (input.includes('diving')) return 'diving';
  if (input.includes('mil')) return 'military';
  if (input.includes('sail')) return 'sailing';
  if (input.includes('pleasure')) return 'pleasure';
  if (input.includes('wing')) return 'wing_in_ground';
  if (input.includes('port tender')) return 'port_tender';
  if (input.includes('pollution')) return 'anti_pollution';
  if (input.includes('law enforcement')) return 'law_enforcement';
  if (input.includes('medical')) return 'medical';
  if (input.includes('noncombat')) return 'noncombatant';
  return 'other';
}
