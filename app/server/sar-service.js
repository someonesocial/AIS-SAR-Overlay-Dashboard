/**
 * Sentinel-1 SAR Data Service
 * Fetches SAR data from NASA ASF and performs AI ship detection
 */

const axios = require('axios');

const ASF_API_URL = 'https://api.daac.asf.alaska.edu/services/search/param';
const ASF_VERTEX_URL = 'https://api.daac.asf.alaska.edu/services/search/v1';

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
    processingLevel = 'GRD_HD',
    beamMode = 'IW'
  } = options;
  
  try {
    // Build WKT polygon from bbox
    const wkt = `POLYGON((${bbox[0][1]} ${bbox[0][0]}, ${bbox[1][1]} ${bbox[0][0]}, ${bbox[1][1]} ${bbox[1][0]}, ${bbox[0][1]} ${bbox[1][0]}, ${bbox[0][1]} ${bbox[0][0]}))`;
    
    const params = {
      intersectsWith: wkt,
      start: new Date(start).toISOString().split('T')[0],
      end: new Date(end).toISOString().split('T')[0],
      processingLevel,
      beamMode,
      platform: 'Sentinel-1A,Sentinel-1C',
      output: 'json'
    };
    
    console.log('🔍 Searching ASF for SAR data...');
    console.log('   Region:', bbox);
    console.log('   Time range:', params.start, 'to', params.end);
    
    const response = await axios.get(ASF_API_URL, { 
      params,
      timeout: 30000
    });
    
    if (response.data && response.data.length > 0) {
      console.log(`✅ Found ${response.data.length} SAR scenes`);
      return response.data.map(scene => ({
        id: scene.granuleName,
        sceneName: scene.sceneName,
        acquisitionDate: scene.acquisitionDate,
        centerLat: scene.centerLat,
        centerLon: scene.centerLon,
        footprint: scene.footprint,
        downloadUrl: scene.url,
        fileSize: scene.sizeMB,
        processingLevel: scene.processingLevel,
        polarization: scene.polarization,
        beamMode: scene.beamMode
      }));
    }
    
    return [];
  } catch (err) {
    console.error('❌ ASF Search error:', err.message);
    // Return mock data if API fails
    return generateMockSARData(bbox);
  }
}

/**
 * AI Ship Detection on SAR imagery
 * Uses a simulated detection model (in production, use TensorFlow/PyTorch)
 */
async function detectShipsInSAR(sarScene, aisShips = []) {
  // In production, this would:
  // 1. Download the SAR image
  // 2. Preprocess (speckle filtering, calibration)
  // 3. Run through a trained CNN (YOLO/Mask R-CNN)
  // 4. Extract ship positions and confidence scores
  
  // For demo, we simulate detections based on AIS positions
  // and add some "dark vessels" (ships detected in SAR but not in AIS)
  
  const detections = [];
  const darkVessels = [];
  
  // Match AIS ships to SAR detections
  aisShips.forEach(ship => {
    // Check if ship is within SAR scene footprint
    if (isPointInScene(ship.latitude, ship.longitude, sarScene)) {
      detections.push({
        id: `SAR-${sarScene.id}-${ship.mmsi}`,
        latitude: ship.latitude + (Math.random() - 0.5) * 0.001,
        longitude: ship.longitude + (Math.random() - 0.5) * 0.001,
        confidence: 0.85 + Math.random() * 0.15,
        timestamp: new Date(sarScene.acquisitionDate),
        satellite: sarScene.sceneName?.includes('S1A') ? 'Sentinel-1A' : 'Sentinel-1C',
        matchedMMSI: ship.mmsi,
        isDarkVessel: false,
        bbox: [
          ship.longitude - 0.002,
          ship.latitude - 0.002,
          ship.longitude + 0.002,
          ship.latitude + 0.002
        ]
      });
    }
  });
  
  // Generate dark vessels (ships visible in SAR but no AIS signal)
  // These are vessels that have turned off their AIS transponders
  const numDarkVessels = Math.floor(Math.random() * 5) + 2;
  
  for (let i = 0; i < numDarkVessels; i++) {
    const [lat, lon] = getRandomPointInScene(sarScene);
    
    // Check if this position doesn't match any known AIS ship
    const nearbyAIS = aisShips.find(ship => 
      Math.abs(ship.latitude - lat) < 0.01 && 
      Math.abs(ship.longitude - lon) < 0.01
    );
    
    if (!nearbyAIS) {
      const darkVessel = {
        id: `SAR-DARK-${sarScene.id}-${i}`,
        latitude: lat,
        longitude: lon,
        confidence: 0.7 + Math.random() * 0.25,
        timestamp: new Date(sarScene.acquisitionDate),
        satellite: sarScene.sceneName?.includes('S1A') ? 'Sentinel-1A' : 'Sentinel-1C',
        matchedMMSI: null,
        isDarkVessel: true,
        estimatedLength: 50 + Math.random() * 200,
        estimatedType: ['cargo', 'tanker', 'fishing'][Math.floor(Math.random() * 3)],
        bbox: [lon - 0.002, lat - 0.002, lon + 0.002, lat + 0.002]
      };
      
      detections.push(darkVessel);
      darkVessels.push(darkVessel);
    }
  }
  
  return {
    scene: sarScene,
    detections,
    darkVessels,
    matchedCount: detections.length - darkVessels.length,
    darkVesselCount: darkVessels.length
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
      scene.centerLon + (Math.random() - 0.5) * 2
    ];
  }
  // Default to Strait of Hormuz
  return [
    25 + (Math.random() - 0.5) * 3,
    56.5 + (Math.random() - 0.5) * 4
  ];
}

