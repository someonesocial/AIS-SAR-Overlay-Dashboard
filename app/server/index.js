/**
 * Eye of God - Backend Server
 * Proxies AIS data and provides SAR + AI detection services
 */

// Some development shells inject a dead local proxy such as 127.0.0.1:9.
// External maritime data providers must be reached directly from this server.
for (const key of [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
]) {
  delete process.env[key];
}

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");
const axios = require("axios");

const { getLatestSARWithDetections } = require("./sar-service");

// Load environment from app/.env first, then fallback to the default lookup.
dotenv.config({ path: path.join(__dirname, "../.env") });
dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: "/ws" });

const PORT = process.env.PORT || 3001;
const AIS_STREAM_URL = "wss://stream.aisstream.io/v0/stream";
const API_KEY = (process.env.AISSTREAM_API_KEY || "").trim();
const ALLOW_INSECURE_AIS_TLS =
  process.env.AISSTREAM_ALLOW_INSECURE_TLS === "true";
const AIS_STALE_TIMEOUT_MS = 45_000;
const AIS_STALE_CHECK_INTERVAL_MS = 15_000;
const ASF_BROWSE_HOST = "datapool.asf.alaska.edu";
// Track ships in the Baltic Sea by default.
const POSITION_MESSAGE_TYPES = [
  "PositionReport",
  "StandardClassBPositionReport",
  "ExtendedClassBPositionReport",
];
const STATIC_MESSAGE_TYPES = ["ShipStaticData", "StaticDataReport"];
const DEFAULT_BBOX = {
  minLat: 54.0,
  maxLat: 59.0,
  minLon: 10.0,
  maxLon: 20.0,
};
let activeBbox = { ...DEFAULT_BBOX };
let reconnectTimer = null;
let staleCheckTimer = null;
let subscriptionSentAt = null;
let lastAisMessageAt = null;
let aisMessagesReceived = 0;

function bboxToAisBoundingBoxes(bbox) {
  return [
    [
      [bbox.minLat, bbox.minLon],
      [bbox.maxLat, bbox.maxLon],
    ],
  ];
}

let aisBoundingBoxes = bboxToAisBoundingBoxes(activeBbox);

function getAisWebSocketOptions() {
  if (!ALLOW_INSECURE_AIS_TLS) return undefined;

  console.warn(
    "⚠️  AISSTREAM_ALLOW_INSECURE_TLS=true: skipping TLS certificate validation for aisstream.io.",
  );
  console.warn("   Use this only as a temporary development workaround.");
  return { rejectUnauthorized: false };
}

// Middleware
app.use(cors());
app.use(express.json());

function getRequestBaseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${proto}://${host}`;
}

function toProxiedBrowseUrl(rawUrl, req) {
  if (!rawUrl || typeof rawUrl !== "string") return null;

  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname !== ASF_BROWSE_HOST) {
      return rawUrl;
    }

    return `${getRequestBaseUrl(req)}/api/sar/browse?url=${encodeURIComponent(rawUrl)}`;
  } catch {
    return rawUrl;
  }
}

function readBboxFromQuery(query) {
  return {
    minLat: Number(query.minLat ?? activeBbox.minLat),
    maxLat: Number(query.maxLat ?? activeBbox.maxLat),
    minLon: Number(query.minLon ?? activeBbox.minLon),
    maxLon: Number(query.maxLon ?? activeBbox.maxLon),
  };
}

function validateBbox(bbox) {
  const values = [bbox.minLat, bbox.maxLat, bbox.minLon, bbox.maxLon];
  if (values.some((value) => !Number.isFinite(value))) {
    return "All coordinates must be valid numbers.";
  }
  if (bbox.minLat < -90 || bbox.maxLat > 90) {
    return "Latitude must be between -90 and 90.";
  }
  if (bbox.minLon < -180 || bbox.maxLon > 180) {
    return "Longitude must be between -180 and 180.";
  }
  if (bbox.minLat >= bbox.maxLat) {
    return "Min latitude must be smaller than max latitude.";
  }
  if (bbox.minLon >= bbox.maxLon) {
    return "Min longitude must be smaller than max longitude.";
  }

  return null;
}

