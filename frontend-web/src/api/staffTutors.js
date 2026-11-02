import { apiRequest } from './client';
import { paginatedRequest } from './paginatedResponse';

export const staffTutorsApi = {
  pending: ({ page = 0, size = 10 } = {}) => {
    const endpoint = `/api/staff/tutor-applications/pending?page=${page}&size=${size}`;
    return paginatedRequest(apiRequest(endpoint), endpoint);
  },
  /** @param {{ page?: number, size?: number, status?: string, search?: string }} [options] */
  history: ({ page = 0, size = 10, status, search } = {}) => {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (status && status !== 'ALL') params.set('status', status);
    if (search) params.set('search', search);
    const endpoint = `/api/staff/tutor-applications/history?${params.toString()}`;
    return paginatedRequest(apiRequest(endpoint), endpoint);
  },
  detail: (applicationId) => apiRequest(`/api/staff/tutor-applications/${applicationId}`),
  documentDownload: (applicationId, documentId) => apiRequest(`/api/staff/tutor-applications/${applicationId}/documents/${documentId}/download`),
  documentAccess: (documentId) => apiRequest(`/api/staff/tutor-applications/documents/${documentId}/access`),
  approve: (applicationId, note) => apiRequest(`/api/staff/tutor-applications/${applicationId}/approve`, {
    method: 'PATCH',
    body: JSON.stringify({ note })
  }),
  reject: (applicationId, reason, note) => apiRequest(`/api/staff/tutor-applications/${applicationId}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ reason, note })
  })
};

export const staffTutorApi = staffTutorsApi;
