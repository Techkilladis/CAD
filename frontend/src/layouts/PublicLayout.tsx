import { useState, Suspense } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { HeartPulse, LogIn, LogOut, LayoutDashboard, Menu, X } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';
import { HOME_FOR_ROLE } from '../nav';
import { LANGS, useLang } from '../context/LangContext';
import { PageLoader } from '../components/ui';

function LangSwitch() {
  const { lang, setLang } = useLang();
  return (
    <div className="inline-flex rounded-full border border-gray-300 overflow-hidden bg-white" role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button key={l.code} onClick={() => setLang(l.code)} aria-pressed={lang === l.code} className={`px-3 py-1.5 text-xs font-semibold ${lang === l.code ? 'bg-blue-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
          {l.label}
        </button>
      ))}
    </div>
  );
}

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/shelters', label: 'Find Shelter' },
  { to: '/emergency', label: 'Emergency Info' },
];

export function PublicLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    clsx('px-3.5 py-2 rounded-full text-sm font-medium transition-colors', isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900');

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-gray-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center bg-blue-700 rounded-xl shadow-sm">
              <HeartPulse className="h-5 w-5 text-white" />
            </span>
            <span className="text-xl font-extrabold tracking-tight text-gray-900">Safe<span className="text-blue-600">Haven</span></span>
          </Link>

          <nav className="hidden md:flex items-center gap-1" aria-label="Main">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
                {l.label}
              </NavLink>
            ))}
            <span className="h-6 w-px bg-gray-300 mx-2" />
            <LangSwitch />
            <span className="h-6 w-px bg-gray-300 mx-2" />
            {user ? (
              <>
                <Link to={HOME_FOR_ROLE[user.role]} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-700 rounded-full hover:bg-blue-50">
                  <LayoutDashboard className="h-4 w-4" /> My console
                </Link>
                <button
                  onClick={() => {
                    logout();
                    navigate('/');
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 rounded-full hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" /> Log out
                </button>
              </>
            ) : (
              <Link to="/login" className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-gray-900 rounded-full hover:bg-gray-800">
                <LogIn className="h-4 w-4" /> Staff login
              </Link>
            )}
          </nav>

          <button className="md:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100" onClick={() => setOpen(!open)} aria-label="Toggle menu" aria-expanded={open}>
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        {open && (
          <nav className="md:hidden border-t border-gray-100 px-4 py-3 flex flex-col gap-1" aria-label="Mobile">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={linkClass} onClick={() => setOpen(false)}>
                {l.label}
              </NavLink>
            ))}
            <div className="px-3 py-2"><LangSwitch /></div>
            {user ? (
              <Link to={HOME_FOR_ROLE[user.role]} onClick={() => setOpen(false)} className="px-3 py-2 text-sm font-medium text-blue-700">
                My console
              </Link>
            ) : (
              <Link to="/login" onClick={() => setOpen(false)} className="px-3 py-2 text-sm font-medium text-blue-700">
                Staff login
              </Link>
            )}
          </nav>
        )}
      </header>
      <main className="flex-1">
        <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
      </main>
      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500">
          <span className="inline-flex items-center gap-2 font-semibold text-gray-700"><HeartPulse className="h-4 w-4 text-blue-600" /> SafeHaven</span>
          <span>Local prototype · Information shown is the latest recorded status, not live data.</span>
        </div>
      </footer>
    </div>
  );
}
