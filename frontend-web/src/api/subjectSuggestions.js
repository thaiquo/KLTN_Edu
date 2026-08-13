import { apiRequest } from './client';

export const subjectSuggestionApi = {
  create: (payload) => apiRequest('/api/subject-suggestions', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  mine: () => apiRequest('/api/subject-suggestions/me'),
  staffPending: () => apiRequest('/api/staff/subject-suggestions/pending'),
  approveAsNew: (id) => apiRequest(`/api/staff/subject-suggestions/${id}/approve-new`, {
    method: 'PATCH'
  }),
  mapExisting: (id, payload) => apiRequest(`/api/staff/subject-suggestions/${id}/map-existing`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  }),
  reject: (id, reason) => apiRequest(`/api/staff/subject-suggestions/${id}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ reason })
  })
};
