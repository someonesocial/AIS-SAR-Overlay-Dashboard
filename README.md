# Eye of God 👁️ - Maritime Surveillance Dashboard

A sophisticated maritime surveillance system combining real-time AIS ship tracking with Sentinel-1 SAR satellite imagery to identify "dark vessels" (ships not transmitting AIS data).

---

## ⚡ Quick Start: The Easiest Way to Run It

This project uses **React / Vite** for the frontend and **Node.js / Express** for the backend API proxy.

### 1. Prerequisites

- **Node.js** (v18 or higher): [Download here](https://nodejs.org/en/download/)
- **Git** (optional, for version control)
- A free **aisstream.io** account: [Get your free API key here](https://aisstream.io) (Sign in with your GitHub account)

### 2. Set Up Your API Key 🔑

We rely on pure, live data. You **must** provide an API key to receive the WebSocket feed for real-time boats.

1. Open the `app/` folder.
2. Create exactly a new file named `.env`.
3. Paste the following line into it, replacing the placeholder with your actual API key:

```env
AISSTREAM_API_KEY=insert_your_actual_token_string_here
```

### 3. Install Dependencies 📦

You need to install the libraries for both the web app and the server.
Open your terminal (PowerShell or Command Prompt) inside this project folder:

**A) Install the Frontend:**

```bash
cd app
npm install
```

**B) Install the Backend (from inside the `app` folder):**

```bash
cd server
npm install
```

### 4. Run the Dev Environment 🚀

To run the full experience, you need to spin up both systems simultaneously. This is easiest done by opening **two separate terminal windows** (or tabs in VS Code).

**(Alternatively, for Windows users, you can literally just double-click the `start.bat` file in the root folder!)**

**Terminal 1 (Backend Server)**
First, navigate to your server directory and start the data proxy:

```bash
cd app/server
node index.js
```

_(You should see messages confirming it's connected to `aisstream.io` and the Proxy is running.)_

**Terminal 2 (Frontend Dashboard)**
Navigate to your main app directory and kickstart Vite:

```bash
cd app
npm run dev
```

**It's alive!** Click the `http://localhost:5173` link printed in your Vite terminal to open the live dashboard. Keep both terminal windows open as long as you are using the app.

---

## 🛑 Troubleshooting

- **"Warning: AISSTREAM_API_KEY not set. Cannot stream live data."**
  Your background terminal couldn't find the API key. Ensure you created the `.env` file directly inside the `app/` folder (so the path is `app/.env`), and it contains `AISSTREAM_API_KEY=YOUR_KEY`.
- **Vite/React map is totally blank or isn't streaming ships?**
  Open the developer console in your browser (`F12`) and check for connection errors. Verify your **Terminal 1** node server is still running seamlessly without crashing.

- **"Module not found" errors when executing `npm run dev` or `node index.js`**
  Double-check that you ran `npm install` gracefully inside BOTH the `app` folder AND the `app/server` folder.

## ⚙️ Technology Built Across:

- **Frontend Core:** React 19, TypeScript, Vite
- **UI Elements:** Tailwind CSS, shadcn/ui, Radix Primitives
- **Mapping Engine:** React Leaflet
- **Backend Data Gateway:** Node.js, Express, WebSockets (`ws` library)
- **External Data APIs:** aisstream.io (AIS Feed), NASA Alaska Satellite Facility APIs (SAR Remote Sensing)
