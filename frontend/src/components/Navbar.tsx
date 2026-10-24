import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, MapPin, ClipboardList, ShieldAlert, HeartPulse, LogOut, LogIn, User, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';

export const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="sticky top-0 z-50 w-full backdrop-blur-lg bg-white/80 border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600 rounded-lg">
              <HeartPulse className="h-6 w-6 text-white" />
            </div>
            <Link to="/">
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600 cursor-pointer">
                SafeHaven
              </span>
            </Link>
          </div>
          
          <div className="hidden md:flex items-center space-x-1">
            <Link
              to="/"
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                location.pathname === '/' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <Home className="h-4 w-4" /> Home
            </Link>
            <Link
              to="/shelters"
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                location.pathname === '/shelters' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <MapPin className="h-4 w-4" /> Find Shelter
            </Link>

            <Link
              to="/reunification"
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                location.pathname === '/reunification' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
            >
              <Users className="h-4 w-4" /> Missing Persons
            </Link>

            {user?.role === 'COORDINATOR' && (
              <Link
                to="/coordinator"
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                  location.pathname === '/coordinator' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <ClipboardList className="h-4 w-4" /> Coordinator
              </Link>
            )}

            {user?.role === 'ADMIN' && (
              <Link
                to="/admin"
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                  location.pathname === '/admin' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <ShieldAlert className="h-4 w-4" /> Admin
              </Link>
            )}

            {user?.role === 'VOLUNTEER' && (
              <Link
                to="/volunteer"
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                  location.pathname === '/volunteer' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <User className="h-4 w-4" /> Volunteer
              </Link>
            )}

            <div className="h-6 w-px bg-gray-300 mx-2" />

            {!user ? (
              <Link
                to="/login"
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors ml-2"
              >
                <LogIn className="h-4 w-4" /> Login
              </Link>
            ) : (
              <div className="flex items-center gap-4 ml-2">
                <div className="flex items-center gap-2 text-sm text-gray-700 font-medium">
                  <div className="p-1 bg-gray-100 rounded-full">
                    <User className="h-4 w-4 text-gray-500" />
                  </div>
                  {user.name} ({user.role})
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="h-4 w-4" /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
