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
  resendVerificationOtp: (payload) => apiRequest('/api/auth/resend-verification-otp', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  login: (payload) => apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  switchRole: (payload) => apiRequest('/api/auth/switch-role', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  logout: () => apiRequest('/api/auth/logout', {
    method: 'POST'
  }),
  forgotPassword: (payload) => apiRequest('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  resetPassword: (payload) => apiRequest('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  csrf: () => apiRequest('/api/auth/csrf')
};