function bboxToSarBbox(bbox) {
  return [
    [bbox.minLat, bbox.minLon],
    [bbox.maxLat, bbox.maxLon],
  ];
}

function isPositionInBbox(latitude, longitude, bbox) {
  return (
    latitude >= bbox.minLat &&
    latitude <= bbox.maxLat &&
    longitude >= bbox.minLon &&
    longitude <= bbox.maxLon
  );
}

// State
const clients = new Map();
let aisSocket = null;
let shipsCache = new Map();
let isConnected = false;
const TRACK_HISTORY_LIMIT = 120;

function normalizeShipType(value) {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))
        ? Number(value)
        : null;

  if (numericValue !== null) {
    if (numericValue >= 20 && numericValue <= 28) return "wing_in_ground";
    if (numericValue === 29) return "sar_aircraft";
    if (numericValue === 30) return "fishing";
    if (numericValue === 31 || numericValue === 32) return "towing";
    if (numericValue === 33) return "dredging";
    if (numericValue === 34) return "diving";
    if (numericValue === 35) return "military";
    if (numericValue === 36) return "sailing";
    if (numericValue === 37) return "pleasure";
    if (numericValue === 50) return "pilot";
    if (numericValue === 51) return "sar";
    if (numericValue === 52) return "tug";
    if (numericValue === 53) return "port_tender";
    if (numericValue === 54) return "anti_pollution";
    if (numericValue === 55) return "law_enforcement";
    if (numericValue === 58) return "medical";
    if (numericValue === 59) return "noncombatant";
    if (numericValue >= 60 && numericValue <= 69) return "passenger";
    if (numericValue >= 70 && numericValue <= 79) return "cargo";
    if (numericValue >= 80 && numericValue <= 89) return "tanker";
    return "other";
  }

  const input = String(value || "").toLowerCase();
  if (input.includes("cargo")) return "cargo";
  if (input.includes("tank")) return "tanker";
  if (input.includes("pass")) return "passenger";
  if (input.includes("fish")) return "fishing";
  if (input.includes("tug")) return "tug";
  if (input.includes("pilot")) return "pilot";
  if (input.includes("sar aircraft")) return "sar_aircraft";
  if (input.includes("sar") || input.includes("search and rescue")) return "sar";
  if (input.includes("tow")) return "towing";
  if (input.includes("dredg")) return "dredging";
  if (input.includes("diving")) return "diving";
  if (input.includes("mil")) return "military";
  if (input.includes("sail")) return "sailing";
  if (input.includes("pleasure")) return "pleasure";
  if (input.includes("wing")) return "wing_in_ground";
  if (input.includes("port tender")) return "port_tender";
  if (input.includes("pollution")) return "anti_pollution";
  if (input.includes("law enforcement")) return "law_enforcement";
  if (input.includes("medical")) return "medical";
  if (input.includes("noncombat")) return "noncombatant";
  return "other";
}

function extractStaticShipInfo(message) {
  const shipStatic = message.Message?.ShipStaticData;
  if (shipStatic) {
    return {
      name: shipStatic.Name,
      typeValue: shipStatic.Type,
      imo:
        shipStatic.ImoNumber != null
          ? String(shipStatic.ImoNumber)
          : shipStatic.IMO != null
            ? String(shipStatic.IMO)
            : null,
    };
  }

  const staticData = message.Message?.StaticDataReport;
  if (staticData?.ReportB) {
    return {
      name: staticData.ReportA?.Name || message.MetaData?.ShipName,
      typeValue: staticData.ReportB.ShipType,
      imo:
        staticData.ReportA?.ImoNumber != null
          ? String(staticData.ReportA.ImoNumber)
          : staticData.ReportA?.IMO != null
            ? String(staticData.ReportA.IMO)
            : null,
    };
  }

  return null;
}

