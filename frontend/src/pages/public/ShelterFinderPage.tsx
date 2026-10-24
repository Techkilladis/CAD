import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LocateFixed, Stethoscope } from 'lucide-react';
import { listShelters, nearestShelters } from '../../api/shelters';
import type { PublicShelter, ResourceType, ShelterStatus } from '../../api/types';
import { RESOURCE_TYPES } from '../../api/types';
import { useLoad } from '../../hooks/useLoad';
import { Button, Checkbox, EmptyState, ErrorState, PageLoader, RefreshBar, SearchInput, Select, StatusBadge, useToast } from '../../components/ui';
import { OccupancyBar } from '../../components/OccupancyBar';
import { ShelterMap } from '../../features/ShelterMap';
import { RESOURCE_LABEL } from '../../lib/format';

type GeoState = 'idle' | 'locating' | 'denied' | 'unavailable' | 'ok';

export function ShelterFinderPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [hasSpace, setHasSpace] = useState(false);
  const [resource, setResource] = useState<ResourceType | ''>('');
  const [status, setStatus] = useState<ShelterStatus | ''>('');
  const [geo, setGeo] = useState<GeoState>('idle');
  const [here, setHere] = useState<{ lat: number; lon: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const { data, loading, error, reload, loadedAt } = useLoad<PublicShelter[]>(
    () =>
      here
        ? nearestShelters(here.lat, here.lon, hasSpace).then((rows) =>
            rows.filter(
              (s) =>
                (!debouncedQ || `${s.name} ${s.address}`.toLowerCase().includes(debouncedQ.toLowerCase())) &&
                (!resource || s.resources.some((r) => r.resourceType === resource && r.stockStatus !== 'EMPTY')) &&
                (!status || s.status === status)
            )
          )
        : listShelters({ q: debouncedQ || undefined, minAvailable: hasSpace ? 1 : undefined, resource: resource || undefined, status: status || undefined }),
    [debouncedQ, hasSpace, resource, status, here]
  );

  const locate = () => {
    if (!('geolocation' in navigator)) {
      setGeo('unavailable');
      return;
    }
    setGeo('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHere({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGeo('ok');
      },
      (err) => {
        setGeo(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
        toast.error(err.code === err.PERMISSION_DENIED ? 'Location permission denied. You can still search by name or area.' : 'Your location could not be determined.');
      },
      { timeout: 10000 }
    );
  };

  const clearLocation = () => {
    setHere(null);
    setGeo('idle');
  };

  const list = data ?? [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Find a shelter</h1>
        <p className="text-gray-600 mt-1">Search relief shelters, check free beds and supplies, then register your family.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 space-y-3">
        <div className="grid md:grid-cols-4 gap-3 items-end">
          <SearchInput value={q} onChange={setQ} placeholder="Search by name or area" className="md:col-span-2" />
          <Select label="Has supply" value={resource} onChange={(e) => setResource(e.target.value as ResourceType | '')}>
            <option value="">Any</option>
            {RESOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {RESOURCE_LABEL[t]}
              </option>
            ))}
          </Select>
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as ShelterStatus | '')}>
            <option value="">Any open</option>
            <option value="ACTIVE">Active</option>
            <option value="FULL">Full</option>
            <option value="EMERGENCY_CLOSED">Emergency closed</option>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Checkbox label="Only shelters with free beds" checked={hasSpace} onChange={setHasSpace} />
          <Button variant="secondary" size="sm" icon={<LocateFixed className="h-4 w-4" />} loading={geo === 'locating'} onClick={locate}>
            Use my location
          </Button>
          {here && (
            <button onClick={clearLocation} className="text-xs text-blue-600 underline">
              Clear location (sort by name)
            </button>
          )}
          {geo === 'denied' && <span className="text-xs text-amber-700">Location access was denied — showing all shelters.</span>}
          {geo === 'unavailable' && <span className="text-xs text-amber-700">Location is unavailable on this device — showing all shelters.</span>}
          <div className="ml-auto">
            <RefreshBar asOf={loadedAt} onRefresh={reload} loading={loading} />
          </div>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <PageLoader label="Finding shelters…" />}

      {data && (
        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-3 order-2 lg:order-1">
            {list.length === 0 && (
              <EmptyState
                title={hasSpace && here ? 'No shelters with free beds nearby' : 'No shelters match your search'}
                message="Try removing a filter, or check again shortly — availability changes as families check in."
              />
            )}
            {list.map((s) => (
              <article
                key={s.id}
                onMouseEnter={() => setSelected(s.id)}
                className={`bg-white border rounded-xl p-4 transition-shadow hover:shadow-md ${selected === s.id ? 'border-blue-400' : 'border-gray-200'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold text-gray-900">{s.name}</h2>
                    <p className="text-xs text-gray-500 mt-0.5">{s.address}</p>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
                  {s.distance !== undefined && <span className="font-medium text-blue-700">{s.distance} km away</span>}
                  <span>{s.availableCapacity} beds free</span>
                  {s.medicalSupport && (
                    <span className="inline-flex items-center gap-1 text-green-700">
                      <Stethoscope className="h-3.5 w-3.5" /> Medical support
                    </span>
                  )}
                </div>
                <OccupancyBar occupied={s.capacityOccupied} total={s.capacityTotal} className="mt-3" />
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {s.resources.map((r) => (
                    <span key={r.resourceType} className="inline-flex items-center gap-1 text-xs bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5">
                      {RESOURCE_LABEL[r.resourceType]} <StatusBadge status={r.stockStatus} className="!px-1.5 !py-0" />
                    </span>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <Link to={`/shelters/${s.id}`} className="inline-flex px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 hover:bg-gray-50">
                    View details
                  </Link>
                  {(s.status === 'ACTIVE') && s.availableCapacity > 0 && (
                    <Button size="sm" onClick={() => navigate(`/shelters/${s.id}/register`)}>
                      Register family
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
          <div className="lg:col-span-3 order-1 lg:order-2 lg:sticky lg:top-20 self-start">
            <ShelterMap shelters={list} height={520} detailBase="/shelters" highlightId={selected} onSelect={setSelected} userLocation={here} />
          </div>
        </div>
      )}
    </div>
  );
}
