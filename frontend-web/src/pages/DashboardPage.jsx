import PortalApp from '../portal/App';
import { useAuth } from '../hooks/useAuth';

export function DashboardPage() {
  const { user, logout } = useAuth();
  const primaryRole = resolvePortalRole(user);

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

function resolvePortalRole(user = {}) {
  const activeRole = user.activeRole?.toLowerCase();
  if (['admin', 'staff', 'tutor', 'student'].includes(activeRole)) return activeRole;

  const roles = user.roles || [];
  if (roles.includes('ADMIN')) return 'admin';
  if (roles.includes('STAFF')) return 'staff';
  if (roles.includes('TUTOR')) return 'tutor';
  return 'student';
}