function extractStaticMmsi(message) {
  return (
    message.MetaData?.MMSI ||
    message.Message?.ShipStaticData?.UserID ||
    message.Message?.StaticDataReport?.UserID ||
    message.UserID ||
    null
  );
}

function extractMmsi(message, report) {
  return message.MetaData?.MMSI || report?.UserID || message.UserID || null;
}

function extractPositionReport(message) {
  if (!message?.Message) return null;

  for (const type of POSITION_MESSAGE_TYPES) {
    const report = message.Message[type];
    if (report) return report;
  }

  return null;
}

function isTrackedShip(ship) {
  return (
    ship &&
    Number.isFinite(ship.latitude) &&
    Number.isFinite(ship.longitude)
  );
}

function getTrackedShips() {
  return Array.from(shipsCache.values()).filter(isTrackedShip);
}

function mergeShipRecord(mmsi, updates) {
  const existing = shipsCache.get(mmsi) || { mmsi };
  const next = {
    ...existing,
    ...updates,
    mmsi,
  };

  if (next.type !== undefined) {
    next.type = normalizeShipType(next.type);
  }

  if (updates.trackPoint) {
    const track = Array.isArray(existing.track) ? existing.track.slice(-TRACK_HISTORY_LIMIT + 1) : [];
    track.push(updates.trackPoint);
    next.track = track.slice(-TRACK_HISTORY_LIMIT);
    delete next.trackPoint;
  } else if (Array.isArray(existing.track) && !Array.isArray(next.track)) {
    next.track = existing.track;
  }

  shipsCache.set(mmsi, next);
  return next;
}

// ==================== AIS WebSocket Proxy ====================

function buildSubscriptionMessage() {
  return {
    APIKey: API_KEY,
    BoundingBoxes: aisBoundingBoxes,
    FilterMessageTypes: [...POSITION_MESSAGE_TYPES, ...STATIC_MESSAGE_TYPES],
  };
}

function sendAisSubscription() {
  if (!aisSocket || aisSocket.readyState !== WebSocket.OPEN) {
    return false;
  }

  subscriptionSentAt = Date.now();
  aisSocket.send(JSON.stringify(buildSubscriptionMessage()));
  console.log("📤 Subscription sent for region:", JSON.stringify(activeBbox));
  return true;
}

function noteAisMessage() {
  lastAisMessageAt = Date.now();
  aisMessagesReceived += 1;
}

function stopStaleWatchdog() {
  if (staleCheckTimer) {
    clearInterval(staleCheckTimer);
    staleCheckTimer = null;
  }
}

function startStaleWatchdog() {
  stopStaleWatchdog();

  staleCheckTimer = setInterval(() => {
    if (!API_KEY || !isConnected) {
      return;
    }

    const reference = lastAisMessageAt || subscriptionSentAt;
    if (!reference || Date.now() - reference < AIS_STALE_TIMEOUT_MS) {
      return;
    }

    console.warn(
      "⚠️  AIS stream connected but no vessel data received recently. Reconnecting...",
    );
    broadcastStatus(
      "error",
      "AIS feed connected but not delivering data. Reconnecting to aisstream.io...",
    );
    forceAisReconnect();
  }, AIS_STALE_CHECK_INTERVAL_MS);
}

function forceAisReconnect() {
  stopStaleWatchdog();
  subscriptionSentAt = null;
  lastAisMessageAt = null;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (aisSocket) {
    aisSocket.removeAllListeners();
    if (
      aisSocket.readyState === WebSocket.OPEN ||
      aisSocket.readyState === WebSocket.CONNECTING
    ) {
      aisSocket.close();
    }
    aisSocket = null;
  }

  isConnected = false;
  connectToAISStream();
}

