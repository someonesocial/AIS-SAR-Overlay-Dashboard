/**
 * Sentinel-1 SAR Data Service
 * Fetches SAR data from NASA ASF and performs AI ship detection
 */

const axios = require("axios");

const ASF_API_URL = "https://api.daac.asf.alaska.edu/services/search/param";

// Cache for SAR data
let sarDataCache = null;
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Search for Sentinel-1 SAR data in a region
 */
async function searchSARData(bbox, options = {}) {
  const {
    start = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    end = new Date().toISOString(),
    processingLevel = "GRD_HD",
    beamMode = "IW",
  } = options;

  try {
    // Build WKT polygon from bbox
    const wkt = `POLYGON((${bbox[0][1]} ${bbox[0][0]}, ${bbox[1][1]} ${bbox[0][0]}, ${bbox[1][1]} ${bbox[1][0]}, ${bbox[0][1]} ${bbox[1][0]}, ${bbox[0][1]} ${bbox[0][0]}))`;

    const params = {
      intersectsWith: wkt,
      start: new Date(start).toISOString().split("T")[0],
      end: new Date(end).toISOString().split("T")[0],
      processingLevel,
      beamMode,
      platform: "Sentinel-1A,Sentinel-1C",
      output: "json",
    };

    console.log("🔍 Searching ASF for SAR data...");
    console.log("   Region:", bbox);
    console.log("   Time range:", params.start, "to", params.end);

    const response = await axios.get(ASF_API_URL, {
      params,
      timeout: 30000,
    });

    const rawScenes = normalizeASFResponse(response.data);

    if (rawScenes.length > 0) {
      console.log(`✅ Found ${rawScenes.length} SAR scenes`);
      return rawScenes.map(mapScene);
    }

    console.log(
      "ℹ️  No ASF SAR scenes found for the requested region/time range",
    );
    return [];
  } catch (err) {
    console.error("❌ ASF Search error:", err.message);
    return [];
  }
}

/**
 * AI Ship Detection on SAR imagery
 * Uses a simulated detection model (in production, use TensorFlow/PyTorch)
 */
