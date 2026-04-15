import { useEffect, useMemo, useState } from 'react';
import type { AISShip, ConnectionStatus, NavigationStatus, ShipType } from '@/types';

type ShipStore = Record<string, AISShip>;

function resolveApiBase() {
  return import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001';
}

function resolveWsUrl() {
  return import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:3001/ws';
}

function normalizeShipType(value: string | undefined): ShipType {
  const input = (value || '').toLowerCase();
  if (input.includes('cargo')) return 'cargo';
  if (input.includes('tank')) return 'tanker';
  if (input.includes('pass')) return 'passenger';
  if (input.includes('fish')) return 'fishing';
  if (input.includes('mil')) return 'military';
  return 'other';
}

function normalizeStatus(value: unknown): NavigationStatus {
  const map: Record<number, NavigationStatus> = {
    0: 'underway',
    1: 'anchored',
    5: 'moored',
    7: 'fishing',
    8: 'sailing'
  };
  if (typeof value === 'number') return map[value] || 'restricted';
  if (typeof value === 'string') {
    const input = value.toLowerCase();
    if (input.includes('anchor')) return 'anchored';
    if (input.includes('moor')) return 'moored';
    if (input.includes('fish')) return 'fishing';
    if (input.includes('sail')) return 'sailing';
    if (input.includes('under')) return 'underway';
  }
  return 'restricted';
}

function upsertShip(previous: ShipStore, payload: any): ShipStore {
  const report = payload.Message?.PositionReport;
  if (!report) return previous;

  const mmsi = String(payload.MetaData?.MMSI || report.UserID || '');
  if (!mmsi) return previous;

  const now = new Date(payload.MetaData?.time_utc || Date.now());
  const existing = previous[mmsi];
  const nextTrack = [
    ...(existing?.track || []).slice(-11),
    { latitude: report.Latitude, longitude: report.Longitude, timestamp: now }
  ];

  return {
    ...previous,
    [mmsi]: {
      mmsi,
      name: payload.MetaData?.ShipName || existing?.name || `Vessel ${mmsi.slice(-4)}`,
      type: normalizeShipType(payload.MetaData?.ShipType || existing?.type),
      latitude: report.Latitude,
      longitude: report.Longitude,
      course: Number(report.Cog || report.TrueHeading || 0),
      speed: Number(report.Sog || 0),
      heading: Number(report.TrueHeading || 0),
      status: normalizeStatus(report.NavigationalStatus),
      timestamp: now,
      lastUpdate: new Date(),
      track: nextTrack
    }
  };
}

export function useRealTimeAIS() {
  const [shipsByMmsi, setShipsByMmsi] = useState<ShipStore>({});
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [statusMessage, setStatusMessage] = useState<string>('Connecting to AIS backend...');

  useEffect(() => {
    let cancelled = false;

    fetch(`${resolveApiBase()}/api/ships`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const initial = (data.ships || []).reduce((acc: ShipStore, ship: any) => {
          acc[ship.mmsi] = {
            ...ship,
            type: normalizeShipType(ship.type),
            status: normalizeStatus(ship.status),
            timestamp: new Date(ship.timestamp || Date.now()),
            lastUpdate: new Date(ship.lastUpdate || Date.now()),
            track: [{ latitude: ship.latitude, longitude: ship.longitude, timestamp: new Date() }]
          };
          return acc;
        }, {});
        setShipsByMmsi(initial);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const ws = new WebSocket(resolveWsUrl());

    ws.onopen = () => {
      setConnectionStatus('connecting');
      setStatusMessage('Connected to local relay...');
    };

    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);

      if (payload.type === 'connection') {
        const connected = payload.status === 'connected' || payload.status === 'demo';
        setConnectionStatus(connected ? 'online' : 'connecting');
        setStatusMessage(
          payload.status === 'demo' ? 'Demo Mode - Simulated AIS Feed' : 'Live AIS stream connected'
        );
        return;
      }

      if (payload.type === 'status') {
        if (payload.status === 'connected' || payload.status === 'demo') {
          setConnectionStatus('online');
        } else if (payload.status === 'reconnecting') {
          setConnectionStatus('connecting');
        } else {
          setConnectionStatus('offline');
        }
        setStatusMessage(payload.message);
        return;
      }

      if (payload.MessageType === 'PositionReport') {
        setShipsByMmsi((current) => upsertShip(current, payload));
        setConnectionStatus('online');
      }
    };

    ws.onerror = () => {
      setConnectionStatus('offline');
      setStatusMessage('Unable to reach AIS backend');
    };

    ws.onclose = () => {
      setConnectionStatus('offline');
      setStatusMessage('AIS backend disconnected');
    };

    return () => {
      ws.close();
    };
  }, []);

  const ships = useMemo(
    () =>
      Object.values(shipsByMmsi).sort(
        (a, b) => b.lastUpdate.getTime() - a.lastUpdate.getTime()
      ),
    [shipsByMmsi]
  );

  return { ships, connectionStatus, statusMessage };
}
