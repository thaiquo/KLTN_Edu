import { apiRequest } from './client';

export const staffTutorsApi = {
  pending: () => apiRequest('/api/staff/tutors/pending'),
  approve: (tutorId) => apiRequest(`/api/staff/tutors/${tutorId}/approve`, {
    method: 'PATCH'
  }),
  reject: (tutorId, reason) => apiRequest(`/api/staff/tutors/${tutorId}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ reason })
  })
};
