import { useEffect, useMemo, useState, useRef } from "react";
import type {
  AISShip,
  ConnectionStatus,
  NavigationStatus,
  ShipType,
} from "@/types";
import { normalizeShipType } from "@/data/shipTypes";

type ShipStore = Record<string, AISShip>;
type StaticShipInfo = {
  name?: string;
  type?: ShipType;
  shipTypeCode?: number | null;
};
type RawShip = {
  mmsi?: string | number;
  shipTypeCode?: number | null;
  type?: unknown;
  status?: unknown;
  latitude?: number;
  longitude?: number;
  course?: number;
  speed?: number;
  heading?: number;
  timestamp?: string | number;
  lastUpdate?: string | number;
  name?: string;
};

type AisMessagePayload = {
  MetaData?: {
    MMSI?: string | number;
    ShipType?: unknown;
    ShipName?: string;
    time_utc?: string | number;
  };
  Message?: {
    PositionReport?: {
      UserID?: string | number;
      Latitude: number;
      Longitude: number;
      Cog?: number | string;
      TrueHeading?: number | string;
      Sog?: number | string;
      NavigationalStatus?: unknown;
    };
    ShipStaticData?: {
      Name?: string;
      Type?: unknown;
      UserID?: string | number;
    };
    StaticDataReport?: {
      ReportA?: {
        Name?: string;
      };
      ReportB?: {
        ShipType?: unknown;
        UserID?: string | number;
      };
      UserID?: string | number;
    };
  };
  MessageType?: string;
  type?: string;
  status?: string;
  message?: string;
  UserID?: string | number;
};

function resolveApiBase() {
  return import.meta.env.VITE_API_URL || "http://127.0.0.1:3001";
}

function resolveWsUrl() {
  return import.meta.env.VITE_WS_URL || "ws://127.0.0.1:3001/ws";
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

function extractStaticInfo(payload: AisMessagePayload): StaticShipInfo | null {
  const shipStatic = payload.Message?.ShipStaticData;
  if (shipStatic) {
    return {
      name: shipStatic.Name,
      type: normalizeShipType(shipStatic.Type),
      shipTypeCode: typeof shipStatic.Type === "number" ? shipStatic.Type : null,
    };
  }

  const staticData = payload.Message?.StaticDataReport;
  if (staticData?.ReportB) {
    return {
      name: staticData.ReportA?.Name || payload.MetaData?.ShipName,
      type: normalizeShipType(staticData.ReportB.ShipType),
      shipTypeCode:
        typeof staticData.ReportB.ShipType === "number"
          ? staticData.ReportB.ShipType
          : null,
    };
  }

  return null;
}

function extractStaticMmsi(payload: AisMessagePayload): string {
  return String(
    payload.MetaData?.MMSI ||
      payload.Message?.ShipStaticData?.UserID ||
      payload.Message?.StaticDataReport?.UserID ||
      payload.UserID ||
      "",
  );
}

function upsertShip(
  previous: ShipStore,
  payload: AisMessagePayload,
  staticInfo?: StaticShipInfo | null,
): ShipStore {
  const report = payload.Message?.PositionReport;
  if (!report) return previous;

  const mmsi = String(payload.MetaData?.MMSI || report.UserID || "");
  if (!mmsi) return previous;

  const now = new Date(payload.MetaData?.time_utc || Date.now());
  const existing = previous[mmsi];
  const mergedType = normalizeShipType(
    staticInfo?.type ??
      payload.MetaData?.ShipType ??
      existing?.shipTypeCode ??
      existing?.type,
  );
  const mergedName =
    staticInfo?.name ||
    payload.MetaData?.ShipName ||
    existing?.name ||
    `Vessel ${mmsi.slice(-4)}`;

  // Only update if something meaningful changed.
  if (existing) {
    const latChanged = existing.latitude !== report.Latitude;
    const lonChanged = existing.longitude !== report.Longitude;
    const typeChanged = existing.type !== mergedType;
    const nameChanged = existing.name !== mergedName;
    if (!latChanged && !lonChanged && !typeChanged && !nameChanged) return previous;
  }

  const nextTrack = [
    ...(existing?.track || []).slice(-11),
    { latitude: report.Latitude, longitude: report.Longitude, timestamp: now },
  ];

  const updated = {
    mmsi,
    name: mergedName,
    type: mergedType,
    shipTypeCode: staticInfo?.shipTypeCode ?? existing?.shipTypeCode ?? null,
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
  const staticInfoRef = useRef<Record<string, StaticShipInfo>>({});
  const payloadBuffer = useRef<AisMessagePayload[]>([]);

  useEffect(() => {
    let cancelled = false;

    fetch(`${resolveApiBase()}/api/ships`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const initialShips = ((data as { ships?: RawShip[] }).ships || []) as RawShip[];
        const initial = initialShips.reduce((acc: ShipStore, ship: RawShip) => {
          const mmsi = String(ship.mmsi || "");
          if (!mmsi || ship.latitude === undefined || ship.longitude === undefined) {
            return acc;
          }

          acc[mmsi] = {
            mmsi,
            name: ship.name || `Vessel ${mmsi.slice(-4)}`,
            type: normalizeShipType(ship.shipTypeCode ?? ship.type),
            shipTypeCode: ship.shipTypeCode ?? null,
            latitude: ship.latitude,
            longitude: ship.longitude,
            course: Number(ship.course || 0),
            speed: Number(ship.speed || 0),
            heading: Number(ship.heading || 0),
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

    // Batch process payloads to prevent React performance death
    const batchInterval = setInterval(() => {
      if (payloadBuffer.current.length > 0) {
        setShipsByMmsi((current) => {
          let next = { ...current };
          for (const payload of payloadBuffer.current) {
            const report = payload.Message?.PositionReport;
            const mmsi = String(payload.MetaData?.MMSI || report?.UserID || "");
            const staticInfo = mmsi ? staticInfoRef.current[mmsi] : null;
            next = upsertShip(next, payload, staticInfo);
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
        const payload = JSON.parse(event.data) as AisMessagePayload;

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
          return;
        }

        if (payload.MessageType === "ShipStaticData" || payload.MessageType === "StaticDataReport") {
          const staticInfo = extractStaticInfo(payload);
          if (!staticInfo) return;

          const mmsi = extractStaticMmsi(payload);
          if (!mmsi) return;

          staticInfoRef.current[mmsi] = staticInfo;

          setShipsByMmsi((current) => {
            const existing = current[mmsi];
            if (!existing) return current;

            const nextType = staticInfo.type || existing.type;
            const nextName = staticInfo.name || existing.name;
            if (existing.type === nextType && existing.name === nextName) {
              return current;
            }

            return {
              ...current,
              [mmsi]: {
                ...existing,
                name: nextName,
                type: nextType,
                shipTypeCode: staticInfo.shipTypeCode ?? existing.shipTypeCode ?? null,
                lastUpdate: new Date(),
              },
            };
          });
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
