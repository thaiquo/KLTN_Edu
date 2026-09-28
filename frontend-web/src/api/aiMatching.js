import { apiRequest } from './client';

export const aiMatchingApi = {
  analyze: (message) => apiRequest('/api/ai/matching/analyze', {
    method: 'POST',
    body: JSON.stringify({ message })
  }),
  ground: (requirement) => apiRequest('/api/ai/matching/ground', {
    method: 'POST',
    body: JSON.stringify({ requirement })
  }),
  matchTutors: (payload) => apiRequest('/api/ai/matching/tutors', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
};
