import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState } from 'react';
import { authRequest, TOKEN_KEY } from './api';

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
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (!token) {
        if (active) setLoading(false);
        return;
      }

      try {
        const currentUser = await authRequest('/auth/me');
        if (active) setUser(currentUser);
      } catch {
        await AsyncStorage.removeItem(TOKEN_KEY);
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
    const result = await authRequest(path, payload);
    if (!result?.accessToken || !result?.user) {
      throw new Error('Phản hồi đăng nhập không hợp lệ.');
    }

    await AsyncStorage.setItem(TOKEN_KEY, result.accessToken);
    setUser(result.user);
    return result.user;
  }

  async function logout() {
    await AsyncStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login: (payload) => authenticate('/auth/login', payload),
      register: (payload) => authenticate('/auth/register', payload),
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}
