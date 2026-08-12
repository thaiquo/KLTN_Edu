import { createContext, useCallback, useEffect, useState } from 'react';
import { authApi } from '../api/auth';

export const AuthContext = createContext(null);

function portalUser(account, activeRole) {
  const roles = (account.roles || []).map((role) => role.toLowerCase());
  const requested = activeRole?.toLowerCase();
  const preferred = roles.includes('admin')
    ? 'admin'
    : requested && roles.includes(requested)
      ? requested
      : roles.includes('student')
        ? 'student'
        : roles.includes('tutor')
          ? 'tutor'
          : 'student';
  return {
    ...account,
    fullName: account.profile?.fullName || account.email,
    phone: account.profile?.phone || '',
    avatar: account.profile?.avatarUrl || '',
    role: preferred,
    currentRole: preferred,
    roles
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const account = await authApi.me();
    const current = portalUser(account);
    setUser(current);
    return current;
  }, []);

  useEffect(() => {
    let active = true;
    authApi.me()
      .then((account) => active && setUser(portalUser(account)))
      .catch(() => active && setUser(null))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  async function login(payload) {
    const result = await authApi.login(payload);
    const current = portalUser(result.user, result.activeRole);
    setUser(current);
    return current;
  }

  async function register(payload) {
    await authApi.register(payload);
    return login({ email: payload.email, password: payload.password });
  }

  async function logout() {
    try { await authApi.logout(); }
    finally { setUser(null); }
  }

  return <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>{children}</AuthContext.Provider>;
}
