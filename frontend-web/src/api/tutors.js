import { apiRequest } from './client';

export const tutorApi = {
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
