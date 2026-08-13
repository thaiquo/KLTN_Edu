import PortalApp from '../portal/App';
import { useAuth } from '../hooks/useAuth';

export function DashboardPage() {
  const { user, logout } = useAuth();
  const primaryRole = resolvePrimaryPortalRole(user.roles);

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

function resolvePrimaryPortalRole(roles = []) {
  if (roles.includes('ADMIN')) return 'admin';
  if (roles.includes('STAFF')) return 'staff';
  if (roles.includes('TUTOR')) return 'tutor';
  return 'student';
}
