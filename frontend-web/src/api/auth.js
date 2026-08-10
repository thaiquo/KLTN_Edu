import { apiRequest } from './client';

export const authApi = {
  register: (payload) => apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  verifyEmail: (payload) => apiRequest('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  login: (payload) => apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  logout: () => apiRequest('/api/auth/logout', {
    method: 'POST'
  }),
  csrf: () => apiRequest('/api/auth/csrf')
};
