import { apiRequest, clearCsrf } from './client';

export const authApi = {
  register: (payload) => apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ ...payload, confirmPassword: payload.confirmPassword || payload.password })
  }),
  login: (payload) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  me: () => apiRequest('/me'),
  logout: async () => {
    try { await apiRequest('/auth/logout', { method: 'POST' }); }
    finally { clearCsrf(); }
  }
};