function connectToAISStream() {
  if (!API_KEY) {
    console.log(
      "⚠️  No AISSTREAM_API_KEY provided. Continuing without AIS feed.",
    );
    return;
  }

  console.log("🔌 Connecting to aisstream.io...");

  try {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    aisSocket = new WebSocket(AIS_STREAM_URL, getAisWebSocketOptions());

    aisSocket.on("open", () => {
      console.log("✅ Connected to aisstream.io");
      isConnected = true;
      sendAisSubscription();
      startStaleWatchdog();
      broadcastStatus("connected", "Connected to AIS Stream");
    });

    aisSocket.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.error || message.Error) {
          const errorMessage = message.error || message.Error;
          console.error("❌ AIS Stream rejected subscription:", errorMessage);
          broadcastStatus("error", `AIS Stream error: ${errorMessage}`);
          return;
        }
        if (message.MessageType) {
          noteAisMessage();
          if (aisMessagesReceived <= 3 || aisMessagesReceived % 100 === 0) {
            console.log(`📡 AIS message received: ${message.MessageType}`);
          }
        }
        processAISMessage(message);
        broadcastToClients(data.toString());
      } catch (err) {
        console.error("❌ Error parsing AIS message:", err.message);
      }
    });

    aisSocket.on("error", (err) => {
      console.error("❌ AIS Stream error:", err.message);
      isConnected = false;
      broadcastStatus("error", err.message);
    });

    aisSocket.on("close", () => {
      console.log("🔌 AIS Stream disconnected, reconnecting in 5s...");
      isConnected = false;
      stopStaleWatchdog();
      broadcastStatus("reconnecting", "Reconnecting...");
      reconnectTimer = setTimeout(connectToAISStream, 5000);
    });
  } catch (err) {
    console.error("❌ Failed to connect:", err.message);
  }
}

function applyActiveBbox(nextBbox) {
  activeBbox = { ...nextBbox };
  aisBoundingBoxes = bboxToAisBoundingBoxes(activeBbox);
  shipsCache = new Map();

  if (sendAisSubscription()) {
    broadcastStatus("connected", "Updated AIS monitoring region");
    return;
  }

  if (aisSocket) {
    forceAisReconnect();
    return;
  }

  connectToAISStream();
}

function processAISMessage(message) {
  const staticInfo = extractStaticShipInfo(message);
  if (staticInfo) {
    const mmsi = String(extractStaticMmsi(message) || "");
    if (!mmsi) return;

    mergeShipRecord(mmsi, {
      name: staticInfo.name,
      type: normalizeShipType(staticInfo.typeValue),
      shipTypeCode: staticInfo.typeValue,
      imo: staticInfo.imo,
      lastUpdate: new Date(),
    });
    return;
  }

  const report = extractPositionReport(message);
  if (report) {
    if (!isPositionInBbox(report.Latitude, report.Longitude, activeBbox)) {
      return;
    }

    const mmsi = extractMmsi(message, report);
    if (!mmsi) return;

    const mmsiKey = mmsi.toString();
    const existing = shipsCache.get(mmsiKey) || {};
    const nextType = normalizeShipType(
      existing.shipTypeCode ?? existing.type ?? message.MetaData?.ShipType ?? "other",
    );

    mergeShipRecord(mmsiKey, {
      name: message.MetaData?.ShipName || existing.name || "Unknown",
      type: nextType,
      shipTypeCode:
        existing.shipTypeCode ?? message.MetaData?.ShipType ?? null,
      latitude: report.Latitude,
      longitude: report.Longitude,
      course: report.Cog || report.TrueHeading || 0,
      speed: report.Sog || 0,
      heading: report.TrueHeading || 0,
      status: report.NavigationalStatus || 0,
      timestamp: new Date(message.MetaData?.time_utc || Date.now()),
      lastUpdate: new Date(),
      trackPoint: {
        latitude: report.Latitude,
        longitude: report.Longitude,
        timestamp: new Date(message.MetaData?.time_utc || Date.now()),
      },
    });

    // Clean old ships
    const cutoff = Date.now() - 30 * 60 * 1000; // 30 minutes
    for (const [key, ship] of shipsCache) {
      if (ship.lastUpdate.getTime() < cutoff) {
        shipsCache.delete(key);
      }
    }
  }
}

// ==================== WebSocket Client Handling ====================

/**
 * @param {import("ws").WebSocket} ws
 */
