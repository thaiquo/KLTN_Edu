import { apiRequest } from './client';

export const subjectApi = {
  list: ({ categoryId, keyword } = {}) => {
    const params = new URLSearchParams();
    if (categoryId) params.set('categoryId', categoryId);
    if (keyword) params.set('keyword', keyword);
    const query = params.toString();

    return apiRequest(`/api/subjects${query ? `?${query}` : ''}`);
  }
};
