import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';
import DashboardHome from './DashboardHome.jsx';
import HospitalAdminDashboardPage from './hospitaladmin/DashboardPage.jsx';
import ConsultingDashboardPage from './consulting/DashboardPage.jsx';
import NurseDashboardPage from './nurse/DashboardPage.jsx';
import LabsDashboardPage from './labs/DashboardPage.jsx';
import PharmacyDashboardPage from './pharmacy/DashboardPage.jsx';
import ReceptionDashboardPage from './reception/DashboardPage.jsx';

const roleDashboards = {
  hospitaladmin: HospitalAdminDashboardPage,
  consulting: ConsultingDashboardPage,
  nurse: NurseDashboardPage,
  labs: LabsDashboardPage,
  pharmacy: PharmacyDashboardPage,
  reception: ReceptionDashboardPage,
};

export default function RoleDashboardPage() {
  const { role } = useParams();
  const { profile } = useAuth();

  if (role !== profile?.role) {
    return <Navigate to={`/dashboard/${profile?.role || ''}`} replace />;
  }

  const Dashboard = roleDashboards[role];
  return Dashboard ? <Dashboard /> : <DashboardHome />;
}
