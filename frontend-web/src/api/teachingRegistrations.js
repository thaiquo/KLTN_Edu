import { apiRequest } from './client';

export const teachingCatalogApi = {
  programTypes: () => apiRequest('/api/learning/teaching-catalog/program-types'),
  educationLevels: () => apiRequest('/api/learning/teaching-catalog/education-levels'),
  categories: (programTypeId, educationLevelId) => {
    const params = new URLSearchParams({ programTypeId: String(programTypeId) });
    if (educationLevelId) params.set('educationLevelId', String(educationLevelId));
    return apiRequest(`/api/learning/teaching-catalog/categories?${params}`);
  },
  subjects: (categoryId) => apiRequest(`/api/learning/teaching-catalog/subjects?categoryId=${categoryId}`),
  levels: (subjectId) => apiRequest(`/api/learning/teaching-catalog/levels?subjectId=${subjectId}`)
};

export const teachingRegistrationApi = {
  mine: () => apiRequest('/api/learning/tutor/subject-registrations'),
  create: (payload) => apiRequest('/api/learning/tutor/subject-registrations', {
    method: 'POST', body: JSON.stringify(payload)
  }),
  createBatch: (payload) => apiRequest('/api/learning/tutor/subject-registrations/batch', {
    method: 'POST', body: JSON.stringify(payload)
  }),
  adminPending: () => apiRequest('/api/learning/admin/tutor-subject-registrations'),
  approve: (id, note = '') => apiRequest(`/api/learning/admin/tutor-subject-registrations/${id}/approve`, {
    method: 'POST', body: JSON.stringify({ note })
  }),
  reject: (id, reason, note = '') => apiRequest(`/api/learning/admin/tutor-subject-registrations/${id}/reject`, {
    method: 'POST', body: JSON.stringify({ reason, note })
  })
};

export const catalogSuggestionApi = {
  mine: () => apiRequest('/api/learning/catalog-subject-suggestions/me'),
  create: (payload) => apiRequest('/api/learning/catalog-subject-suggestions', {
    method: 'POST', body: JSON.stringify(payload)
  }),
  pending: () => apiRequest('/api/learning/catalog-subject-suggestions/pending'),
  approve: (id) => apiRequest(`/api/learning/catalog-subject-suggestions/${id}/approve`, { method: 'POST' }),
  reject: (id, reason) => apiRequest(`/api/learning/catalog-subject-suggestions/${id}/reject`, {
    method: 'POST', body: JSON.stringify({ reason })
  })
};

export const adminTeachingCatalogApi = {
  createSubject: (payload) => apiRequest('/api/learning/admin/teaching-catalog/subjects', {
    method: 'POST', body: JSON.stringify(payload)
  }),
  updateSubject: (id, payload) => apiRequest(`/api/learning/admin/teaching-catalog/subjects/${id}`, {
    method: 'PUT', body: JSON.stringify(payload)
  }),
  deactivateSubject: (id) => apiRequest(`/api/learning/admin/teaching-catalog/subjects/${id}`, {
    method: 'DELETE'
  }),
  createLevel: (payload) => apiRequest('/api/learning/admin/teaching-catalog/levels', {
    method: 'POST', body: JSON.stringify(payload)
  }),
  updateLevel: (id, payload) => apiRequest(`/api/learning/admin/teaching-catalog/levels/${id}`, {
    method: 'PUT', body: JSON.stringify(payload)
  }),
  deactivateLevel: (id) => apiRequest(`/api/learning/admin/teaching-catalog/levels/${id}`, {
    method: 'DELETE'
  }),
  importCsv: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiRequest('/api/learning/admin/teaching-catalog/imports', { method: 'POST', body: formData });
  }
};
