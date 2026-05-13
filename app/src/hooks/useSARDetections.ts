import { useCallback, useEffect, useRef, useState } from 'react';
import type { AISShip, BoundingBox, SARDetection, SARScene } from '@/types';
import { analyzeSarScene, buildSarComparison } from '@/lib/sarRecognition';

function resolveApiBase() {
  return import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001';
}

function bboxQuery(bbox: BoundingBox) {
  return new URLSearchParams({
    minLat: String(bbox.minLat),
    maxLat: String(bbox.maxLat),
    minLon: String(bbox.minLon),
    maxLon: String(bbox.maxLon),
  }).toString();
}

function bboxKey(bbox: BoundingBox) {
  return `${bbox.minLat},${bbox.maxLat},${bbox.minLon},${bbox.maxLon}`;
}

type RawDetection = {
  id?: string;
  latitude?: number | string;
  longitude?: number | string;
  confidence?: number | string;
  satellite?: string;
  timestamp?: string | number;
  matchedMMSI?: string | null;
  estimatedLength?: number;
  estimatedType?: SARDetection['estimatedType'];
};

type ComparisonSummary = {
  totalAIS: number;
  totalSARDetections: number;
  matched: number;
  darkVessels: number;
  aisWithoutSAR: number;
};

type ComparisonResponse = {
  summary?: ComparisonSummary;
};

type SarAnalysisResult = Awaited<ReturnType<typeof analyzeSarScene>>;

function yieldToBrowser() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

function normalizeDetection(detection: RawDetection): SARDetection {
  return {
    id: detection.id || crypto.randomUUID(),
    latitude: Number(detection.latitude),
    longitude: Number(detection.longitude),
    confidence: Number(detection.confidence || 0),
    satellite: detection.satellite || 'Sentinel-1',
    timestamp: new Date(detection.timestamp || Date.now()),
    matchedMMSI: detection.matchedMMSI || null,
    estimatedLength: detection.estimatedLength,
    estimatedType: detection.estimatedType
  };
}

export function useSARDetections(ships: AISShip[], bbox: BoundingBox) {
  const [scenes, setScenes] = useState<SARScene[]>([]);
  const [detections, setDetections] = useState<SARDetection[]>([]);
  const [darkVessels, setDarkVessels] = useState<SARDetection[]>([]);
  const [comparison, setComparison] = useState<ComparisonSummary | null>(null);
  const refreshToken = useRef(0);
  const shipsRef = useRef<AISShip[]>(ships);
  const activeBboxKey = bboxKey(bbox);

  useEffect(() => {
    shipsRef.current = ships;
  }, [ships]);

  useEffect(() => {
    refreshToken.current += 1;
    const resetTimer = window.setTimeout(() => {
      setScenes([]);
      setDetections([]);
      setDarkVessels([]);
      setComparison(null);
    }, 0);

    return () => {
      window.clearTimeout(resetTimer);
    };
  }, [activeBboxKey]);

  const refresh = useCallback(async () => {
    const token = ++refreshToken.current;

    try {
      const [detectionsRes, comparisonRes] = await Promise.all([
        fetch(`${resolveApiBase()}/api/sar/detections?${bboxQuery(bbox)}`),
        fetch(`${resolveApiBase()}/api/comparison?${bboxQuery(bbox)}`)
      ]);

      const detectionData = (await detectionsRes.json()) as {
        scenes?: SARScene[];
        detections?: RawDetection[];
        darkVessels?: RawDetection[];
      };
      const comparisonData = (await comparisonRes.json()) as ComparisonResponse & Record<string, unknown>;

      if (refreshToken.current !== token) {
        return;
      }

      const nextScenes: SARScene[] = detectionData.scenes || [];
      setScenes(nextScenes);

      let nextDetections: SARDetection[] = [];
      let nextDarkVessels: SARDetection[] = [];
      let computedComparison: ComparisonSummary | null = null;

      if (nextScenes.length > 0) {
        const analyzedScenes: SarAnalysisResult[] = [];

        for (const scene of nextScenes) {
          if (refreshToken.current !== token) {
            return;
          }

          try {
            analyzedScenes.push(await analyzeSarScene(scene, shipsRef.current));
          } catch {
            analyzedScenes.push({ detections: [], darkVessels: [], matchedMMSI: new Set<string>() });
          }

          await yieldToBrowser();
        }

        if (refreshToken.current !== token) {
          return;
        }

        nextDetections = analyzedScenes.flatMap((result) => result.detections);
        nextDarkVessels = analyzedScenes.flatMap((result) => result.darkVessels);
        computedComparison = buildSarComparison(
          shipsRef.current,
          nextDetections,
          nextDarkVessels,
        ).summary;
      } else {
        nextDetections = (detectionData.detections || []).map(normalizeDetection);
        nextDarkVessels = (detectionData.darkVessels || []).map(normalizeDetection);
      }

      setDetections(nextDetections);
      setDarkVessels(nextDarkVessels);
      setComparison(
        computedComparison
          ? {
              ...(comparisonData.summary || {}),
              ...computedComparison
            }
          : (comparisonData.summary || null),
      );
    } catch {
      setComparison(null);
      setDetections([]);
      setDarkVessels([]);
    }
  }, [bbox]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refresh();
    }, 0);
    const interval = window.setInterval(refresh, 30000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [refresh]);

  return { scenes, detections, darkVessels, comparison, refresh };
}
