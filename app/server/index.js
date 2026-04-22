/**
 * Eye of God - Backend Server
 * Proxies AIS data and provides SAR + AI detection services
 */

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");

const { getLatestSARWithDetections } = require("./sar-service");

// Load environment from app/.env first, then fallback to the default lookup.
dotenv.config({ path: path.join(__dirname, "../.env") });
dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: "/ws" });

const PORT = process.env.PORT || 3001;
const AIS_STREAM_URL = "wss://stream.aisstream.io/v0/stream";
const API_KEY = process.env.AISSTREAM_API_KEY;
// Track ships in the Baltic Sea
const AIS_BOUNDING_BOXES = [
  [
    [54.0, 10.0],
    [59.0, 20.0],
  ],
];

// Middleware
app.use(cors());
app.use(express.json());

// State
const clients = new Map();
let aisSocket = null;
let shipsCache = new Map();
let isConnected = false;

// ==================== AIS WebSocket Proxy ====================

function connectToAISStream() {
  if (!API_KEY) {
    console.log(
      "⚠️  No AISSTREAM_API_KEY provided. Continuing without AIS feed.",
    );
    return;
  }

  console.log("🔌 Connecting to aisstream.io...");

  try {
    aisSocket = new WebSocket(AIS_STREAM_URL);

    aisSocket.on("open", () => {
      console.log("✅ Connected to aisstream.io");
      isConnected = true;

      // Subscribe to a wider Gulf region to improve the chance of receiving live traffic.
      const subscribeMessage = {
        APIKey: API_KEY,
        BoundingBoxes: AIS_BOUNDING_BOXES,
        FilterMessageTypes: ["PositionReport", "ShipStaticData"],
      };

      aisSocket.send(JSON.stringify(subscribeMessage));
      console.log("📤 Subscription sent:", JSON.stringify(subscribeMessage));
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
          console.log(`📡 AIS message received: ${message.MessageType}`);
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
      broadcastStatus("reconnecting", "Reconnecting...");
      setTimeout(connectToAISStream, 5000);
    });
  } catch (err) {
    console.error("❌ Failed to connect:", err.message);
  }
}

function processAISMessage(message) {
  if (
    message.MessageType === "PositionReport" &&
    message.Message?.PositionReport
  ) {
    const report = message.Message.PositionReport;
    const mmsi = message.MetaData?.MMSI || report.UserID;

    shipsCache.set(mmsi.toString(), {
      mmsi: mmsi.toString(),
      name: message.MetaData?.ShipName || "Unknown",
      type: message.MetaData?.ShipType || "unknown",
      latitude: report.Latitude,
      longitude: report.Longitude,
      course: report.Cog || report.TrueHeading || 0,
      speed: report.Sog || 0,
      heading: report.TrueHeading || 0,
      status: report.NavigationalStatus || 0,
      timestamp: new Date(message.MetaData?.time_utc || Date.now()),
      lastUpdate: new Date(),
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

wss.on("connection", (ws, req) => {
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
});

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
  res.json({
    status: "ok",
    ais: isConnected ? "connected" : API_KEY ? "connecting" : "disconnected",
    shipsTracked: shipsCache.size,
    timestamp: new Date().toISOString(),
  });
});

// Get all tracked ships
app.get("/api/ships", (req, res) => {
  const ships = Array.from(shipsCache.values());
  res.json({ ships, count: ships.length });
});

// Get SAR data with AI detections
app.get("/api/sar/detections", async (req, res) => {
  try {
    const { minLat = 54.0, maxLat = 59.0, minLon = 10.0, maxLon = 20.0 } = req.query;

    const bbox = [
      [parseFloat(minLat), parseFloat(minLon)],
      [parseFloat(maxLat), parseFloat(maxLon)],
    ];
    const aisShips = Array.from(shipsCache.values());

    console.log("🔍 Fetching SAR detections...");
    console.log(`   AIS ships available: ${aisShips.length}`);

    const result = await getLatestSARWithDetections(bbox, aisShips);

    res.json(result);
  } catch (err) {
    console.error("❌ SAR API error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get dark vessels (SAR detections without AIS match)
app.get("/api/dark-vessels", async (req, res) => {
  try {
    const { minLat = 54.0, maxLat = 59.0, minLon = 10.0, maxLon = 20.0 } = req.query;

    const bbox = [
      [parseFloat(minLat), parseFloat(minLon)],
      [parseFloat(maxLat), parseFloat(maxLon)],
    ];
    const aisShips = Array.from(shipsCache.values());

    const result = await getLatestSARWithDetections(bbox, aisShips);

    res.json({
      darkVessels: result.darkVessels,
      count: result.darkVesselCount,
      timestamp: result.timestamp,
    });
  } catch (err) {
    console.error("❌ Dark vessels API error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get comparison report (AIS vs SAR)
app.get("/api/comparison", async (req, res) => {
  try {
    const aisShips = Array.from(shipsCache.values());
    const bbox = [
      [54.0, 10.0],
      [59.0, 20.0],
    ];

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
  if (aisSocket) aisSocket.close();
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});
