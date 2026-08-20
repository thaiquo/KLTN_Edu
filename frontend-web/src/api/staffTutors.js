import { apiRequest } from './client';

export const staffTutorsApi = {
  pending: () => apiRequest('/api/staff/tutor-applications/pending'),
  history: () => apiRequest('/api/staff/tutor-applications/history'),
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
