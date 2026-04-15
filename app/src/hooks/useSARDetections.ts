import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AISShip, SARDetection, SARScene } from '@/types';

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

  const refresh = useCallback(async () => {
    try {
      const [detectionsRes, comparisonRes] = await Promise.all([
        fetch(`${resolveApiBase()}/api/sar/detections`),
        fetch(`${resolveApiBase()}/api/comparison`)
      ]);

      const detectionData = await detectionsRes.json();
      const comparisonData = await comparisonRes.json();

      setScenes(detectionData.scenes || []);
      setDetections((detectionData.detections || []).map(normalizeDetection));
      setDarkVessels((detectionData.darkVessels || []).map(normalizeDetection));
      setComparison(comparisonData.summary || comparisonData);
    } catch {
      setComparison(null);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 30000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (ships.length > 0 && detections.length === 0) {
      refresh();
    }
  }, [ships.length, detections.length, refresh]);

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
