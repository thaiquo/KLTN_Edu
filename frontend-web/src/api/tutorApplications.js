import { apiDownload, apiRequest } from './client';

export const tutorApplicationApi = {
  getMine: () => apiRequest('/tutor-applications'),
  create: (payload) => apiRequest('/tutor-applications', { method: 'POST', body: JSON.stringify(payload) }),
  update: (applicationId, payload) => apiRequest(`/tutor-applications/${applicationId}`, {
    method: 'PUT', body: JSON.stringify(payload)
  }),
  submit: (applicationId) => apiRequest(`/tutor-applications/${applicationId}/submit`, { method: 'POST' }),
  uploadEvidence: (file) => {
    const body = new FormData();
    body.append('file', file);
    return apiRequest('/tutor-applications/certificates/upload', { method: 'POST', body });
  },
  list: async () => {
    const page = await apiRequest('/admin/tutor-applications?size=100');
    return page.content || [];
  },
  approve: (applicationId, note) => apiRequest(`/admin/tutor-applications/${applicationId}/approve`, {
    method: 'POST', body: JSON.stringify({ note })
  }),
  reject: (applicationId, reason) => apiRequest(`/admin/tutor-applications/${applicationId}/reject`, {
    method: 'POST', body: JSON.stringify({ reason })
  }),
  openOwnCertificate: (certificateId) => apiDownload(`/tutor-applications/certificates/${certificateId}/content`),
  openForReview: (applicationId, certificateId) => apiDownload(
    `/admin/tutor-applications/${applicationId}/certificates/${certificateId}/content`
  ),
  subscribeMine: (onUpdate) => subscribe("/tutor-applications/events", onUpdate),
  subscribeAdmin: (onUpdate) => subscribe("/admin/tutor-applications/events", onUpdate)
};

function subscribe(path, onUpdate) {
  const base = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
  const stream = new EventSource(`${base}${path}`, { withCredentials: true });
  stream.addEventListener("tutor-application.updated", event => onUpdate(JSON.parse(event.data)));
  return () => stream.close();
}
