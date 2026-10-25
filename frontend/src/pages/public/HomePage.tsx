import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, Users, Home as HomeIcon, UserSearch, Search, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { getPublicStats } from '../../api/shelters';
import { useLoad } from '../../hooks/useLoad';
import { RefreshBar } from '../../components/ui';

const STEPS = [
  { icon: Search, title: 'Find', text: 'Search shelters by name or area, or sort by distance from where you are.' },
  { icon: ShieldCheck, title: 'Check', text: 'See free beds, stocked supplies and medical support before you travel.' },
  { icon: ClipboardCheck, title: 'Register', text: 'Register your family in advance so the shelter can prepare for you.' },
];

export function HomePage() {
  const { data: stats, loading, error, reload, loadedAt } = useLoad(getPublicStats, []);

  const tiles = [
    { label: 'Open shelters', value: stats?.openShelters, icon: HomeIcon, tone: 'bg-blue-50 text-blue-700' },
    { label: 'Beds available', value: stats?.availableCapacity, icon: Users, tone: 'bg-emerald-50 text-emerald-700' },
    { label: 'Shelters with space', value: stats?.sheltersWithSpace, icon: MapPin, tone: 'bg-amber-50 text-amber-700' },
  ];

  return (
    <div>
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-950 via-blue-900 to-blue-700 text-white">
        <div aria-hidden className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-blue-400/20 blur-3xl" />
        <div aria-hidden className="absolute -bottom-32 left-1/4 h-80 w-80 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-32 sm:pt-24 sm:pb-40">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold ring-1 ring-white/20">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Chennai flood relief
          </span>
          <h1 className="mt-6 max-w-3xl text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05]">
            Find safety. <span className="text-blue-200">Coordinate relief.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-blue-100/90">
            See which shelters have space, what they stock, and register your family before you arrive.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-3">
            <Link to="/shelters" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-base font-semibold rounded-full bg-white text-blue-900 shadow-lg hover:bg-blue-50 transition-colors">
              <MapPin className="h-5 w-5" /> Find a shelter <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/emergency" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 text-base font-semibold rounded-full bg-white/10 ring-1 ring-white/30 hover:bg-white/20 transition-colors">
              <UserSearch className="h-5 w-5" /> Report a missing person
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 -mt-20 relative z-10">
        <div className="bg-white rounded-3xl shadow-xl ring-1 ring-gray-200/80 p-6 sm:p-8">
          <div className="grid sm:grid-cols-3 gap-6 sm:divide-x sm:divide-gray-100">
            {tiles.map((t) => (
              <div key={t.label} className="flex items-center gap-4 sm:pl-8 first:sm:pl-0">
                <span className={`grid h-14 w-14 place-items-center rounded-2xl ${t.tone}`}>
                  <t.icon className="h-7 w-7" />
                </span>
                <div>
                  <p className="text-4xl font-extrabold tracking-tight text-gray-900">{loading && !stats ? '…' : (t.value ?? '—')}</p>
                  <p className="text-sm font-medium text-gray-500">{t.label}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-100">
            {error ? <p className="text-sm text-red-600">{error}</p> : <RefreshBar asOf={loadedAt} onRefresh={reload} loading={loading} />}
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">How it works</h2>
        <p className="mt-2 text-gray-600">Three steps from searching to a bed.</p>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700">
                  <s.icon className="h-5 w-5" />
                </span>
                <span className="text-sm font-bold text-gray-300">0{i + 1}</span>
              </div>
              <h3 className="mt-4 text-lg font-bold text-gray-900">{s.title}</h3>
              <p className="mt-1 text-sm text-gray-600">{s.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