async function detectShipsInSAR(sarScene, aisShips = []) {
  const detections = [];
  const darkVessels = [];

  // 1. Generate some detections that match AIS ships in this scene
  const shipsInScene = aisShips.filter((ship) =>
    isPointInScene(ship.latitude, ship.longitude, sarScene),
  );

  // Match some of the AIS ships (say 80% detection rate)
  shipsInScene.forEach((ship) => {
    if (Math.random() < 0.8) {
      detections.push({
        id: `sar-det-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sceneId: sarScene.id,
        latitude: ship.latitude + (Math.random() - 0.5) * 0.001, // Slight offset
        longitude: ship.longitude + (Math.random() - 0.5) * 0.001,
        confidence: 0.8 + Math.random() * 0.19, // 0.8 - 0.99
        timestamp: sarScene.acquisitionDate,
        matchedMMSI: ship.mmsi,
        length: 100 + Math.random() * 150,
        width: 20 + Math.random() * 30,
      });
    }
  });

  // 2. Generate some "Dark Vessels" (SAR detections with no AIS match)
  const numDarkVessels = Math.floor(Math.random() * 5) + 1; // 1-5 dark vessels per scene
  for (let i = 0; i < numDarkVessels; i++) {
    const point = getRandomPointInScene(sarScene);
    const darkVessel = {
      id: `sar-dark-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sceneId: sarScene.id,
      latitude: point[0],
      longitude: point[1],
      confidence: 0.7 + Math.random() * 0.25,
      timestamp: sarScene.acquisitionDate,
      matchedMMSI: null,
      length: 50 + Math.random() * 100,
      width: 10 + Math.random() * 20,
    };

    detections.push(darkVessel);
    darkVessels.push({
      ...darkVessel,
      possibleType: ["fishing", "cargo", "unknown"][
        Math.floor(Math.random() * 3)
      ],
      estimatedSpeed: Math.random() * 15,
    });
  }

  return {
    scene: sarScene,
    detections,
    darkVessels,
    matchedCount: detections.length - darkVessels.length,
    darkVesselCount: darkVessels.length,
  };
}

/**
 * Check if a point is within a SAR scene
 */
function isPointInScene(lat, lon, scene) {
  if (!scene.footprint) return false;

  // Simple bounding box check
  // In production, use proper polygon intersection
  try {
    const coords = scene.footprint.match(/-?\d+\.?\d*/g)?.map(Number);
    if (!coords || coords.length < 4) return false;

    const lats = coords.filter((_, i) => i % 2 === 1);
    const lons = coords.filter((_, i) => i % 2 === 0);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);

    return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
  } catch {
    return false;
  }
}

/**
 * Get random point within SAR scene
 */
function getRandomPointInScene(scene) {
  if (scene.centerLat && scene.centerLon) {
    return [
      scene.centerLat + (Math.random() - 0.5) * 2,
      scene.centerLon + (Math.random() - 0.5) * 2,
    ];
  }
  // Default to Strait of Hormuz
  return [25 + (Math.random() - 0.5) * 3, 56.5 + (Math.random() - 0.5) * 4];
}

/**
 * Generate mock SAR data for demo/testing
 */
function normalizeASFResponse(data) {
  if (Array.isArray(data)) {
    return data.flatMap((item) => (Array.isArray(item) ? item : [item]));
  }

  if (Array.isArray(data?.features)) {
    return data.features.map((feature) => ({
      ...feature.properties,
      geometry: feature.geometry,
    }));
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  return [];
}

function mapScene(scene) {
  const acquisitionDate =
    scene.acquisitionDate ||
    scene.startTime ||
    scene.stopTime ||
    scene.processingDate;
  const centerLat = Number(
    scene.centerLat ??
      scene.center_lat ??
      scene.lat ??
      scene.geometry?.coordinates?.[1],
  );
  const centerLon = Number(
    scene.centerLon ??
      scene.center_lon ??
      scene.lon ??
      scene.geometry?.coordinates?.[0],
  );

  return {
    id:
      scene.granuleName ||
      scene.sceneName ||
      scene.fileID ||
      scene.umm?.GranuleUR ||
      `scene-${Date.now()}`,
    sceneName:
      scene.sceneName || scene.granuleName || scene.fileID || "Unknown Scene",
    acquisitionDate,
    centerLat,
    centerLon,
    footprint:
      scene.footprint || scene.stringFootprint || geometryToWkt(scene.geometry),
    downloadUrl:
      scene.url || scene.downloadUrl || scene.metalink || scene.httpsUrl || "",
    fileSize: scene.sizeMB || scene.bytes || null,
    processingLevel: scene.processingLevel || scene.processingType || "",
    polarization: scene.polarization || scene.polarizationType || "",
    beamMode: scene.beamMode || scene.beamModeType || "",
    browseUrl: typeof scene.browse === 'string' ? scene.browse : (Array.isArray(scene.browse) && scene.browse.length > 0 ? scene.browse[0] : scene.browseUrl || null)
  };
}

function geometryToWkt(geometry) {
  if (!geometry?.coordinates?.length) return null;

  const rings = geometry.coordinates[0];
  if (!Array.isArray(rings)) return null;

  const serialized = rings.map(([lon, lat]) => `${lon} ${lat}`).join(", ");
  return `POLYGON((${serialized}))`;
}

/**
 * Get latest SAR data with AI detections
 */
async function getLatestSARWithDetections(bbox, aisShips = []) {
  const cacheKey = `${bbox.flat().join(",")}`;
  const now = Date.now();

  // Check cache
  if (
    sarDataCache &&
    sarDataCache.key === cacheKey &&
    now - lastFetchTime < CACHE_TTL
  ) {
    console.log("📦 Returning cached SAR data");
    return sarDataCache.data;
  }

  // Fetch new data
  const scenes = await searchSARData(bbox);

  if (scenes.length === 0) {
    const emptyResult = {
      scenes: [],
      detections: [],
      darkVessels: [],
      totalDetections: 0,
      darkVesselCount: 0,
      timestamp: new Date().toISOString(),
    };

    sarDataCache = { key: cacheKey, data: emptyResult };
    lastFetchTime = now;
    return emptyResult;
  }

  // Run AI detection on each scene
  const results = await Promise.all(
    scenes.map((scene) => detectShipsInSAR(scene, aisShips)),
  );

  // Combine all detections
  const allDetections = results.flatMap((r) => r.detections);
  const allDarkVessels = results.flatMap((r) => r.darkVessels);

  const result = {
    scenes,
    detections: allDetections,
    darkVessels: allDarkVessels,
    totalDetections: allDetections.length,
    darkVesselCount: allDarkVessels.length,
    timestamp: new Date().toISOString(),
  };

  // Update cache
  sarDataCache = { key: cacheKey, data: result };
  lastFetchTime = now;

  return result;
}

module.exports = {
  searchSARData,
  detectShipsInSAR,
  getLatestSARWithDetections,
  isPointInScene,
};
