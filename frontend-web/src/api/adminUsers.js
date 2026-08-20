import { apiRequest } from './client';

export const adminUsersApi = {
  list: (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.role && params.role !== 'ALL') query.append('role', params.role);
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    const qs = query.toString();
    return apiRequest('/api/users/admin' + (qs ? `?${qs}` : ''));
  },
  detail: (userId) => apiRequest(`/api/users/admin/${userId}`),
  updateStatus: (userId, status) => apiRequest(`/api/users/admin/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  })
};
