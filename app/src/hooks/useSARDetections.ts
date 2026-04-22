import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AISShip, SARDetection, SARScene } from '@/types';
import { analyzeSarScene, buildSarComparison } from '@/lib/sarRecognition';

function resolveApiBase() {
  return import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001';
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

export function useSARDetections(ships: AISShip[]) {
  const [scenes, setScenes] = useState<SARScene[]>([]);
  const [detections, setDetections] = useState<SARDetection[]>([]);
  const [darkVessels, setDarkVessels] = useState<SARDetection[]>([]);
  const [comparison, setComparison] = useState<ComparisonSummary | null>(null);
  const refreshToken = useRef(0);
  const shipsRef = useRef<AISShip[]>(ships);

  useEffect(() => {
    shipsRef.current = ships;
  }, [ships]);

  const refresh = useCallback(async () => {
    const token = ++refreshToken.current;

    try {
      const [detectionsRes, comparisonRes] = await Promise.all([
        fetch(`${resolveApiBase()}/api/sar/detections`),
        fetch(`${resolveApiBase()}/api/comparison`)
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
        const analyzedScenes = await Promise.all(
          nextScenes.map(async (scene) => {
            try {
              return await analyzeSarScene(scene, shipsRef.current);
            } catch {
              return { detections: [], darkVessels: [], matchedMMSI: new Set<string>() };
            }
          }),
        );

        if (refreshToken.current !== token) {
          return;
        }

        nextDetections = analyzedScenes.flatMap((result) =>
          result.detections.map(normalizeDetection),
        );
        nextDarkVessels = analyzedScenes.flatMap((result) =>
          result.darkVessels.map(normalizeDetection),
        );
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
  }, []);

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

export function useDarkVesselDetection() {
  const [darkVessels, setDarkVessels] = useState<SARDetection[]>([]);
  const [stats, setStats] = useState({
    totalAIS: 0,
    totalSAR: 0,
    matched: 0,
    darkVessels: 0,
    lastUpdate: null as Date | null
  });

  const refresh = useCallback(async () => {
    try {
      const [darkVesselRes, comparisonRes] = await Promise.all([
        fetch(`${resolveApiBase()}/api/dark-vessels`),
        fetch(`${resolveApiBase()}/api/comparison`)
      ]);
      const darkVesselData = await darkVesselRes.json();
      const comparisonData = await comparisonRes.json();
      const normalized = (darkVesselData.darkVessels || []).map(normalizeDetection);
      setDarkVessels(normalized);
      setStats({
        totalAIS: comparisonData.summary?.totalAIS || 0,
        totalSAR: comparisonData.summary?.totalSARDetections || normalized.length,
        matched: comparisonData.summary?.matched || 0,
        darkVessels: comparisonData.summary?.darkVessels || normalized.length,
        lastUpdate: darkVesselData.timestamp ? new Date(darkVesselData.timestamp) : new Date()
      });
    } catch {
      setDarkVessels([]);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refresh();
    }, 0);
    const interval = window.setInterval(refresh, 45000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, [refresh]);

  return useMemo(() => ({ darkVessels, stats }), [darkVessels, stats]);
}
