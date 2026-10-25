import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthProvider';
import { LangProvider } from './context/LangProvider';
import { PageLoader, ToastProvider } from './components/ui';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicLayout } from './layouts/PublicLayout';
import { ConsoleLayout } from './layouts/ConsoleLayout';

import { HomePage } from './pages/public/HomePage';
const ShelterFinderPage = lazy(() => import('./pages/public/ShelterFinderPage').then((m) => ({ default: m.ShelterFinderPage })));
const ShelterDetailPage = lazy(() => import('./pages/public/ShelterDetailPage').then((m) => ({ default: m.ShelterDetailPage })));
const RegisterPage = lazy(() => import('./pages/public/RegisterPage').then((m) => ({ default: m.RegisterPage })));
import { LoginPage } from './pages/public/LoginPage';
const AdminReportsPage = lazy(() => import('./pages/admin/AdminReportsPage').then((m) => ({ default: m.AdminReportsPage })));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })));
const AdminAuditPage = lazy(() => import('./pages/admin/AdminAuditPage').then((m) => ({ default: m.AdminAuditPage })));
const AdminSettingsPage = lazy(() => import('./pages/admin/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage })));
const CoordinatorReportsPage = lazy(() => import('./pages/coordinator/CoordinatorReportsPage').then((m) => ({ default: m.CoordinatorReportsPage })));
const EmergencyPage = lazy(() => import('./pages/public/EmergencyPage').then((m) => ({ default: m.EmergencyPage })));
const AdminReunificationPage = lazy(() => import('./pages/admin/AdminReunificationPage').then((m) => ({ default: m.AdminReunificationPage })));
const CoordinatorReunificationPage = lazy(() => import('./pages/coordinator/CoordinatorReunificationPage').then((m) => ({ default: m.CoordinatorReunificationPage })));

const AdminOverviewPage = lazy(() => import('./pages/admin/AdminOverviewPage').then((m) => ({ default: m.AdminOverviewPage })));
const AdminSheltersPage = lazy(() => import('./pages/admin/AdminSheltersPage').then((m) => ({ default: m.AdminSheltersPage })));
const AdminShelterDetailPage = lazy(() => import('./pages/admin/AdminShelterDetailPage').then((m) => ({ default: m.AdminShelterDetailPage })));
const AdminOccupancyPage = lazy(() => import('./pages/admin/AdminOccupancyPage').then((m) => ({ default: m.AdminOccupancyPage })));
const AdminResourcesPage = lazy(() => import('./pages/admin/AdminResourcesPage').then((m) => ({ default: m.AdminResourcesPage })));

const AdminTransfersPage = lazy(() => import('./pages/admin/AdminTransfersPage').then((m) => ({ default: m.AdminTransfersPage })));
const AdminAlertsPage = lazy(() => import('./pages/admin/AdminAlertsPage').then((m) => ({ default: m.AdminAlertsPage })));
const CoordinatorTransfersPage = lazy(() => import('./pages/coordinator/CoordinatorTransfersPage').then((m) => ({ default: m.CoordinatorTransfersPage })));
const CoordinatorAlertsPage = lazy(() => import('./pages/coordinator/CoordinatorAlertsPage').then((m) => ({ default: m.CoordinatorAlertsPage })));
const CoordinatorOverviewPage = lazy(() => import('./pages/coordinator/CoordinatorOverviewPage').then((m) => ({ default: m.CoordinatorOverviewPage })));
const CoordinatorOccupantsPage = lazy(() => import('./pages/coordinator/CoordinatorOccupantsPage').then((m) => ({ default: m.CoordinatorOccupantsPage })));
const CoordinatorResourcesPage = lazy(() => import('./pages/coordinator/CoordinatorResourcesPage').then((m) => ({ default: m.CoordinatorResourcesPage })));
const CoordinatorShelterPage = lazy(() => import('./pages/coordinator/CoordinatorShelterPage').then((m) => ({ default: m.CoordinatorShelterPage })));

const AdminVolunteersPage = lazy(() => import('./pages/admin/AdminVolunteersPage').then((m) => ({ default: m.AdminVolunteersPage })));
const AdminMedicalPage = lazy(() => import('./pages/admin/AdminMedicalPage').then((m) => ({ default: m.AdminMedicalPage })));
const AdminDonationsPage = lazy(() => import('./pages/admin/AdminDonationsPage').then((m) => ({ default: m.AdminDonationsPage })));
const CoordinatorVolunteersPage = lazy(() => import('./pages/coordinator/CoordinatorVolunteersPage').then((m) => ({ default: m.CoordinatorVolunteersPage })));
const CoordinatorMedicalPage = lazy(() => import('./pages/coordinator/CoordinatorMedicalPage').then((m) => ({ default: m.CoordinatorMedicalPage })));
const CoordinatorDonationsPage = lazy(() => import('./pages/coordinator/CoordinatorDonationsPage').then((m) => ({ default: m.CoordinatorDonationsPage })));
const VolunteerShiftsPage = lazy(() => import('./pages/volunteer/VolunteerShiftsPage').then((m) => ({ default: m.VolunteerShiftsPage })));
const VolunteerMyShiftsPage = lazy(() => import('./pages/volunteer/VolunteerMyShiftsPage').then((m) => ({ default: m.VolunteerMyShiftsPage })));
const VolunteerProfilePage = lazy(() => import('./pages/volunteer/VolunteerProfilePage').then((m) => ({ default: m.VolunteerProfilePage })));

function App() {
  return (
    <ToastProvider>
      <LangProvider>
      <AuthProvider>
        <BrowserRouter>
          {/* Pages are split into per-route chunks; layouts render their own Suspense around <Outlet />. */}
          <Suspense fallback={<PageLoader />}>
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
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
      </LangProvider>
    </ToastProvider>
  );
}

export default App;
