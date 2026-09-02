import { apiRequest } from './client';

export const classApi = {
  // Tutor endpoints
  getMyClasses: (status) => {
    const params = status ? `?status=${status}` : '';
    return apiRequest(`/api/learning/tutor/classes${params}`);
  },
  getMyClassStats: () => apiRequest('/api/learning/tutor/classes/stats'),
  getClassById: (id) => apiRequest(`/api/learning/tutor/classes/${id}`),
  createClass: (payload) => apiRequest('/api/learning/tutor/classes', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  updateClassDetails: (id, payload) => apiRequest(`/api/learning/tutor/classes/${id}/details`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  }),
  updateVisibility: (id, payload) => apiRequest(`/api/learning/tutor/classes/${id}/visibility`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  }),
  deleteClass: (id) => apiRequest(`/api/learning/tutor/classes/${id}`, {
    method: 'DELETE'
  }),
  getAvailability: () => apiRequest('/api/learning/tutor/availability'),
  saveAvailability: (slots) => apiRequest('/api/learning/tutor/availability', {
    method: 'POST',
    body: JSON.stringify({ slots })
  }),

  // Admin / Staff endpoints
  adminGetAllClasses: (filterParams = {}) => {
    const params = new URLSearchParams();
    if (filterParams.status && filterParams.status !== 'ALL') params.set('status', filterParams.status);
    if (filterParams.tutorEmail) params.set('tutorEmail', filterParams.tutorEmail);
    if (filterParams.subjectId) params.set('subjectId', String(filterParams.subjectId));
    if (filterParams.keyword) params.set('keyword', filterParams.keyword);
    if (filterParams.reviewedByMe) params.set('reviewedByMe', 'true');
    const queryString = params.toString();
    return apiRequest(`/api/learning/admin/classes${queryString ? `?${queryString}` : ''}`);
  },
  adminGetClassStats: () => apiRequest('/api/learning/admin/classes/stats'),
  adminGetClassById: (id) => apiRequest(`/api/learning/admin/classes/${id}`),
  adminApproveClass: (id) => apiRequest(`/api/learning/admin/classes/${id}/approve`, {
    method: 'POST'
  }),
  adminRejectClass: (id, reason) => apiRequest(`/api/learning/admin/classes/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  }),

  // Public / Student endpoints
  getPublicClasses: (filterParams = {}) => {
    const params = new URLSearchParams();
    if (filterParams.programTypeId) params.set('programTypeId', String(filterParams.programTypeId));
    if (filterParams.educationLevelId) params.set('educationLevelId', String(filterParams.educationLevelId));
    if (filterParams.categoryId) params.set('categoryId', String(filterParams.categoryId));
    if (filterParams.subjectId) params.set('subjectId', String(filterParams.subjectId));
    if (filterParams.levelId) params.set('levelId', String(filterParams.levelId));
    if (filterParams.keyword) params.set('keyword', filterParams.keyword);
    if (filterParams.mode) params.set('mode', filterParams.mode);
    if (filterParams.tutorEmail) params.set('tutorEmail', filterParams.tutorEmail);
    if (filterParams.tutorProfileId) params.set('tutorProfileId', String(filterParams.tutorProfileId));
    if (filterParams.minPrice) params.set('minPrice', String(filterParams.minPrice));
    if (filterParams.maxPrice) params.set('maxPrice', String(filterParams.maxPrice));
    const queryString = params.toString();
    return apiRequest(`/api/learning/public/classes${queryString ? `?${queryString}` : ''}`);
  },
  getPublicClassById: (id) => apiRequest(`/api/learning/public/classes/${id}`),
  verifyJoinKey: (id, joinKey) => apiRequest(`/api/learning/public/classes/${id}/verify-key`, {
    method: 'POST',
    body: JSON.stringify({ joinKey })
  }),

  // Enrollment Request & Buffer Pool endpoints
  enrollClass: (classId, payload = {}) => apiRequest(`/api/learning/v1/classes/${classId}/enroll`, {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  cancelEnrollmentRequest: (requestId) => apiRequest(`/api/learning/v1/enrollment-requests/${requestId}/cancel`, {
    method: 'POST'
  }),
  getMyEnrollmentRequests: () => apiRequest('/api/learning/v1/enrollment-requests/my-requests'),
  getRequestsForClass: (classId) => apiRequest(`/api/learning/v1/tutor/classes/${classId}/requests`),
  getAllTutorRequests: () => apiRequest('/api/learning/v1/tutor/enrollment-requests'),
  acceptEnrollmentRequest: (requestId, agreementId) => apiRequest(`/api/learning/v1/enrollment-requests/${requestId}/accept`, {
    method: 'POST',
    body: agreementId ? JSON.stringify({ agreementId }) : undefined
  }),
  rejectEnrollmentRequest: (requestId, reason) => apiRequest(`/api/learning/v1/enrollment-requests/${requestId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  }),
  getBufferPoolStatus: (classId) => apiRequest(`/api/learning/v1/classes/${classId}/buffer-pool`)
};
