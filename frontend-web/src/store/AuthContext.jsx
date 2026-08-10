import { createContext, useEffect, useState } from 'react';
import { authApi } from '../api/auth';

export const AuthContext = createContext(null);
const USER_KEY = 'educonnect_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = sessionStorage.getItem(USER_KEY);
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  async function login(payload) {
    const result = await authApi.login(payload);
    const currentUser = {
      id: result.userId,
      email: result.email,
      fullName: result.fullName,
      roles: result.roles || []
    };

    sessionStorage.setItem(USER_KEY, JSON.stringify(currentUser));
    setUser(currentUser);
    return currentUser;
  }

  async function logout() {
    await authApi.logout().catch(() => {});
    sessionStorage.removeItem(USER_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      register: authApi.register,
      verifyEmail: authApi.verifyEmail,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}
