import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import { Link } from 'react-router-dom';
import type { OccupancyClass, ShelterStatus } from '../api/types';
import { classifyShelter } from '../lib/format';

export interface MapShelter {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  capacityTotal: number;
  capacityOccupied: number;
  status: ShelterStatus;
}

const COLORS: Record<OccupancyClass, string> = {
  AVAILABLE: '#16a34a',
  CRITICAL: '#f59e0b',
  FULL: '#dc2626',
  INACTIVE: '#6b7280',
};
const LABELS: Record<OccupancyClass, string> = {
  AVAILABLE: 'Available',
  CRITICAL: 'Critical (90%+)',
  FULL: 'Full',
  INACTIVE: 'Closed / inactive',
};

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13);
      return;
    }
    map.fitBounds(points as LatLngBoundsExpression, { padding: [40, 40], maxZoom: 14 });
  }, [map, points]);
  return null;
}

/** Leaflet map with CircleMarkers coloured by availability, computed from DB coordinates/occupancy. */
export function ShelterMap({
  shelters, height = 380, detailBase, highlightId, onSelect, userLocation,
}: {
  shelters: MapShelter[];
  height?: number;
  /** When set, popups link to `${detailBase}/${id}` (e.g. "/shelters" or "/admin/shelters"). */
  detailBase?: string;
  highlightId?: string | null;
  onSelect?: (id: string) => void;
  userLocation?: { lat: number; lon: number } | null;
}) {
  const points: [number, number][] = shelters.map((s) => [s.latitude, s.longitude]);
  if (userLocation) points.push([userLocation.lat, userLocation.lon]);

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">
      <div style={{ height }} className="relative z-0">
        <MapContainer center={[13.0, 80.22]} zoom={11} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <FitBounds points={points} />
          {shelters.map((s) => {
            const cls = classifyShelter(s);
            const pct = s.capacityTotal > 0 ? Math.round((s.capacityOccupied / s.capacityTotal) * 100) : 0;
            return (
              <CircleMarker
                key={s.id}
                center={[s.latitude, s.longitude]}
                radius={s.id === highlightId ? 15 : 11}
                pathOptions={{ color: s.id === highlightId ? '#1d4ed8' : '#ffffff', weight: s.id === highlightId ? 3 : 2, fillColor: COLORS[cls], fillOpacity: 0.9 }}
                eventHandlers={onSelect ? { click: () => onSelect(s.id) } : undefined}
              >
                <Popup>
                  <div className="text-sm">
                    <p className="font-semibold">{s.name}</p>
                    <p>
                      {LABELS[cls]} · {s.capacityOccupied}/{s.capacityTotal} beds ({pct}%)
                    </p>
                    {detailBase && (
                      <Link to={`${detailBase}/${s.id}`} className="text-blue-600 underline">
                        View details
                      </Link>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
          {userLocation && (
            <CircleMarker center={[userLocation.lat, userLocation.lon]} radius={8} pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#2563eb', fillOpacity: 1 }}>
              <Popup>You are here</Popup>
            </CircleMarker>
          )}
        </MapContainer>
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 px-4 py-2 text-xs text-gray-600 border-t border-gray-100" aria-label="Map legend">
        {(Object.keys(COLORS) as OccupancyClass[]).map((k) => (
          <li key={k} className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: COLORS[k] }} />
            {LABELS[k]}
          </li>
        ))}
      </ul>
    </div>
  );
}
