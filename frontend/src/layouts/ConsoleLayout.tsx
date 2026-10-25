import { useState, Suspense } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { HeartPulse, LogOut, Menu, X, Globe2, User as UserIcon } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';
import { NAV } from '../nav';
import { PageLoader, StatusBadge } from '../components/ui';

const roleLabel = { ADMIN: 'Administrator', COORDINATOR: 'Coordinator', VOLUNTEER: 'Volunteer' } as const;

export function ConsoleLayout() {
  const { user, logout, selectedShelter, selectedShelterId, setSelectedShelterId } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  if (!user) return null;

  const items = NAV[user.role];
  const showShelterPicker = user.role === 'COORDINATOR' && user.managedShelters.length > 0;

  const sidebar = (
    <div className="flex h-full flex-col bg-gray-900 text-slate-100">
      <Link to="/" className="flex items-center gap-2 px-5 h-16 border-b border-slate-800">
        <span className="grid h-8 w-8 place-items-center bg-blue-600 rounded-xl">
          <HeartPulse className="h-5 w-5 text-white" />
        </span>
        <span className="text-lg font-extrabold tracking-tight">SafeHaven</span>
      </Link>

      {showShelterPicker && (
        <div className="px-4 py-3 border-b border-slate-800">
          <label htmlFor="shelter-picker" className="block text-[11px] uppercase tracking-wide text-slate-400 mb-1">
            Working shelter
          </label>
          {user.managedShelters.length > 1 ? (
            <select
              id="shelter-picker"
              value={selectedShelterId ?? ''}
              onChange={(e) => setSelectedShelterId(e.target.value)}
              className="w-full rounded-md bg-slate-800 border border-slate-700 text-sm px-2 py-1.5 text-white"
            >
              {user.managedShelters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm font-medium">{selectedShelter?.name}</p>
          )}
          {selectedShelter && (
            <div className="mt-1.5">
              <StatusBadge status={selectedShelter.status} />
            </div>
          )}
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Console">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
        <NavLink to="/shelters" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white">
          <Globe2 className="h-4 w-4" /> Public site
        </NavLink>
      </nav>

      <div className="border-t border-slate-800 p-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="p-2 bg-slate-800 rounded-full">
            <UserIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-slate-400">{roleLabel[user.role]}</p>
          </div>
        </div>
        <button
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
        >
          <LogOut className="h-4 w-4" /> Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      <aside className="hidden lg:block w-64 shrink-0 fixed inset-y-0">{sidebar}</aside>

      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between bg-slate-900 text-white px-4 h-14">
        <span className="font-bold flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-blue-400" /> SafeHaven
        </span>
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="p-2">
          <Menu className="h-6 w-6" />
        </button>
      </div>
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-gray-900/60" onClick={() => setOpen(false)} />
          <div className="relative w-72 max-w-[85%]">
            <button onClick={() => setOpen(false)} aria-label="Close menu" className="absolute top-3 right-3 text-white z-10">
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <main className="flex-1 lg:ml-64 min-w-0">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
