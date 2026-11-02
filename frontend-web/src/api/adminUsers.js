import { apiRequest } from './client';
import { paginatedRequest } from './paginatedResponse';

export const adminUsersApi = {
  list: (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.role && params.role !== 'ALL') query.append('role', params.role);
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.page != null) query.append('page', String(params.page));
    if (params.size != null) query.append('size', String(params.size));
    const qs = query.toString();
    const endpoint = '/api/users/admin' + (qs ? `?${qs}` : '');
    return paginatedRequest(apiRequest(endpoint), endpoint);
  },
  stats: () => apiRequest('/api/users/admin/stats'),
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
