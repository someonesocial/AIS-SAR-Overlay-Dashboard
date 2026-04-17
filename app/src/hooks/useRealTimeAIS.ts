import { useEffect, useMemo, useState, useRef } from "react";
import type {
  AISShip,
  ConnectionStatus,
  NavigationStatus,
  ShipType,
} from "@/types";

type ShipStore = Record<string, AISShip>;

function resolveApiBase() {
  return import.meta.env.VITE_API_URL || "http://127.0.0.1:3001";
}

function resolveWsUrl() {
  return import.meta.env.VITE_WS_URL || "ws://127.0.0.1:3001/ws";
}

function normalizeShipType(value: string | undefined): ShipType {
  const input = (value || "").toLowerCase();
  if (input.includes("cargo")) return "cargo";
  if (input.includes("tank")) return "tanker";
  if (input.includes("pass")) return "passenger";
  if (input.includes("fish")) return "fishing";
  if (input.includes("mil")) return "military";
  return "other";
}

function normalizeStatus(value: unknown): NavigationStatus {
  const map: Record<number, NavigationStatus> = {
    0: "underway",
    1: "anchored",
    5: "moored",
    7: "fishing",
    8: "sailing",
  };
  if (typeof value === "number") return map[value] || "restricted";
  if (typeof value === "string") {
    const input = value.toLowerCase();
    if (input.includes("anchor")) return "anchored";
    if (input.includes("moor")) return "moored";
    if (input.includes("fish")) return "fishing";
    if (input.includes("sail")) return "sailing";
    if (input.includes("under")) return "underway";
  }
  return "restricted";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function upsertShip(previous: ShipStore, payload: any): ShipStore {
  const report = payload.Message?.PositionReport;
  if (!report) return previous;

  const mmsi = String(payload.MetaData?.MMSI || report.UserID || "");
  if (!mmsi) return previous;

  const now = new Date(payload.MetaData?.time_utc || Date.now());
  const existing = previous[mmsi];

  // Only update if position changed or it's a new ship
  if (existing) {
    const latChanged = existing.latitude !== report.Latitude;
    const lonChanged = existing.longitude !== report.Longitude;
    if (!latChanged && !lonChanged) return previous;
  }

  const nextTrack = [
    ...(existing?.track || []).slice(-11),
    { latitude: report.Latitude, longitude: report.Longitude, timestamp: now },
  ];

  const updated = {
    mmsi,
    name:
      payload.MetaData?.ShipName ||
      existing?.name ||
      `Vessel ${mmsi.slice(-4)}`,
    type: normalizeShipType(payload.MetaData?.ShipType || existing?.type),
    latitude: report.Latitude,
    longitude: report.Longitude,
    course: Number(report.Cog || report.TrueHeading || 0),
    speed: Number(report.Sog || 0),
    heading: Number(report.TrueHeading || 0),
    status: normalizeStatus(report.NavigationalStatus),
    timestamp: now,
    lastUpdate: new Date(),
    track: nextTrack,
  };

  // Only return new object if something actually changed
  if (
    existing &&
    existing.latitude === updated.latitude &&
    existing.longitude === updated.longitude &&
    existing.course === updated.course &&
    existing.speed === updated.speed
  ) {
    return previous;
  }

  return {
    ...previous,
    [mmsi]: updated,
  };
}

export function useRealTimeAIS() {
  const [shipsByMmsi, setShipsByMmsi] = useState<ShipStore>({});
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const [statusMessage, setStatusMessage] = useState<string>(
    "Connecting to AIS backend...",
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payloadBuffer = useRef<any[]>([]);

  useEffect(() => {
    let cancelled = false;

    fetch(`${resolveApiBase()}/api/ships`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const initial = (data.ships || []).reduce(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (acc: ShipStore, ship: any) => {
            acc[ship.mmsi] = {
              ...ship,
              type: normalizeShipType(ship.type),
              status: normalizeStatus(ship.status),
              timestamp: new Date(ship.timestamp || Date.now()),
              lastUpdate: new Date(ship.lastUpdate || Date.now()),
              track: [
                {
                  latitude: ship.latitude,
                  longitude: ship.longitude,
                  timestamp: new Date(),
                },
              ],
            };
            return acc;
          },
          {},
        );
        setShipsByMmsi(initial);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const ws = new WebSocket(resolveWsUrl());

    // Batch process payloads to prevent React performance death
    const batchInterval = setInterval(() => {
      if (payloadBuffer.current.length > 0) {
        setShipsByMmsi((current) => {
          let next = { ...current };
          for (const payload of payloadBuffer.current) {
            next = upsertShip(next, payload);
          }
          return next;
        });
        payloadBuffer.current = [];
      }
    }, 1000);

    ws.onopen = () => {
      setConnectionStatus("connecting");
      setStatusMessage("Connected to local relay...");
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);

        if (payload.type === "connection") {
          const connected = payload.status === "connected";
          setConnectionStatus(connected ? "online" : "connecting");
          setStatusMessage(
            payload.status === "connected"
              ? "Live AIS stream connected"
              : "Disconnected from AIS stream",
          );
          return;
        }

        if (payload.type === "status") {
          if (payload.status === "connected") {
            setConnectionStatus("online");
          } else if (payload.status === "reconnecting") {
            setConnectionStatus("connecting");
          } else {
            setConnectionStatus("offline");
          }
          setStatusMessage(payload.message);
          return;
        }

        if (payload.MessageType === "PositionReport") {
          payloadBuffer.current.push(payload);
          setConnectionStatus("online");
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = () => {
      setConnectionStatus("offline");
      setStatusMessage("Unable to reach AIS backend");
    };

    ws.onclose = () => {
      setConnectionStatus("offline");
      setStatusMessage("AIS backend disconnected");
    };

    return () => {
      clearInterval(batchInterval);
      ws.close();
    };
  }, []);

  const ships = useMemo(
    () =>
      Object.values(shipsByMmsi).sort(
        (a, b) => b.lastUpdate.getTime() - a.lastUpdate.getTime(),
      ),
    [shipsByMmsi],
  );

  return { ships, connectionStatus, statusMessage };
}
