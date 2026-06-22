import { apiRequest } from './client';

export const tutorApplicationApi = {
  getMine: () => apiRequest('/users/me/tutor-profile'),
  submit: (payload) => apiRequest('/users/me/tutor-profile', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  uploadEvidence: (file) => {
    const body = new FormData();
    body.append('file', file);
    return apiRequest('/users/me/tutor-evidence-files', { method: 'POST', body });
  },
  list: () => apiRequest('/users/tutor-applications'),
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
