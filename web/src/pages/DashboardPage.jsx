import PortalApp from '../portal/App';
import { useAuth } from '../hooks/useAuth';

export function DashboardPage() {
  const { user, logout } = useAuth();
  return <PortalApp user={user} onLogout={logout} />;
}
