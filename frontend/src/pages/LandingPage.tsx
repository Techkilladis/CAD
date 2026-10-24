import { Link } from 'react-router-dom';
import { MapPin, ShieldAlert, Users, Package } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getDashboardStats } from '../api/client';

export const LandingPage = () => {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    getDashboardStats().then(res => setStats(res.data)).catch(console.error);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <main className="flex-grow">
        {/* Hero Section */}
        <div className="relative overflow-hidden bg-gradient-to-b from-blue-900 to-indigo-900 text-white">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1547683905-f686c993aae5?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80')] opacity-20 bg-cover bg-center" />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-40 text-center">
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
              Find Safety. <span className="text-blue-400">Coordinate Relief.</span> Save Lives.
            </h1>
            <p className="mt-4 max-w-2xl text-xl text-indigo-100 mx-auto mb-10">
              SafeHaven is a flood-relief coordination platform connecting displaced families with available shelters while empowering relief coordinators.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link to="/shelters" className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-lg font-medium rounded-xl text-blue-900 bg-white hover:bg-gray-50 transition-all shadow-lg hover:shadow-xl">
                <MapPin className="mr-2 h-5 w-5" />
                Find a Shelter
              </Link>
              <Link to="/coordinator" className="inline-flex items-center justify-center px-8 py-4 border border-indigo-400 text-lg font-medium rounded-xl text-white hover:bg-indigo-800 transition-all">
                Coordinator Login
              </Link>
              <Link to="/admin" className="inline-flex items-center justify-center px-8 py-4 border border-indigo-400 text-lg font-medium rounded-xl text-white hover:bg-indigo-800 transition-all">
                Admin Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative z-10">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="flex flex-col items-center text-center">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-full mb-4">
                  <HomeIcon className="h-6 w-6" />
                </div>
                <dt className="text-sm font-medium text-gray-500 uppercase tracking-wide">Active Shelters</dt>
                <dd className="mt-2 text-4xl font-extrabold text-gray-900">{stats?.totalShelters || '-'}</dd>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="p-3 bg-green-100 text-green-600 rounded-full mb-4">
                  <Users className="h-6 w-6" />
                </div>
                <dt className="text-sm font-medium text-gray-500 uppercase tracking-wide">Available Capacity</dt>
                <dd className="mt-2 text-4xl font-extrabold text-gray-900">{stats?.totalAvailableCapacity || '-'}</dd>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="p-3 bg-red-100 text-red-600 rounded-full mb-4">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <dt className="text-sm font-medium text-gray-500 uppercase tracking-wide">Critical Alerts</dt>
                <dd className="mt-2 text-4xl font-extrabold text-gray-900">{stats?.lowStockAlerts?.length || 0}</dd>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="p-3 bg-purple-100 text-purple-600 rounded-full mb-4">
                  <Package className="h-6 w-6" />
                </div>
                <dt className="text-sm font-medium text-gray-500 uppercase tracking-wide">Pending Transfers</dt>
                <dd className="mt-2 text-4xl font-extrabold text-gray-900">{stats?.pendingTransfers?.length || 0}</dd>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const HomeIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);
