# Eye of God - Maritime Surveillance Dashboard

A sophisticated maritime surveillance system that combines real-time AIS ship tracking with Sentinel-1 SAR satellite imagery and AI-powered ship detection for dark vessel identification.

![Dashboard Preview](./preview.png)

## Features

### 🛰️ Real-Time AIS Tracking
- Live ship positions via WebSocket from aisstream.io
- 60+ vessel types with color-coded markers
- Track history and movement prediction
- Connection status monitoring

### 📡 Sentinel-1 SAR Integration
- NASA ASF API for SAR imagery
- Coverage of Strait of Hormuz region
- Historical and near real-time data

### 🤖 AI Ship Detection
- Simulated AI detection on SAR imagery
- Confidence scoring for each detection
- Bounding box visualization
- Ship type estimation

### 🚨 Dark Vessel Detection
- Compares AIS vs SAR detections
- Identifies ships not broadcasting AIS
- Alert system for suspicious vessels
- Detailed dark vessel reporting

### 📊 Analytics & Visualization
- Ship type distribution charts
- Speed distribution histograms
- AIS vs SAR comparison dashboard
- Layer control with opacity settings

## Architecture

```
┌─────────────────┐     WebSocket      ┌──────────────────┐
│   React App     │◄──────────────────►│  Backend Server  │
│   (Frontend)    │                    │  (Node.js/Express│
└─────────────────┘                    └────────┬─────────┘
       │                                        │
       │                                        │ WebSocket
       │                                        │
       │                               ┌────────▼─────────┐
       │                               │  aisstream.io    │
       │                               │  (Real AIS Data) │
       │                               └──────────────────┘
       │
       │ REST API              ┌──────────────────┐
       └──────────────────────►│  NASA ASF API    │
                               │  (SAR Imagery)   │
                               └──────────────────┘
```

## Quick Start

### 1. Get API Keys

#### aisstream.io (Free)
1. Visit https://aisstream.io
2. Sign in with GitHub
3. Go to API Keys page
4. Create a new API key

#### NASA ASF (Free, optional)
- No API key required for basic SAR search
- Create account at https://urs.earthdata.nasa.gov for enhanced access

### 2. Install Dependencies

```bash
# Frontend dependencies (already installed)
cd app
npm install

# Backend dependencies
cd server
npm install
```

### 3. Configure Environment

```bash
# In the app directory
cp .env.example .env

# Edit .env and add your API key
VITE_AISSTREAM_API_KEY=your_api_key_here
```

### 4. Start the Backend Server

```bash
cd server

# Set your API key
export AISSTREAM_API_KEY=your_api_key_here

# Start the server
node index.js
```

The server will start on port 3001 with:
- WebSocket endpoint: `ws://localhost:3001/ws`
- REST API: `http://localhost:3001/api`

### 5. Start the Frontend

```bash
cd app
npm run dev
```

The dashboard will be available at `http://localhost:5173`

## API Endpoints

### WebSocket
- `ws://localhost:3001/ws` - Real-time AIS data stream

### REST API
- `GET /api/health` - Server health check
- `GET /api/ships` - List all tracked ships
- `GET /api/sar/detections` - Get SAR detections with AI analysis
- `GET /api/dark-vessels` - Get dark vessel list
- `GET /api/comparison` - AIS vs SAR comparison report

## Dark Vessel Detection

The system identifies dark vessels by:

1. **SAR Detection**: AI analyzes Sentinel-1 imagery to detect ships
2. **AIS Matching**: Compares SAR detections with known AIS positions
3. **Mismatch Detection**: Flags vessels visible in SAR but not in AIS

### Dark Vessel Types
- **Disabled AIS**: Ships that turned off transponders
- **Spoofing**: Ships with fake AIS identities
- **Illegal Activity**: Fishing, smuggling, sanctions evasion
- **Security Concerns**: Military or surveillance vessels

## Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AISSTREAM_API_KEY` | Your aisstream.io API key | (required) |
| `PORT` | Backend server port | 3001 |
| `NODE_ENV` | Environment mode | development |

### Frontend Environment

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | (same origin) |
| `VITE_WS_URL` | WebSocket URL | (same origin) |

## Deployment

### Option 1: Local Development
```bash
# Terminal 1 - Backend
cd server
AISSTREAM_API_KEY=your_key node index.js

# Terminal 2 - Frontend
cd app
npm run dev
```

### Option 2: Production Build
```bash
# Build frontend
cd app
npm run build

# Copy build to server
cp -r dist ../server/public

# Start production server
cd ../server
NODE_ENV=production AISSTREAM_API_KEY=your_key node index.js
```

### Option 3: Docker (Coming Soon)
```bash
docker-compose up -d
```

## Data Sources

### AIS Data
- **Provider**: aisstream.io
- **Coverage**: Global
- **Update Rate**: Real-time (1-10 seconds)
- **Cost**: Free (with rate limits)

### SAR Data
- **Provider**: NASA Alaska Satellite Facility (ASF)
- **Satellite**: Sentinel-1A, Sentinel-1C
- **Coverage**: Global, every 6 days
- **Resolution**: 5m x 20m (IW mode)
- **Cost**: Free

## Troubleshooting

### "Failed to connect" Error
- Check backend server is running on port 3001
- Verify AISSTREAM_API_KEY is set correctly
- Check firewall settings for WebSocket connections

### No Ships Displayed
- Verify aisstream.io API key is valid
- Check browser console for WebSocket errors
- Ensure bounding box covers your area of interest

### No SAR Detections
- ASF API may be temporarily unavailable
- Check server logs for API errors
- Demo mode will generate mock SAR data

## Demo Mode

Without an AISSTREAM_API_KEY, the system runs in demo mode with:
- 30 simulated ships moving in the Strait of Hormuz
- Mock SAR detections
- Simulated dark vessels
- Full UI functionality

## Technology Stack

### Frontend
- React 18 + TypeScript
- Vite build tool
- Tailwind CSS + shadcn/ui
- React Leaflet for maps
- Recharts for analytics
- Lucide React icons

### Backend
- Node.js + Express
- WebSocket (ws library)
- NASA ASF API client
- CORS enabled

### External APIs
- aisstream.io (AIS data)
- NASA ASF (SAR imagery)
- CartoDB (map tiles)

## License

MIT License - See LICENSE file for details

## Contributing

Pull requests welcome! Please follow the existing code style and add tests for new features.

## Support

For issues and questions:
- GitHub Issues: [your-repo]/issues
- Email: support@eyeofgod.io

---

**Disclaimer**: This tool is for educational and research purposes. Always comply with local laws and regulations when using maritime surveillance data.
