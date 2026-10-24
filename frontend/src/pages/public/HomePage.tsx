import { Link } from 'react-router-dom';
import { MapPin, Users, Home as HomeIcon, UserSearch } from 'lucide-react';
import { getPublicStats } from '../../api/shelters';
import { useLoad } from '../../hooks/useLoad';
import { RefreshBar } from '../../components/ui';

export function HomePage() {
  const { data: stats, loading, error, reload, loadedAt } = useLoad(getPublicStats, []);

  const tiles = [
    { label: 'Open shelters', value: stats?.openShelters, icon: HomeIcon, tone: 'bg-blue-100 text-blue-600' },
    { label: 'Beds available', value: stats?.availableCapacity, icon: Users, tone: 'bg-green-100 text-green-600' },
    { label: 'Shelters with space', value: stats?.sheltersWithSpace, icon: MapPin, tone: 'bg-amber-100 text-amber-600' },
  ];

  return (
    <div>
      <section className="bg-gradient-to-b from-blue-900 to-indigo-900 text-white">
        <div className="max-w-5xl mx-auto px-4 py-16 sm:py-24 text-center">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight">
            Find safety. <span className="text-blue-300">Coordinate relief.</span>
          </h1>
          <p className="mt-5 max-w-2xl mx-auto text-lg text-indigo-100">
            Flood-relief shelters across Chennai — see which have space, what they stock, and register your family before you arrive.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/shelters" className="inline-flex items-center justify-center gap-2 px-7 py-3 text-base font-semibold rounded-xl bg-white text-blue-900 hover:bg-blue-50">
              <MapPin className="h-5 w-5" /> Find a shelter
            </Link>
            <Link to="/emergency" className="inline-flex items-center justify-center gap-2 px-7 py-3 text-base font-semibold rounded-xl border border-indigo-300 hover:bg-indigo-800">
              <UserSearch className="h-5 w-5" /> Report a missing person
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 -mt-10 relative z-10">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="grid sm:grid-cols-3 gap-6">
            {tiles.map((t) => (
              <div key={t.label} className="flex items-center gap-4">
                <span className={`p-3 rounded-full ${t.tone}`}>
                  <t.icon className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-3xl font-extrabold text-gray-900">{loading && !stats ? '…' : (t.value ?? '—')}</p>
                  <p className="text-xs uppercase tracking-wide text-gray-500">{t.label}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-gray-100">
            {error ? <p className="text-sm text-red-600">{error}</p> : <RefreshBar asOf={loadedAt} onRefresh={reload} loading={loading} />}
          </div>
        </div>
      </section>
    </div>
  );
}
