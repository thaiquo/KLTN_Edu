import { apiRequest } from './client';

export const tutorApi = {
  searchPublic: ({ keyword, subjectId, minRate, maxRate, limit } = {}) => {
    const params = new URLSearchParams();
    if (keyword?.trim()) params.set('keyword', keyword.trim());
    if (subjectId) params.set('subjectId', subjectId);
    if (minRate) params.set('minRate', minRate);
    if (maxRate) params.set('maxRate', maxRate);
    if (limit) params.set('limit', limit);
    const query = params.toString();

    return apiRequest(`/api/tutors${query ? `?${query}` : ''}`);
  },
  getPublicProfile: (tutorProfileId) => apiRequest(`/api/tutors/${tutorProfileId}`),
  getProfile: () => apiRequest('/api/tutors/profile'),
  createProfile: (payload) => apiRequest('/api/tutors/profile', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  updateProfile: (payload) => apiRequest('/api/tutors/profile', {
    method: 'PUT',
    body: JSON.stringify(payload)
  }),
  createRegistrationProfile: (payload) => apiRequest('/api/tutors/profile/registration', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
};