function handleClientConnection(ws) {
  const clientId = Date.now().toString(36);
  console.log(`👤 Client connected: ${clientId}`);

  clients.set(clientId, { ws, subscriptions: [] });

  ws.send(
    JSON.stringify({
      type: "connection",
      status: API_KEY
        ? isConnected
          ? "connected"
          : "connecting"
        : "disconnected",
      clientId,
      timestamp: new Date().toISOString(),
    }),
  );

  ws.on("close", () => {
    console.log(`👤 Client disconnected: ${clientId}`);
    clients.delete(clientId);
  });

  ws.on("error", (err) => {
    console.error(`❌ Client ${clientId} error:`, err.message);
    clients.delete(clientId);
  });
}

wss.on("connection", handleClientConnection);

function broadcastToClients(message) {
  clients.forEach(({ ws }) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

function broadcastStatus(status, message) {
  broadcastToClients(
    JSON.stringify({
      type: "status",
      status,
      message,
      timestamp: new Date().toISOString(),
    }),
  );
}

// ==================== REST API Routes ====================

// Health check
app.get("/api/health", (req, res) => {
  const now = Date.now();
  const reference = lastAisMessageAt || subscriptionSentAt;
  const aisStale =
    Boolean(API_KEY && isConnected && reference) &&
    now - reference >= AIS_STALE_TIMEOUT_MS;

  res.json({
    status: "ok",
    ais: !API_KEY
      ? "disconnected"
      : aisStale
        ? "stale"
        : isConnected
          ? "connected"
          : "connecting",
    aisMessagesReceived,
    lastAisMessageAt: lastAisMessageAt
      ? new Date(lastAisMessageAt).toISOString()
      : null,
    shipsTracked: getTrackedShips().length,
    region: activeBbox,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/region", (req, res) => {
  res.json({
    bbox: activeBbox,
    defaultBbox: DEFAULT_BBOX,
  });
});

app.post("/api/region", (req, res) => {
  const nextBbox = {
    minLat: Number(req.body.minLat),
    maxLat: Number(req.body.maxLat),
    minLon: Number(req.body.minLon),
    maxLon: Number(req.body.maxLon),
  };
  const error = validateBbox(nextBbox);

  if (error) {
    return res.status(400).json({ error });
  }

  const changed =
    nextBbox.minLat !== activeBbox.minLat ||
    nextBbox.maxLat !== activeBbox.maxLat ||
    nextBbox.minLon !== activeBbox.minLon ||
    nextBbox.maxLon !== activeBbox.maxLon;

  if (changed) {
    applyActiveBbox(nextBbox);
  }

  return res.json({
    bbox: activeBbox,
    changed,
    ais: isConnected ? "connected" : API_KEY ? "connecting" : "disconnected",
  });
});

// Get all tracked ships
app.get("/api/ships", (req, res) => {
  const ships = getTrackedShips();
  res.json({ ships, count: ships.length });
});

// Get SAR data with AI detections
app.get("/api/sar/detections", async (req, res) => {
  try {
    const nextBbox = readBboxFromQuery(req.query);
    const error = validateBbox(nextBbox);
    if (error) return res.status(400).json({ error });

    const bbox = bboxToSarBbox(nextBbox);
    const aisShips = getTrackedShips();

    console.log("🔍 Fetching SAR detections...");
    console.log(`   AIS ships available: ${aisShips.length}`);

    const result = await getLatestSARWithDetections(bbox, aisShips);
    const scenesWithProxyUrls = (result.scenes || []).map((scene) => ({
      ...scene,
      browseUrl: toProxiedBrowseUrl(scene.browseUrl, req),
    }));

    res.json({
      ...result,
      scenes: scenesWithProxyUrls,
    });
  } catch (err) {
    console.error("❌ SAR API error:", err.message);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// Proxy ASF browse images to avoid browser-side CORS blocks.
app.get("/api/sar/browse", async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl || typeof targetUrl !== "string") {
    return res.status(400).json({ error: "Missing browse image URL" });
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return res.status(400).json({ error: "Invalid browse image URL" });
  }

  if (parsed.protocol !== "https:" || parsed.hostname !== ASF_BROWSE_HOST) {
    return res.status(400).json({ error: "Unsupported browse image host" });
  }

  try {
    const response = await axios.get(parsed.toString(), {
      responseType: "stream",
      timeout: 30000,
      proxy: false,
      maxRedirects: 5,
      headers: {
        "User-Agent": "Eye-of-God-SAR-Proxy/1.0",
      },
      validateStatus: (status) => status >= 200 && status < 400,
    });

    const contentType = response.headers["content-type"] || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=1800");
    if (response.headers["content-length"]) {
      res.setHeader("Content-Length", response.headers["content-length"]);
    }

    response.data.on("error", (streamErr) => {
      console.error("❌ Browse proxy stream error:", streamErr.message);
      if (!res.headersSent) {
        res.status(502).end();
      } else {
        res.end();
      }
    });

    response.data.pipe(res);
  } catch (err) {
    console.error("❌ Browse proxy error:", err.message);
    res.status(502).json({ error: "Failed to fetch browse image" });
  }
});

// Get dark vessels (SAR detections without AIS match)
app.get("/api/dark-vessels", async (req, res) => {
  try {
    const nextBbox = readBboxFromQuery(req.query);
    const error = validateBbox(nextBbox);
    if (error) return res.status(400).json({ error });

    const bbox = bboxToSarBbox(nextBbox);
    const aisShips = getTrackedShips();

    const result = await getLatestSARWithDetections(bbox, aisShips);

    res.json({
      darkVessels: result.darkVessels,
      count: result.darkVesselCount,
      timestamp: result.timestamp,
    });
  } catch (err) {
    console.error("❌ Dark vessels API error:", err.message);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// Get comparison report (AIS vs SAR)
app.get("/api/comparison", async (req, res) => {
  try {
    const aisShips = getTrackedShips();
    const nextBbox = readBboxFromQuery(req.query);
    const error = validateBbox(nextBbox);
    if (error) return res.status(400).json({ error });

    const bbox = bboxToSarBbox(nextBbox);

    const sarResult = await getLatestSARWithDetections(bbox, aisShips);

    // Find mismatches
    const matchedShips = sarResult.detections.filter((d) => d.matchedMMSI);
    const unmatchedSAR = sarResult.darkVessels;

    // Ships with AIS but no SAR detection (could be timing difference)
    const shipsWithAISNoSAR = aisShips.filter(
      (ship) => !sarResult.detections.some((d) => d.matchedMMSI === ship.mmsi),
    );

    res.json({
      summary: {
        totalAIS: aisShips.length,
        totalSARDetections: sarResult.totalDetections,
        matched: matchedShips.length,
        darkVessels: unmatchedSAR.length,
        aisWithoutSAR: shipsWithAISNoSAR.length,
      },
      darkVessels: unmatchedSAR,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("❌ Comparison API error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../dist")));

  app.use((req, res) => {
    res.sendFile(path.join(__dirname, "../dist/index.html"));
  });
}

// ==================== Start Server ====================

server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use.`);
    console.error(
      "   Another backend instance is already running, or the port is occupied by a different app.",
    );
    console.error(
      "   Stop the existing process, or set a different PORT in app/.env before starting again.",
    );
    process.exit(1);
  }

  console.error("❌ Server error:", err.message);
  process.exit(1);
});

wss.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    return;
  }

  console.error("❌ WebSocket server error:", err.message);
});

server.listen(PORT, () => {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║     🛰️  EYE OF GOD - Maritime Surveillance Server     ║");
  console.log("╠════════════════════════════════════════════════════════╣");
  console.log(`║  📡 HTTP API:    http://localhost:${PORT}/api            ║`);
  console.log(`║  🔌 WebSocket:   ws://localhost:${PORT}/ws               ║`);
  console.log("╚════════════════════════════════════════════════════════╝");
  console.log("");

  connectToAISStream();
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down...");
  stopStaleWatchdog();
  if (aisSocket) aisSocket.close();
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});