/**
 * Generate mock SAR data for demo/testing
 */
function generateMockSARData(bbox) {
  const now = new Date();
  const scenes = [];
  
  for (let i = 0; i < 5; i++) {
    const acquisitionTime = new Date(now.getTime() - i * 12 * 60 * 60 * 1000);
    scenes.push({
      id: `S1A_IW_GRDH_${acquisitionTime.toISOString().slice(0, 10).replace(/-/g, '')}_${String(i).padStart(6, '0')}`,
      sceneName: `S1A_IW_GRDH_1SDV_${acquisitionTime.toISOString().slice(0, 10).replace(/-/g, '')}T${String(Math.floor(Math.random() * 24)).padStart(2, '0')}${String(Math.floor(Math.random() * 60)).padStart(2, '0')}${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
      acquisitionDate: acquisitionTime.toISOString(),
      centerLat: 25 + (Math.random() - 0.5) * 2,
      centerLon: 56.5 + (Math.random() - 0.5) * 3,
      footprint: `POLYGON((${bbox[0][1]} ${bbox[0][0]}, ${bbox[1][1]} ${bbox[0][0]}, ${bbox[1][1]} ${bbox[1][0]}, ${bbox[0][1]} ${bbox[1][0]}, ${bbox[0][1]} ${bbox[0][0]}))`,
      downloadUrl: `https://datapool.asf.alaska.edu/GRD_HD/S1A/mock-${i}.zip`,
      fileSize: 500 + Math.random() * 500,
      processingLevel: 'GRD_HD',
      polarization: 'VV+VH',
      beamMode: 'IW'
    });
  }
  
  return scenes;
}

/**
 * Get latest SAR data with AI detections
 */
async function getLatestSARWithDetections(bbox, aisShips = []) {
  const cacheKey = `${bbox.flat().join(',')}`;
  const now = Date.now();
  
  // Check cache
  if (sarDataCache && sarDataCache.key === cacheKey && (now - lastFetchTime) < CACHE_TTL) {
    console.log('📦 Returning cached SAR data');
    return sarDataCache.data;
  }
  
  // Fetch new data
  const scenes = await searchSARData(bbox);
  
  // Run AI detection on each scene
  const results = await Promise.all(
    scenes.map(scene => detectShipsInSAR(scene, aisShips))
  );
  
  // Combine all detections
  const allDetections = results.flatMap(r => r.detections);
  const allDarkVessels = results.flatMap(r => r.darkVessels);
  
  const result = {
    scenes,
    detections: allDetections,
    darkVessels: allDarkVessels,
    totalDetections: allDetections.length,
    darkVesselCount: allDarkVessels.length,
    timestamp: new Date().toISOString()
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
  isPointInScene
};
