import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './src/contexts/AuthContext.jsx';
import Landing from './src/pages/landing/landing.jsx';
import SignInPage from './src/pages/auth/signin.jsx';
import SignUpPage from './src/pages/auth/signup.jsx';
import HospitalSetupPage from './src/pages/auth/hospital-setup.jsx';
import DashboardLayout from './src/pages/dashboard/DashboardLayout.jsx';
import RoleDashboardPage from './src/pages/dashboard/RoleDashboardPage.jsx';
import ProfilePage from './src/pages/dashboard/ProfilePage.jsx';
import SettingsPage from './src/pages/dashboard/SettingsPage.jsx';
import StaffPage from './src/pages/dashboard/hospitaladmin/StaffPage.jsx';
import StaffDetailPage from './src/pages/dashboard/hospitaladmin/StaffDetailPage.jsx';
import PatientsPage from './src/pages/dashboard/reception/PatientsPage.jsx';
import PatientDetailPage from './src/pages/dashboard/reception/PatientDetailPage.jsx';
import VitalsPage from './src/pages/dashboard/nurse/VitalsPage.jsx';
import ConsultationsPage from './src/pages/dashboard/consulting/ConsultationsPage.jsx';
import LaboratoryPage from './src/pages/dashboard/labs/LaboratoryPage.jsx';
import PharmacyPage from './src/pages/dashboard/pharmacy/PharmacyPage.jsx';
import ProtectedRoute from './src/components/ProtectedRoute.jsx';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<SignInPage />} />
          <Route path="/signin" element={<Navigate to="/login" replace />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route
            path="/setup-hospital"
            element={
              <ProtectedRoute>
                <HospitalSetupPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/:role"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<RoleDashboardPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="staff/:staffId" element={<StaffDetailPage />} />
            <Route path="patients" element={<PatientsPage />} />
            <Route path="patients/:patientId" element={<PatientDetailPage />} />
            <Route path="vitals" element={<VitalsPage />} />
            <Route path="consultations" element={<ConsultationsPage />} />
            <Route path="lab-orders" element={<LaboratoryPage />} />
            <Route path="dispensing" element={<PharmacyPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
