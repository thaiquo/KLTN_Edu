import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/auth';
import { ApiError, isUnauthorized } from '../api/client';
import { userApi } from '../api/user';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const normalizeUser = useCallback((profile) => {
    if (!profile) return null;

    return {
      ...profile,
      roles: Array.isArray(profile.roles) ? profile.roles : [],
      activeRole: profile.activeRole || (Array.isArray(profile.roles) && profile.roles.length > 0 ? profile.roles[0] : null),
      hasStudentProfile: Boolean(profile.hasStudentProfile),
      hasTutorProfile: Boolean(profile.hasTutorProfile),
      tutorStatus: profile.tutorStatus || null
    };
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const profile = await userApi.getMe();
      const currentUser = normalizeUser(profile);
      setUser(currentUser);
      return currentUser;
    } catch (error) {
      setUser(null);

      if (isUnauthorized(error)) {
        return null;
      }

      throw error;
    }
  }, [normalizeUser]);

  useEffect(() => {
    let active = true;

    async function bootstrapUser() {
      try {
        const profile = await userApi.getMe();
        if (active) setUser(normalizeUser(profile));
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    bootstrapUser();

    return () => {
      active = false;
    };
  }, [normalizeUser]);

  useEffect(() => {
    function handleUnauthorized() {
      setUser(null);
    }

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  async function login(payload) {
    await authApi.login(payload);
    const currentUser = await refreshUser();

    if (!currentUser) {
      throw new ApiError({
        status: 401,
        message: 'Không thể xác nhận phiên đăng nhập. Vui lòng thử lại.'
      });
    }

    return currentUser;
  }

  async function switchRole(targetRole) {
    await authApi.switchRole({ targetRole });
    const currentUser = await refreshUser();
    return currentUser;
  }

  async function activateStudentProfile() {
    await userApi.activateStudent();
    const currentUser = await refreshUser();
    return currentUser;
  }

  async function logout() {
    await authApi.logout().catch(() => {});
    setUser(null);
  }

  const value = useMemo(() => ({
    user,
    authenticated: Boolean(user),
    loading,
    login,
    logout,
    switchRole,
    activateStudentProfile,
    refreshUser,
    register: authApi.register,
    verifyEmail: authApi.verifyEmail,
    resendVerificationOtp: authApi.resendVerificationOtp,
    forgotPassword: authApi.forgotPassword,
    resetPassword: authApi.resetPassword
  }), [user, loading, refreshUser]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
