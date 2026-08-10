import PortalApp from '../portal/App';
import { useAuth } from '../hooks/useAuth';

export function DashboardPage() {
  const { user, logout } = useAuth();
  const primaryRole = (user.roles?.[0] || 'STUDENT').toLowerCase();

  return (
    <PortalApp
      user={{
        ...user,
        role: primaryRole,
        currentRole: primaryRole
      }}
      onLogout={logout}
    />
  );
}
