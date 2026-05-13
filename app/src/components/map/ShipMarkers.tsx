import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import type { AISShip } from '@/types';
import { shipTypeConfig } from '@/data/constants';
import { getMmsiFlagState } from '@/data/mmsiCountries';

interface ShipMarkersProps {
  ships: AISShip[];
  selectedMMSI: string | null;
  onSelectShip: (mmsi: string) => void;
  opacity?: number;
}

// Create ship icon SVG
function createShipIcon(type: string, course: number, isSelected: boolean, opacity: number): L.DivIcon {
  const config = shipTypeConfig[type as keyof typeof shipTypeConfig] || shipTypeConfig.other;
  const color = config.color;

  const size = isSelected ? 28 : 16;
  const triangleSize = isSelected ? 18 : 12;
  const center = size / 2;
  const strokeWidth = isSelected ? 3 : 1.5;
  const haloRadius = isSelected ? 11 : 0;

  // Triangle pointing in direction of travel
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform: rotate(${course}deg); overflow: visible;">
      ${isSelected ? `
        <circle
          cx="${center}"
          cy="${center}"
          r="${haloRadius}"
          fill="${color}"
          opacity="0.18"
        />
      ` : ''}
      <polygon 
        points="${center},${center - triangleSize / 2} ${center + triangleSize / 2},${center + triangleSize / 2} ${center - triangleSize / 2},${center + triangleSize / 2}" 
        fill="${color}" 
        stroke="white" 
        stroke-width="${strokeWidth}"
        opacity="${opacity}"
        filter="${isSelected ? 'url(#selectedShipGlow)' : 'none'}"
      />
      ${isSelected ? `
        <defs>
          <filter id="selectedShipGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="1.5" flood-color="${color}" flood-opacity="0.75" />
          </filter>
        </defs>
      ` : ''}
    </svg>
  `;
  
  return L.divIcon({
    html: svg,
    className: 'ship-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

// Create track line
function createTrackLine(track: { latitude: number; longitude: number }[]): L.Polyline {
  const latlngs = track.map(p => [p.latitude, p.longitude] as L.LatLngExpression);
  return L.polyline(latlngs, {
    color: '#06b6d4',
    weight: 1.5,
    opacity: 0.5,
    dashArray: '5, 5'
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatFlagStateLabel(state: { name: string } | null): string {
  return state?.name || 'Flag state unavailable';
}

export function ShipMarkers({ ships, selectedMMSI, onSelectShip, opacity = 0.9 }: ShipMarkersProps) {
  const map = useMap();
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const tracksRef = useRef<Map<string, L.Polyline>>(new Map());
  const markerStateRef = useRef<Map<string, { type: string; course: number; selected: boolean; opacity: number }>>(new Map());
  const previousSelectedRef = useRef<string | null>(null);
  
  // Create/update markers
  useEffect(() => {
    const currentMarkers = markersRef.current;
    const currentTracks = tracksRef.current;
    const currentMarkerState = markerStateRef.current;
    const newMarkers = new Map<string, L.Marker>();
    const newTracks = new Map<string, L.Polyline>();
    const newMarkerState = new Map<string, { type: string; course: number; selected: boolean; opacity: number }>();

    const selectedChanged = previousSelectedRef.current !== selectedMMSI;
    
    ships.forEach(ship => {
      const isSelected = ship.mmsi === selectedMMSI;
      const position: L.LatLngExpression = [ship.latitude, ship.longitude];
      const vesselFinderId = ship.imo || ship.mmsi;
      const vesselFinderUrl = `https://www.vesselfinder.com/vessels/details/${encodeURIComponent(vesselFinderId)}`;
      const flagState = getMmsiFlagState(ship.mmsi);
      const flagImage = flagState
        ? `https://flagcdn.com/w80/${flagState.iso2}.png`
        : null;
      const shipName = escapeHtml(ship.name);
      const shipMmsi = escapeHtml(ship.mmsi);
      const shipTypeLabel = escapeHtml(shipTypeConfig[ship.type]?.label || ship.type);
      const vesselFinderLabel = ship.imo ? 'Open by IMO on VesselFinder' : 'Open by MMSI on VesselFinder';
      const nextState = {
        type: ship.type,
        course: ship.course,
        selected: isSelected,
        opacity
      };
      
      // Create or update marker
      let marker = currentMarkers.get(ship.mmsi);
      
      if (marker) {
        const prevState = currentMarkerState.get(ship.mmsi);
        const needsPositionUpdate = marker.getLatLng().lat !== ship.latitude || marker.getLatLng().lng !== ship.longitude;
        const needsIconUpdate =
          !prevState ||
          prevState.type !== nextState.type ||
          prevState.course !== nextState.course ||
          prevState.selected !== nextState.selected ||
          prevState.opacity !== nextState.opacity ||
          selectedChanged;

        if (needsPositionUpdate) {
          marker.setLatLng(position);
        }

        if (needsIconUpdate) {
          marker.setIcon(createShipIcon(ship.type, ship.course, isSelected, opacity));
        }

        marker.setZIndexOffset(isSelected ? 1000 : 0);
      } else {
        // Create new marker
        marker = L.marker(position, {
          icon: createShipIcon(ship.type, ship.course, isSelected, opacity),
          zIndexOffset: isSelected ? 1000 : 0
        });
        
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectShip(ship.mmsi);
          marker?.openPopup();
        });
        
        // Popup with ship details
        marker.bindPopup(`
          <div class="ship-popup-card">
            <div class="ship-popup-header">
              <div class="ship-popup-flag-wrap">
                ${flagImage ? `<img class="ship-popup-flag" src="${flagImage}" alt="${escapeHtml(formatFlagStateLabel(flagState))} flag" />` : `<div class="ship-popup-flag ship-popup-flag-fallback">?</div>`}
              </div>
              <div class="ship-popup-titleblock">
                <p class="ship-popup-title">${shipName}</p>
                <p class="ship-popup-subtitle">${formatFlagStateLabel(flagState)}</p>
              </div>
            </div>

            <div class="ship-popup-topline">
              <span class="ship-popup-badge">${ship.imo ? 'IMO linked' : 'MMSI linked'}</span>
            </div>

            <div class="ship-popup-meta">
              <div>
                <span class="ship-popup-meta-label">MMSI</span>
                <span class="ship-popup-mono">${shipMmsi}</span>
              </div>
              <div>
                <span class="ship-popup-meta-label">Type</span>
                <span class="ship-popup-pill">${shipTypeLabel}</span>
              </div>
              <div>
                <span class="ship-popup-meta-label">Speed</span>
                <span class="ship-popup-value">${ship.speed.toFixed(1)} kn</span>
              </div>
              <div>
                <span class="ship-popup-meta-label">Course</span>
                <span class="ship-popup-value">${ship.course.toFixed(0)}°</span>
              </div>
            </div>

            <a
              href="${vesselFinderUrl}"
              target="_blank"
              rel="noopener noreferrer"
              class="ship-popup-cta"
            >
              ${escapeHtml(vesselFinderLabel)}
            </a>
          </div>
        `, {
          offset: [0, -10],
          closeButton: false,
          autoPan: true,
          autoPanPadding: [24, 24],
          closeOnClick: false,
          maxWidth: 320,
          className: 'ship-popup'
        });
        
        marker.addTo(map);
      }
      
      newMarkers.set(ship.mmsi, marker);
      newMarkerState.set(ship.mmsi, nextState);
      
      // Create or update track
      if (ship.track && ship.track.length > 1) {
        let track = currentTracks.get(ship.mmsi);
        
        if (track) {
          track.setLatLngs(ship.track.map(p => [p.latitude, p.longitude] as L.LatLngExpression));
        } else {
          track = createTrackLine(ship.track);
          track.addTo(map);
        }
        newTracks.set(ship.mmsi, track);
      }
    });
    
    // Remove markers for ships that no longer exist
    currentMarkers.forEach((marker, mmsi) => {
      if (!newMarkers.has(mmsi)) {
        marker.remove();
      }
    });
    
    // Remove tracks for ships that no longer exist
    currentTracks.forEach((track, mmsi) => {
      if (!newTracks.has(mmsi)) {
        track.remove();
      }
    });
    
    markersRef.current = newMarkers;
    tracksRef.current = newTracks;
    markerStateRef.current = newMarkerState;
    previousSelectedRef.current = selectedMMSI;
  }, [ships, selectedMMSI, onSelectShip, map, opacity]);

  useEffect(() => {
    markersRef.current.forEach((marker, mmsi) => {
      if (mmsi === selectedMMSI) {
        marker.openPopup();
      } else {
        marker.closePopup();
      }
    });
  }, [selectedMMSI]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach(marker => marker.remove());
      tracksRef.current.forEach(track => track.remove());
    };
  }, []);
  
  return null;
}
