import { apiRequest } from './client';

export const aiClassSearchApi = {
  analyze: (message) => apiRequest('/api/ai/classes/analyze', {
    method: 'POST',
    body: JSON.stringify({ message })
  }),
  ground: (requirement) => apiRequest('/api/ai/classes/ground', {
    method: 'POST',
    body: JSON.stringify({ requirement })
  }),
  match: (requirement, topK = 20) => apiRequest('/api/ai/classes/match', {
    method: 'POST',
    body: JSON.stringify({ requirement, topK })
  })
};
