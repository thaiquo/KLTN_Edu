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
      roles: Array.isArray(profile.roles) ? profile.roles : []
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
