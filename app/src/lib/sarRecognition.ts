import type { AISShip, SARDetection, SARScene } from '@/types';

type SceneBounds = {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
};

type BlobCandidate = {
  centerX: number;
  centerY: number;
  area: number;
  brightness: number;
  peak: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

type ShipPosition = {
  mmsi: string;
  name: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
  spatialConfidence: number;
};

const MAX_IMAGE_EDGE = 640;
const MIN_BLOB_AREA = 4;
const MAX_BLOB_AREA = 380;
const MIN_ISOLATION_RATIO = 2.2;
const MAX_RING_BRIGHTNESS = 130;
const MAX_RING_VARIANCE = 650;
const MIN_EDGE_BUFFER_RATIO = 0.08;
const MATCH_DISTANCE_KM = 4;
const MATCH_TIME_WINDOW_MINUTES = 45;
export const MIN_SAR_DETECTION_ZOOM = 14;

export function parseFootprintCoordinates(
  footprint?: string | null,
): [number, number][] {
  if (!footprint) return [];

  const matches = footprint.match(/-?\d+\.?\d*/g);
  if (!matches || matches.length < 6) return [];

  const coords: [number, number][] = [];
  for (let i = 0; i < matches.length - 1; i += 2) {
    const lon = Number(matches[i]);
    const lat = Number(matches[i + 1]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      coords.push([lat, lon]);
    }
  }

  return coords;
}

export function getSceneBounds(scene: SARScene): SceneBounds | null {
  const coords = parseFootprintCoordinates(scene.footprint);
  if (!coords.length) return null;

  const lats = coords.map(([lat]) => lat);
  const lons = coords.map(([, lon]) => lon);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  if (
    !Number.isFinite(minLat) ||
    !Number.isFinite(maxLat) ||
    !Number.isFinite(minLon) ||
    !Number.isFinite(maxLon) ||
    minLat === maxLat ||
    minLon === maxLon
  ) {
    return null;
  }

  return { minLat, maxLat, minLon, maxLon };
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const r = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

function toSceneTimestamp(scene: SARScene): Date {
  const raw = scene.acquisitionDate;
  const parsed = raw ? new Date(raw) : new Date();
  return Number.isFinite(parsed.getTime()) ? parsed : new Date();
}

function getCanvasDimensions(image: HTMLImageElement) {
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.width, image.height));
  return {
    width: Math.max(1, Math.round(image.width * scale)),
    height: Math.max(1, Math.round(image.height * scale)),
  };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load SAR browse image: ${url}`));
    image.src = url;
  });
}

function brightnessAt(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pixelToLatLon(
  x: number,
  y: number,
  width: number,
  height: number,
  bounds: SceneBounds,
): [number, number] {
  const lonSpan = bounds.maxLon - bounds.minLon;
  const latSpan = bounds.maxLat - bounds.minLat;
  const lon = bounds.minLon + (x / Math.max(1, width - 1)) * lonSpan;
  const lat = bounds.maxLat - (y / Math.max(1, height - 1)) * latSpan;
  return [lat, lon];
}

function isInsidePolygon(point: [number, number], polygon: [number, number][]) {
  let inside = false;
  const [lat, lon] = point;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [latI, lonI] = polygon[i];
    const [latJ, lonJ] = polygon[j];
    const intersect =
      lonI > lon !== lonJ > lon &&
      lat <
        ((latJ - latI) * (lon - lonI)) / (lonJ - lonI + Number.EPSILON) + latI;
    if (intersect) inside = !inside;
  }

  return inside;
}

function buildShipPositions(
  ships: AISShip[],
  sceneTime: Date,
): ShipPosition[] {
  const windowMs = MATCH_TIME_WINDOW_MINUTES * 60 * 1000;
  const positions: ShipPosition[] = [];

  for (const ship of ships) {
    const history = ship.track?.length
      ? ship.track
      : [
          {
            latitude: ship.latitude,
            longitude: ship.longitude,
            timestamp: ship.timestamp,
          },
        ];

    let bestPoint = history[0];
    let bestDelta = Number.POSITIVE_INFINITY;

    for (const point of history) {
      const pointTime = point.timestamp ? new Date(point.timestamp) : sceneTime;
      const delta = Math.abs(pointTime.getTime() - sceneTime.getTime());
      if (delta < bestDelta) {
        bestDelta = delta;
        bestPoint = point;
      }
    }

    if (bestDelta > windowMs || !Number.isFinite(bestPoint.latitude) || !Number.isFinite(bestPoint.longitude)) {
      continue;
    }

    positions.push({
      mmsi: ship.mmsi,
      name: ship.name,
      latitude: bestPoint.latitude,
      longitude: bestPoint.longitude,
      timestamp: bestPoint.timestamp ? new Date(bestPoint.timestamp) : sceneTime,
      spatialConfidence: 1 - clamp(bestDelta / windowMs, 0, 1),
    });
  }

  return positions;
}

function chooseBestShipMatch(
  detectionLat: number,
  detectionLon: number,
  shipPositions: ShipPosition[],
): ShipPosition | null {
  let best: ShipPosition | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const ship of shipPositions) {
    const distance = haversineKm(
      detectionLat,
      detectionLon,
      ship.latitude,
      ship.longitude,
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      best = ship;
    }
  }

  if (best && bestDistance <= MATCH_DISTANCE_KM) {
    return best;
  }

  return null;
}

function scoreBlob(
  blob: BlobCandidate,
  width: number,
  height: number,
  threshold: number,
  isolationRatio: number,
  ringBrightness: number,
): number {
  const areaScore = clamp(blob.area / 60, 0, 1);
  const brightnessScore = clamp((blob.peak - threshold) / 80, 0, 1);
  const sizePenalty = clamp(blob.area / MAX_BLOB_AREA, 0, 1);
  const edgeDistance = Math.min(
    blob.centerX,
    blob.centerY,
    width - blob.centerX,
    height - blob.centerY,
  );
  const edgeScore = clamp(edgeDistance / Math.max(width, height), 0, 1);

  const isolationScore = clamp((isolationRatio - MIN_ISOLATION_RATIO) / 2.0, 0, 1);
  const seaDarknessScore = clamp((MAX_RING_BRIGHTNESS - ringBrightness) / MAX_RING_BRIGHTNESS, 0, 1);

  return clamp(
    0.14 +
      areaScore * 0.22 +
      brightnessScore * 0.18 +
      edgeScore * 0.08 +
      isolationScore * 0.22 +
      seaDarknessScore * 0.22 -
      sizePenalty * 0.12,
    0,
    1,
  );
}

function findBrightBlobs(
  imageData: ImageData,
  threshold: number,
): BlobCandidate[] {
  const { width, height, data } = imageData;
  const visited = new Uint8Array(width * height);
  const blobs: BlobCandidate[] = [];
  const queue: number[] = [];

  const isBright = (index: number) => data[index * 4] >= threshold;

  for (let start = 0; start < width * height; start += 1) {
    if (visited[start] || !isBright(start)) continue;

    visited[start] = 1;
    queue.length = 0;
    queue.push(start);

    let area = 0;
    let sumX = 0;
    let sumY = 0;
    let sumBrightness = 0;
    let peak = 0;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;

    while (queue.length > 0) {
      const index = queue.pop() as number;
      const x = index % width;
      const y = Math.floor(index / width);
      const base = index * 4;
      const brightness = brightnessAt(data[base], data[base + 1], data[base + 2]);

      area += 1;
      sumX += x;
      sumY += y;
      sumBrightness += brightness;
      peak = Math.max(peak, brightness);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      const neighbors = [
        index - 1,
        index + 1,
        index - width,
        index + width,
      ];

      for (const neighbor of neighbors) {
        if (
          neighbor < 0 ||
          neighbor >= width * height ||
          visited[neighbor] ||
          !isBright(neighbor)
        ) {
          continue;
        }

        const nx = neighbor % width;
        const ny = Math.floor(neighbor / width);
        if (Math.abs(nx - x) > 1 || Math.abs(ny - y) > 1) {
          continue;
        }

        visited[neighbor] = 1;
        queue.push(neighbor);
      }
    }

    if (area < MIN_BLOB_AREA || area > MAX_BLOB_AREA) continue;

    blobs.push({
      centerX: sumX / area,
      centerY: sumY / area,
      area,
      brightness: sumBrightness / area,
      peak,
      minX,
      maxX,
      minY,
      maxY,
    });
  }

  return blobs;
}

function analyzeLocalSeaIsolation(imageData: ImageData, blob: BlobCandidate) {
  const { width, height, data } = imageData;
  const pad = 8;
  const minX = clamp(Math.floor(blob.minX - pad), 0, width - 1);
  const maxX = clamp(Math.ceil(blob.maxX + pad), 0, width - 1);
  const minY = clamp(Math.floor(blob.minY - pad), 0, height - 1);
  const maxY = clamp(Math.ceil(blob.maxY + pad), 0, height - 1);

  let ringCount = 0;
  let ringSum = 0;
  let ringSumSquares = 0;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const insideBlob =
        x >= blob.minX && x <= blob.maxX && y >= blob.minY && y <= blob.maxY;
      if (insideBlob) continue;

      const index = (y * width + x) * 4;
      const value = brightnessAt(data[index], data[index + 1], data[index + 2]);
      ringCount += 1;
      ringSum += value;
      ringSumSquares += value * value;
    }
  }

  if (ringCount === 0) {
    return {
      isolationRatio: 0,
      ringBrightness: 255,
      ringVariance: Number.POSITIVE_INFINITY,
    };
  }

  const ringBrightness = ringSum / ringCount;
  const ringVariance = ringSumSquares / ringCount - ringBrightness ** 2;
  const isolationRatio = blob.peak / Math.max(1, ringBrightness);

  return {
    isolationRatio,
    ringBrightness,
    ringVariance,
  };
}

function isNearSceneEdge(
  blob: BlobCandidate,
  width: number,
  height: number,
): boolean {
  const edgeBuffer = Math.max(6, Math.floor(Math.min(width, height) * MIN_EDGE_BUFFER_RATIO));
  return (
    blob.minX <= edgeBuffer ||
    blob.minY <= edgeBuffer ||
    blob.maxX >= width - edgeBuffer ||
    blob.maxY >= height - edgeBuffer
  );
}

export async function analyzeSarScene(
  scene: SARScene,
  ships: AISShip[],
): Promise<{
  detections: SARDetection[];
  darkVessels: SARDetection[];
  matchedMMSI: Set<string>;
}> {
  if (!scene.browseUrl) {
    return {
      detections: [],
      darkVessels: [],
      matchedMMSI: new Set(),
    };
  }

  const bounds = getSceneBounds(scene);
  if (!bounds) {
    return {
      detections: [],
      darkVessels: [],
      matchedMMSI: new Set(),
    };
  }

  const image = await loadImage(scene.browseUrl);
  const dimensions = getCanvasDimensions(image);
  const canvas = document.createElement('canvas');
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('SAR image canvas is unavailable in this browser');
  }

  context.drawImage(image, 0, 0, dimensions.width, dimensions.height);
  const imageData = context.getImageData(0, 0, dimensions.width, dimensions.height);

  const brightnessSamples: number[] = [];
  for (let i = 0; i < imageData.data.length; i += 4) {
    brightnessSamples.push(
      brightnessAt(imageData.data[i], imageData.data[i + 1], imageData.data[i + 2]),
    );
  }

  const sorted = [...brightnessSamples].sort((a, b) => a - b);
  const percentileIndex = Math.max(0, Math.floor(sorted.length * 0.96) - 1);
  const percentileThreshold = sorted[percentileIndex] ?? 0;
  const mean =
    brightnessSamples.reduce((sum, value) => sum + value, 0) /
    Math.max(1, brightnessSamples.length);
  const variance =
    brightnessSamples.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    Math.max(1, brightnessSamples.length);
  const stdDev = Math.sqrt(variance);
  const threshold = Math.max(percentileThreshold, mean + stdDev * 0.7, 132);

  const blobs = findBrightBlobs(imageData, threshold)
    .sort((a, b) => b.peak - a.peak)
    .slice(0, 30);

  const sceneTime = toSceneTimestamp(scene);
  const shipPositions = buildShipPositions(ships, sceneTime);
  const polygon = parseFootprintCoordinates(scene.footprint);

  const detections: SARDetection[] = [];
  const darkVessels: SARDetection[] = [];
  const matchedMMSI = new Set<string>();

  const candidates = blobs.filter((blob) => {
    const isolation = analyzeLocalSeaIsolation(imageData, blob);
    return (
      !isNearSceneEdge(blob, dimensions.width, dimensions.height) &&
      isolation.isolationRatio >= MIN_ISOLATION_RATIO &&
      isolation.ringBrightness <= MAX_RING_BRIGHTNESS &&
      isolation.ringVariance <= MAX_RING_VARIANCE
    );
  });

  const finalBlobs =
    candidates.length > 0
      ? candidates
      : blobs.filter((blob) => {
          const isolation = analyzeLocalSeaIsolation(imageData, blob);
          return (
            !isNearSceneEdge(blob, dimensions.width, dimensions.height) &&
            isolation.isolationRatio >= 1.45 &&
            isolation.ringBrightness <= 170 &&
            isolation.ringVariance <= 1600
          );
        });

  finalBlobs.forEach((blob, index) => {
    const isolation = analyzeLocalSeaIsolation(imageData, blob);
    if (isNearSceneEdge(blob, dimensions.width, dimensions.height)) {
      return;
    }

    const [latitude, longitude] = pixelToLatLon(
      blob.centerX,
      blob.centerY,
      dimensions.width,
      dimensions.height,
      bounds,
    );

    if (polygon.length >= 3 && !isInsidePolygon([latitude, longitude], polygon)) {
      return;
    }

    const shipMatch = chooseBestShipMatch(latitude, longitude, shipPositions);
    const confidence = scoreBlob(
      blob,
      dimensions.width,
      dimensions.height,
      threshold,
      isolation.isolationRatio,
      isolation.ringBrightness,
    );
    const detection: SARDetection = {
      id: `${scene.id || scene.sceneName || 'scene'}-${index}`,
      latitude,
      longitude,
      confidence,
      satellite: scene.sceneName || scene.processingLevel || 'Sentinel-1',
      timestamp: sceneTime,
      matchedMMSI: shipMatch?.mmsi ?? null,
      estimatedLength: blob.area >= 20 ? Math.round(Math.sqrt(blob.area) * 4) : undefined,
      estimatedType: shipMatch ? 'cargo' : undefined,
      sceneId: scene.id,
      source: 'sar-image',
      pixelX: blob.centerX,
      pixelY: blob.centerY,
      matchScore: shipMatch
        ? clamp(0.6 + confidence * 0.3 + shipMatch.spatialConfidence * 0.1, 0, 1)
        : 0,
      temporalDeltaMinutes: shipMatch
        ? Math.abs(shipMatch.timestamp.getTime() - sceneTime.getTime()) / 60000
        : undefined,
      spatialDeltaKm: shipMatch
        ? haversineKm(latitude, longitude, shipMatch.latitude, shipMatch.longitude)
        : undefined,
    };

    if (shipMatch) {
      matchedMMSI.add(shipMatch.mmsi);
      detections.push(detection);
      return;
    }

    detections.push(detection);
    darkVessels.push({
      ...detection,
      confidence: clamp(confidence + 0.1, 0, 1),
      matchedMMSI: null,
      source: 'sar-image',
    });
  });

  return { detections, darkVessels, matchedMMSI };
}

export function buildSarComparison(
  ships: AISShip[],
  detections: SARDetection[],
  darkVessels: SARDetection[],
) {
  const matchedMMSI = new Set(
    detections
      .map((detection) => detection.matchedMMSI)
      .filter((value): value is string => Boolean(value)),
  );

  return {
    summary: {
      totalAIS: ships.length,
      totalSARDetections: detections.length,
      matched: matchedMMSI.size,
      darkVessels: darkVessels.length,
      aisWithoutSAR: Math.max(0, ships.length - matchedMMSI.size),
    },
    matchedMMSI,
  };
}
