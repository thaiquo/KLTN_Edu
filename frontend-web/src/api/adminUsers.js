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
  createStaff: (payload) => apiRequest('/api/users/admin/staff', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  updateStatus: (userId, status) => apiRequest(`/api/users/admin/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  }),
  deleteUser: (userId) => apiRequest(`/api/users/admin/${userId}`, {
    method: 'DELETE'
  })
};
