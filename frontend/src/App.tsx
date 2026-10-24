import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LangProvider } from './context/LangContext';
import { ToastProvider } from './components/ui';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicLayout } from './layouts/PublicLayout';
import { ConsoleLayout } from './layouts/ConsoleLayout';

import { HomePage } from './pages/public/HomePage';
import { ShelterFinderPage } from './pages/public/ShelterFinderPage';
import { ShelterDetailPage } from './pages/public/ShelterDetailPage';
import { RegisterPage } from './pages/public/RegisterPage';
import { LoginPage } from './pages/public/LoginPage';
import { AdminReportsPage } from './pages/admin/AdminReportsPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminAuditPage } from './pages/admin/AdminAuditPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { CoordinatorReportsPage } from './pages/coordinator/CoordinatorReportsPage';
import { EmergencyPage } from './pages/public/EmergencyPage';
import { AdminReunificationPage } from './pages/admin/AdminReunificationPage';
import { CoordinatorReunificationPage } from './pages/coordinator/CoordinatorReunificationPage';

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

import { AdminVolunteersPage } from './pages/admin/AdminVolunteersPage';
import { AdminMedicalPage } from './pages/admin/AdminMedicalPage';
import { AdminDonationsPage } from './pages/admin/AdminDonationsPage';
import { CoordinatorVolunteersPage } from './pages/coordinator/CoordinatorVolunteersPage';
import { CoordinatorMedicalPage } from './pages/coordinator/CoordinatorMedicalPage';
import { CoordinatorDonationsPage } from './pages/coordinator/CoordinatorDonationsPage';
import { VolunteerShiftsPage } from './pages/volunteer/VolunteerShiftsPage';
import { VolunteerMyShiftsPage } from './pages/volunteer/VolunteerMyShiftsPage';
import { VolunteerProfilePage } from './pages/volunteer/VolunteerProfilePage';

function App() {
  return (
    <ToastProvider>
      <LangProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/shelters" element={<ShelterFinderPage />} />
              <Route path="/shelters/:id" element={<ShelterDetailPage />} />
              <Route path="/shelters/:id/register" element={<RegisterPage />} />
              <Route path="/emergency" element={<EmergencyPage />} />
              <Route path="/reunification" element={<Navigate to="/emergency" replace />} />
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
                <Route path="volunteers" element={<AdminVolunteersPage />} />
                <Route path="medical" element={<AdminMedicalPage />} />
                <Route path="donations" element={<AdminDonationsPage />} />
                <Route path="reunification" element={<AdminReunificationPage />} />
                <Route path="reports" element={<AdminReportsPage />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="audit" element={<AdminAuditPage />} />
                <Route path="settings" element={<AdminSettingsPage />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['COORDINATOR']} />}>
              <Route path="/coordinator" element={<ConsoleLayout />}>
                <Route index element={<CoordinatorOverviewPage />} />
                <Route path="occupants" element={<CoordinatorOccupantsPage />} />
                <Route path="resources" element={<CoordinatorResourcesPage />} />
                <Route path="transfers" element={<CoordinatorTransfersPage />} />
                <Route path="alerts" element={<CoordinatorAlertsPage />} />
                <Route path="volunteers" element={<CoordinatorVolunteersPage />} />
                <Route path="medical" element={<CoordinatorMedicalPage />} />
                <Route path="donations" element={<CoordinatorDonationsPage />} />
                <Route path="reunification" element={<CoordinatorReunificationPage />} />
                <Route path="reports" element={<CoordinatorReportsPage />} />
                <Route path="shelter" element={<CoordinatorShelterPage />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['VOLUNTEER']} />}>
              <Route path="/volunteer" element={<ConsoleLayout />}>
                <Route index element={<VolunteerShiftsPage />} />
                <Route path="my-shifts" element={<VolunteerMyShiftsPage />} />
                <Route path="profile" element={<VolunteerProfilePage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      </LangProvider>
    </ToastProvider>
  );
}

export default App;
