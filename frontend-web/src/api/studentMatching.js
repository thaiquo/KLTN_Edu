import { apiRequest } from './client';

export const studentMatchingApi = {
  validateInput: (payload) => apiRequest('/api/learning/student-matching/input/validate', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
};
