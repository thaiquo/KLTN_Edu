import { createContext, useEffect, useState } from 'react';
import { authApi } from '../api/auth';

export const AuthContext = createContext(null);
const TOKEN_KEY = 'educonnect_token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      if (!localStorage.getItem(TOKEN_KEY)) {
        if (active) setLoading(false);
        return;
      }

      try {
        const currentUser = await authApi.me();
        if (active) setUser(currentUser);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
      } finally {
        if (active) setLoading(false);
      }
    }

    restoreSession();
    return () => {
      active = false;
    };
  }, []);

  async function authenticate(request) {
    const result = await request();
    if (!result?.accessToken || !result?.user) {
      throw new Error('Phản hồi đăng nhập không hợp lệ.');
    }
    localStorage.setItem(TOKEN_KEY, result.accessToken);
    setUser(result.user);
    return result.user;
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login: (payload) => authenticate(() => authApi.login(payload)),
      register: (payload) => authenticate(() => authApi.register(payload)),
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}
