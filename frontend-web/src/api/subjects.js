import { apiRequest } from './client';

export const subjectApi = {
  list: ({ categoryId, groupId, keyword, limit } = {}) => {
    const params = new URLSearchParams();
    if (categoryId) params.set('categoryId', categoryId);
    if (groupId) params.set('groupId', groupId);
    if (keyword) params.set('keyword', keyword);
    if (limit) params.set('limit', limit);
    const query = params.toString();

    return apiRequest(`/api/learning/subjects${query ? `?${query}` : ''}`);
  },
  categories: () => apiRequest('/api/learning/subjects/categories'),
  groups: ({ categoryId } = {}) => {
    const params = new URLSearchParams();
    if (categoryId) params.set('categoryId', categoryId);
    const query = params.toString();
    return apiRequest(`/api/learning/subjects/groups${query ? `?${query}` : ''}`);
  }
};
