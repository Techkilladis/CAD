import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PageLoader } from './ui/Spinner';
import type { Role } from '../api/types';

export const ProtectedRoute = ({ allowedRoles }: { allowedRoles?: Role[] }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <ShieldAlert className="h-16 w-16 text-red-500 mb-4" />
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Access denied</h1>
        <p className="text-gray-500 max-w-md">
          Your role ({user.role.toLowerCase()}) cannot open this page. Contact your district administrator if you believe this is a mistake.
        </p>
      </div>
    );
  }
  return <Outlet />;
};
