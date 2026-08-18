import { apiRequest } from './client';

export const classApi = {
  // Tutor endpoints
  getMyClasses: (status) => {
    const params = status ? `?status=${status}` : '';
    return apiRequest(`/api/learning/tutor/classes${params}`);
  },
  getMyClassStats: () => apiRequest('/api/learning/tutor/classes/stats'),
  getClassById: (id) => apiRequest(`/api/learning/tutor/classes/${id}`),
  createClass: (payload) => apiRequest('/api/learning/tutor/classes', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  deleteClass: (id) => apiRequest(`/api/learning/tutor/classes/${id}`, {
    method: 'DELETE'
  }),
  getAvailability: () => apiRequest('/api/learning/tutor/availability'),
  saveAvailability: (slots) => apiRequest('/api/learning/tutor/availability', {
    method: 'POST',
    body: JSON.stringify({ slots })
  }),

  // Admin / Staff endpoints
  adminGetAllClasses: (filterParams = {}) => {
    const params = new URLSearchParams();
    if (filterParams.status && filterParams.status !== 'ALL') params.set('status', filterParams.status);
    if (filterParams.tutorEmail) params.set('tutorEmail', filterParams.tutorEmail);
    if (filterParams.subjectId) params.set('subjectId', String(filterParams.subjectId));
    if (filterParams.keyword) params.set('keyword', filterParams.keyword);
    const queryString = params.toString();
    return apiRequest(`/api/learning/admin/classes${queryString ? `?${queryString}` : ''}`);
  },
  adminGetClassStats: () => apiRequest('/api/learning/admin/classes/stats'),
  adminGetClassById: (id) => apiRequest(`/api/learning/admin/classes/${id}`),
  adminApproveClass: (id) => apiRequest(`/api/learning/admin/classes/${id}/approve`, {
    method: 'POST'
  }),
  adminRejectClass: (id, reason) => apiRequest(`/api/learning/admin/classes/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  })
};
