import { apiRequest } from './client';

export const tutorApplicationApi = {
  getMine: () => apiRequest('/users/me/tutor-applications'),
  create: (payload) => apiRequest('/users/me/tutor-applications', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  update: (applicationId, payload) => apiRequest(`/users/me/tutor-applications/${applicationId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  }),
  withdraw: (applicationId) => apiRequest(`/users/me/tutor-applications/${applicationId}`, {
    method: 'DELETE'
  }),
  uploadEvidence: (file) => {
    const body = new FormData();
    body.append('file', file);
    return apiRequest('/users/me/tutor-evidence-files', { method: 'POST', body });
  },
  list: () => apiRequest('/users/tutor-applications'),
  history: () => apiRequest('/users/tutor-applications-history'),
  reviewSubject: (profileId, subjectId, payload) => apiRequest(
    `/users/tutor-applications/${profileId}/subjects/${subjectId}`,
    { method: 'PATCH', body: JSON.stringify(payload) }
  ),
  reviewEvidence: (profileId, subjectId, evidenceId, payload) => apiRequest(
    `/users/tutor-applications/${profileId}/subjects/${subjectId}/evidences/${evidenceId}`,
    { method: 'PATCH', body: JSON.stringify(payload) }
  ),
  getEvidenceDownloadUrl: (profileId, subjectId, evidenceId) => apiRequest(
    `/users/tutor-applications/${profileId}/subjects/${subjectId}/evidences/${evidenceId}/download-url`
  ),
  getOwnEvidenceDownloadUrl: (evidenceId) => apiRequest(
    `/users/me/tutor-evidences/${evidenceId}/download-url`
  )
};
