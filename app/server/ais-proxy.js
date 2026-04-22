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
    "⚠️  Warning: AISSTREAM_API_KEY not set. Cannot stream live data.",
  );
}

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      status: "AIS Proxy Server Running",
      mode: API_KEY ? "live" : "disconnected",
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

function connectToAISStream() {
  if (!API_KEY) {
    console.warn(
      "⚠️  Warning: AISSTREAM_API_KEY not set. Cannot stream live data.",
    );
    return;
  }

  console.log("🔌 Connecting to aisstream.io...");

  try {
    aisSocket = new WebSocket(AIS_STREAM_URL);

    aisSocket.on("open", () => {
      console.log("✅ Connected to aisstream.io");
      isConnected = true;

      // Subscribe to bounding box (Baltic Sea region)
      const subscribeMessage = {
        APIKey: API_KEY,
        BoundingBoxes: [
          [
            [54.0, 10.0],
            [59.0, 20.0],
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
      status: API_KEY
        ? isConnected
          ? "connected"
          : "connecting"
        : "disconnected",
      message: API_KEY ? "Connected to AIS Stream" : "API Key Missing",
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
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  if (aisSocket) aisSocket.close();
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});
