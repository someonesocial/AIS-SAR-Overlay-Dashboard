import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AISShip, SARDetection, SARScene } from '@/types';
import { analyzeSarScene, buildSarComparison } from '@/lib/sarRecognition';

function resolveApiBase() {
  return import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001';
}

function normalizeDetection(detection: any): SARDetection {
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
  const [comparison, setComparison] = useState<any>(null);
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

      const detectionData = await detectionsRes.json();
      const comparisonData = await comparisonRes.json();
      const nextScenes: SARScene[] = detectionData.scenes || [];

      if (refreshToken.current !== token) {
        return;
      }

      setScenes(nextScenes);

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

      const analyzedDetections = analyzedScenes.flatMap((result) =>
        result.detections.map(normalizeDetection),
      );
      const analyzedDarkVessels = analyzedScenes.flatMap((result) =>
        result.darkVessels.map(normalizeDetection),
      );
      const comparisonSummary = buildSarComparison(
        shipsRef.current,
        analyzedDetections,
        analyzedDarkVessels,
      ).summary;

      setDetections(analyzedDetections);
      setDarkVessels(analyzedDarkVessels);
      setComparison(
        comparisonData.summary
          ? { ...comparisonData.summary, ...comparisonSummary }
          : comparisonSummary,
      );
    } catch {
      setComparison(null);
      setDetections([]);
      setDarkVessels([]);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 30000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  return { scenes, detections, darkVessels, comparison, refresh };
}

export function useDarkVesselDetection(_ships: AISShip[]) {
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
    refresh();
    const interval = window.setInterval(refresh, 45000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  return useMemo(() => ({ darkVessels, stats }), [darkVessels, stats]);
}
