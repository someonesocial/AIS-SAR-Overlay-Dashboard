/**
 * AIS Stream WebSocket Proxy Server
 * Proxies aisstream.io data to the React frontend
 * Handles CORS issues and provides a local WebSocket endpoint
 */

const WebSocket = require("ws");
const http = require("http");
const path = require("path");
const dotenv = require("dotenv");

// Load environment from app/.env first, then fallback to the default lookup.
dotenv.config({ path: path.join(__dirname, "../.env") });
dotenv.config();

const PORT = process.env.AIS_PROXY_PORT || 3001;
const AIS_STREAM_URL = "wss://stream.aisstream.io/v0/stream";

// Get API key from environment
const API_KEY = process.env.AISSTREAM_API_KEY;

if (!API_KEY) {
  console.warn(
    "⚠️  Warning: AISSTREAM_API_KEY not set. Using demo mode with mock data.",
  );
}

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      status: "AIS Proxy Server Running",
      mode: API_KEY ? "live" : "demo",
      timestamp: new Date().toISOString(),
    }),
  );
});

// Create WebSocket server
const wss = new WebSocket.Server({ server, path: "/ais" });

// Client connections
const clients = new Set();

// AIS stream connection
let aisSocket = null;
let isConnected = false;
let reconnectTimeout = null;

// Mock ship data for demo mode
const mockShips = generateMockShips();
let mockInterval = null;

function generateMockShips() {
  const shipTypes = ["cargo", "tanker", "passenger", "fishing"];
  const shipNames = [
    "MAERSK",
    "EVERGREEN",
    "COSCO",
    "MSC",
    "CMA CGM",
    "HAPAG",
    "ONE",
    "ZIM",
    "YANG MING",
    "PIL",
  ];

  return Array.from({ length: 50 }, (_, i) => ({
    Message: {
      PositionReport: {
        Cog: Math.random() * 360,
        Latitude: 25 + (Math.random() - 0.5) * 3,
        Longitude: 56.5 + (Math.random() - 0.5) * 4,
        MessageID: 1,
        NavigationalStatus: Math.floor(Math.random() * 8),
        Sog: Math.random() * 25,
        TrueHeading: Math.random() * 360,
        UserID: 200000000 + Math.floor(Math.random() * 99999999),
      },
    },
    MessageType: "PositionReport",
    MetaData: {
      MMSI: (200000000 + Math.floor(Math.random() * 99999999)).toString(),
      ShipName: `${shipNames[Math.floor(Math.random() * shipNames.length)]} ${Math.floor(Math.random() * 999)}`,
      ShipType: shipTypes[Math.floor(Math.random() * shipTypes.length)],
      latitude: 25 + (Math.random() - 0.5) * 3,
      longitude: 56.5 + (Math.random() - 0.5) * 4,
      time_utc: new Date().toISOString(),
    },
  }));
}

function startMockData() {
  console.log("📡 Starting mock AIS data stream...");

  mockInterval = setInterval(() => {
    // Update ship positions
    mockShips.forEach((ship) => {
      const speed = ship.Message.PositionReport.Sog;
      const course = ship.Message.PositionReport.Cog;
      const distance = speed / 60 / 111; // nautical miles to degrees

      ship.Message.PositionReport.Latitude +=
        distance * Math.cos((course * Math.PI) / 180);
      ship.Message.PositionReport.Longitude +=
        (distance * Math.sin((course * Math.PI) / 180)) /
        Math.cos((ship.Message.PositionReport.Latitude * Math.PI) / 180);
      ship.MetaData.latitude = ship.Message.PositionReport.Latitude;
      ship.MetaData.longitude = ship.Message.PositionReport.Longitude;
      ship.MetaData.time_utc = new Date().toISOString();
    });

    // Broadcast to all clients
    mockShips.forEach((ship) => {
      broadcast(JSON.stringify(ship));
    });
  }, 2000);
}

function stopMockData() {
  if (mockInterval) {
    clearInterval(mockInterval);
    mockInterval = null;
  }
}

function connectToAISStream() {
  if (!API_KEY) {
    startMockData();
    return;
  }

  console.log("🔌 Connecting to aisstream.io...");

  try {
    aisSocket = new WebSocket(AIS_STREAM_URL);

    aisSocket.on("open", () => {
      console.log("✅ Connected to aisstream.io");
      isConnected = true;

      // Subscribe to bounding box (Strait of Hormuz region)
      const subscribeMessage = {
        APIKey: API_KEY,
        BoundingBoxes: [
          [
            [23, 54],
            [27, 59],
          ],
        ],
        FilterMessageTypes: ["PositionReport", "ShipStaticData"],
      };

      aisSocket.send(JSON.stringify(subscribeMessage));
      console.log("📤 Subscription sent for Strait of Hormuz region");
    });

    aisSocket.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());

        // Validate message
        if (message.MessageType && message.Message) {
          broadcast(data.toString());
        }
      } catch (err) {
        console.error("❌ Error parsing AIS message:", err.message);
      }
    });

    aisSocket.on("error", (err) => {
      console.error("❌ AIS Stream error:", err.message);
      isConnected = false;
    });

    aisSocket.on("close", () => {
      console.log("🔌 AIS Stream connection closed");
      isConnected = false;

      // Reconnect after 5 seconds
      reconnectTimeout = setTimeout(connectToAISStream, 5000);
    });
  } catch (err) {
    console.error("❌ Failed to connect to AIS Stream:", err.message);
    // Fall back to mock data
    startMockData();
  }
}

function broadcast(message) {
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Handle client connections
wss.on("connection", (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`👤 Client connected from ${clientIp}`);
  clients.add(ws);

  // Send initial connection status
  ws.send(
    JSON.stringify({
      type: "connection",
      status: API_KEY ? (isConnected ? "connected" : "connecting") : "demo",
      message: API_KEY ? "Connected to AIS Stream" : "Running in demo mode",
      timestamp: new Date().toISOString(),
    }),
  );

  ws.on("close", () => {
    console.log("👤 Client disconnected");
    clients.delete(ws);
  });

  ws.on("error", (err) => {
    console.error("❌ Client error:", err.message);
    clients.delete(ws);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 AIS Proxy Server running on port ${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/ais`);

  // Connect to AIS Stream
  connectToAISStream();
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down...");
  stopMockData();
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  if (aisSocket) aisSocket.close();
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});
