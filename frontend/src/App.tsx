import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';
import { ShelterFinder } from './pages/ShelterFinder';
import { CoordinatorDashboard } from './pages/CoordinatorDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { VolunteerDashboard } from './pages/VolunteerDashboard';
import { Reunification } from './pages/Reunification';
import { Login } from './pages/Login';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
          <Navbar />
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/shelters" element={<ShelterFinder />} />
            <Route path="/reunification" element={<Reunification />} />
            <Route path="/login" element={<Login />} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute allowedRoles={['COORDINATOR']} />}>
              <Route path="/coordinator" element={<CoordinatorDashboard />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
              <Route path="/admin" element={<AdminDashboard />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['VOLUNTEER']} />}>
              <Route path="/volunteer" element={<VolunteerDashboard />} />
            </Route>
            
            {/* Catch-all or 404 could go here */}
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
