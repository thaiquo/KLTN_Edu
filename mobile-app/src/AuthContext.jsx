import { createContext, useContext, useEffect, useState } from 'react';
import { authRequest } from './api';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      try {
        const currentUser = await authRequest('/api/users/me');
        if (active) setUser(currentUser);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    restoreSession();
    return () => {
      active = false;
    };
  }, []);

  async function authenticate(path, payload) {
    await authRequest(path, payload);
    const currentUser = await authRequest('/api/users/me');
    if (false) {
      throw new Error('Phản hồi đăng nhập không hợp lệ.');
    }

    setUser(currentUser);
    return currentUser;
  }

  async function logout() {
    await authRequest('/api/auth/logout', {}).catch(() => {});
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login: (payload) => authenticate('/api/auth/login', payload),
      register: (payload) => authenticate('/api/auth/register', payload),
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}
