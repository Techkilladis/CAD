import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/ui';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicLayout } from './layouts/PublicLayout';
import { ConsoleLayout } from './layouts/ConsoleLayout';

import { HomePage } from './pages/public/HomePage';
import { ShelterFinderPage } from './pages/public/ShelterFinderPage';
import { ShelterDetailPage } from './pages/public/ShelterDetailPage';
import { RegisterPage } from './pages/public/RegisterPage';
import { LoginPage } from './pages/public/LoginPage';
import { Reunification } from './pages/Reunification';

import { AdminOverviewPage } from './pages/admin/AdminOverviewPage';
import { AdminSheltersPage } from './pages/admin/AdminSheltersPage';
import { AdminShelterDetailPage } from './pages/admin/AdminShelterDetailPage';
import { AdminOccupancyPage } from './pages/admin/AdminOccupancyPage';
import { AdminResourcesPage } from './pages/admin/AdminResourcesPage';

import { AdminTransfersPage } from './pages/admin/AdminTransfersPage';
import { AdminAlertsPage } from './pages/admin/AdminAlertsPage';
import { CoordinatorTransfersPage } from './pages/coordinator/CoordinatorTransfersPage';
import { CoordinatorAlertsPage } from './pages/coordinator/CoordinatorAlertsPage';
import { CoordinatorOverviewPage } from './pages/coordinator/CoordinatorOverviewPage';
import { CoordinatorOccupantsPage } from './pages/coordinator/CoordinatorOccupantsPage';
import { CoordinatorResourcesPage } from './pages/coordinator/CoordinatorResourcesPage';
import { CoordinatorShelterPage } from './pages/coordinator/CoordinatorShelterPage';

import { VolunteerDashboard } from './pages/VolunteerDashboard';

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/shelters" element={<ShelterFinderPage />} />
              <Route path="/shelters/:id" element={<ShelterDetailPage />} />
              <Route path="/shelters/:id/register" element={<RegisterPage />} />
              <Route path="/reunification" element={<Reunification />} />
              <Route path="/login" element={<LoginPage />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
              <Route path="/admin" element={<ConsoleLayout />}>
                <Route index element={<AdminOverviewPage />} />
                <Route path="shelters" element={<AdminSheltersPage />} />
                <Route path="shelters/:id" element={<AdminShelterDetailPage />} />
                <Route path="occupancy" element={<AdminOccupancyPage />} />
                <Route path="resources" element={<AdminResourcesPage />} />
                <Route path="transfers" element={<AdminTransfersPage />} />
                <Route path="alerts" element={<AdminAlertsPage />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['COORDINATOR']} />}>
              <Route path="/coordinator" element={<ConsoleLayout />}>
                <Route index element={<CoordinatorOverviewPage />} />
                <Route path="occupants" element={<CoordinatorOccupantsPage />} />
                <Route path="resources" element={<CoordinatorResourcesPage />} />
                <Route path="transfers" element={<CoordinatorTransfersPage />} />
                <Route path="alerts" element={<CoordinatorAlertsPage />} />
                <Route path="shelter" element={<CoordinatorShelterPage />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['VOLUNTEER']} />}>
              <Route path="/volunteer" element={<ConsoleLayout />}>
                <Route index element={<VolunteerDashboard />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
