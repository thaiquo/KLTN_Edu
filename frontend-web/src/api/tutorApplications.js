import { apiRequest } from './client';

export const tutorApplicationApi = {
  getMyTutorApplication: () => apiRequest('/api/tutor-applications/me'),
  createTutorApplication: () => apiRequest('/api/tutor-applications', {
    method: 'POST'
  }),
  updateMyTutorApplication: (payload) => apiRequest('/api/tutor-applications/me', {
    method: 'PUT',
    body: JSON.stringify(payload)
  }),
  submitMyTutorApplication: () => apiRequest('/api/tutor-applications/me/submit', {
    method: 'POST'
  }),
  getMyTutorApplicationSubjects: () => apiRequest('/api/tutor-applications/me/subjects'),
  addApplicationSubject: (payload) => apiRequest('/api/tutor-applications/me/subjects', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  updateApplicationSubject: (id, payload) => apiRequest(`/api/tutor-applications/me/subjects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  }),
  deleteApplicationSubject: (id) => apiRequest(`/api/tutor-applications/me/subjects/${id}`, {
    method: 'DELETE'
  }),
  getMyApplicationDocuments: () => apiRequest('/api/tutor-applications/me/documents'),
  uploadApplicationDocument: ({ documentType, file, metadata = {} }) => {
    const formData = new FormData();
    formData.append('documentType', documentType);
    formData.append('file', file);
    Object.entries(metadata).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        formData.append(key, value);
      }
    });

    return apiRequest('/api/tutor-applications/me/documents', {
      method: 'POST',
      body: formData
    });
  },
  getApplicationDocumentDownloadUrl: (id) => apiRequest(`/api/tutor-applications/me/documents/${id}/download`),
  deleteApplicationDocument: (id) => apiRequest(`/api/tutor-applications/me/documents/${id}`, {
    method: 'DELETE'
  })
};
