import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { api } from '../api/client';
import { secureSession } from '../storage/secureSession';
import { RealtimeClient } from '../realtime/RealtimeClient';
import type { MobileSession, UserProfile } from '../types/session';
import { pendingOperationStore } from '../wallet/pendingOperation';

type State = { user: UserProfile | null; restoring: boolean; error: string | null };
type AuthContextValue = State & {
  login(email: string, password: string, tutorMode: boolean): Promise<void>;
  switchRole(targetRole: 'STUDENT' | 'TUTOR'): Promise<void>;
  logout(): Promise<void>;
  retry(): Promise<void>;
  refreshUser(): Promise<UserProfile>;
  realtime: RealtimeClient;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ user: null, restoring: true, error: null });
  const realtime = useMemo(() => new RealtimeClient(), []);

  const loadUser = useCallback(async () => {
    const user = await api.request<UserProfile>('/api/users/me');
    realtime.setToken(api.getToken());
    setState({ user, restoring: false, error: null });
    void pendingOperationStore.reconcile(user.id);
    return user;
  }, [realtime]);

  const restore = useCallback(async () => {
    setState(current => ({ ...current, restoring: true, error: null }));
    try {
      if (!api.getToken()) await api.refresh();
      await loadUser();
    } catch (error) {
      const refresh = await secureSession.readRefresh().catch(() => null);
      setState({ user: null, restoring: false,
        error: refresh ? (error instanceof Error ? error.message : 'Không thể kết nối máy chủ.') : null });
    }
  }, [loadUser]);

  useEffect(() => {
    api.onSessionLost = () => { realtime.setToken(null); setState({ user: null, restoring: false, error: null }); };
    api.onTokenChanged = token => realtime.setToken(token);
    void restore();
    const lifecycle = AppState.addEventListener('change', state => {
      if (state === 'active' && api.getToken()) void loadUser().catch(() => {});
    });
    return () => { lifecycle.remove(); api.onSessionLost = null; api.onTokenChanged = null; realtime.dispose(); };
  }, [loadUser, realtime, restore]);

  const value: AuthContextValue = {
    ...state,
    realtime,
    retry: restore,
    refreshUser: loadUser,
    async login(email, password, tutorMode) {
      const session = await api.request<MobileSession>('/api/auth/mobile/login', {
        method: 'POST', body: JSON.stringify({ email, password, tutorMode }), skipRefresh: true, anonymous: true,
      });
      await api.setSession(session);
      await loadUser();
    },
    async switchRole(targetRole) {
      const performSwitch = async () => {
        const refreshToken = await secureSession.readRefresh();
        if (!refreshToken) throw new Error('Phiên đăng nhập đã hết hạn.');
        return api.request<MobileSession>('/api/auth/mobile/switch-role', {
          method: 'POST', headers: { 'X-Mobile-Refresh-Token': refreshToken },
          body: JSON.stringify({ targetRole }), skipRefresh: true,
        });
      };
      let session: MobileSession;
      try { session = await performSwitch(); }
      catch (error) {
        if (!(error instanceof Error) || !('status' in error) || error.status !== 401) throw error;
        await api.refresh();
        session = await performSwitch();
      }
      await api.setSession(session);
      await loadUser();
    },
    async logout() {
      const refreshToken = await secureSession.readRefresh().catch(() => null);
      try {
        if (refreshToken) await api.request('/api/auth/mobile/logout', {
          method: 'POST', body: JSON.stringify({ refreshToken }), skipRefresh: true, anonymous: true,
        });
      } finally {
        realtime.setToken(null);
        await api.clearSession();
        setState({ user: null, restoring: false, error: null });
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider is required');
  return context;
}
