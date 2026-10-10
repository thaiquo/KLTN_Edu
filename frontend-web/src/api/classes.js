import { apiRequest } from './client';

export const classApi = {
  // Tutor endpoints
  getMyClasses: (status) => {
    const params = status ? `?status=${status}` : '';
    return apiRequest(`/api/learning/tutor/classes${params}`);
  },
  getMyClassStats: () => apiRequest('/api/learning/tutor/classes/stats'),
  getCreateReadiness: () => apiRequest('/api/learning/tutor/classes/readiness'),
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
    if (Array.isArray(filterParams.levelIds)) {
      filterParams.levelIds.forEach((levelId) => params.append('levelIds', String(levelId)));
    }
    if (filterParams.keyword) params.set('keyword', filterParams.keyword);
    if (filterParams.mode) params.set('mode', filterParams.mode);
    if (filterParams.teachingMode) params.set('teachingMode', filterParams.teachingMode);
    if (filterParams.tutorEmail) params.set('tutorEmail', filterParams.tutorEmail);
    if (filterParams.tutorProfileId) params.set('tutorProfileId', String(filterParams.tutorProfileId));
    if (filterParams.minPrice) params.set('minPrice', String(filterParams.minPrice));
    if (filterParams.maxPrice) params.set('maxPrice', String(filterParams.maxPrice));
    if (filterParams.weekday) params.set('weekday', String(filterParams.weekday));
    if (Array.isArray(filterParams.weekdays)) {
      filterParams.weekdays.forEach((weekday) => params.append('weekdays', String(weekday)));
    }
    if (filterParams.startTime) params.set('startTime', filterParams.startTime);
    if (filterParams.endTime) params.set('endTime', filterParams.endTime);
    if (filterParams.availableOnly) params.set('availableOnly', 'true');
    if (filterParams.page != null) params.set('page', String(filterParams.page));
    if (filterParams.size != null) params.set('size', String(filterParams.size));
    if (filterParams.sort) params.set('sort', filterParams.sort);
    const queryString = params.toString();
    return apiRequest(`/api/learning/public/classes${queryString ? `?${queryString}` : ''}`);
  },
  getPublicClassById: (id) => apiRequest(`/api/learning/public/classes/${id}`),
  getShareableClassById: (id) => apiRequest(`/api/learning/public/classes/${id}/share`),
  getPublicClassByShareId: (publicShareId) => apiRequest(`/api/learning/public/classes/shared/${publicShareId}`),
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
  getBufferPoolStatus: (classId) => apiRequest(`/api/learning/v1/classes/${classId}/buffer-pool`),
  getStudentClasses: () => apiRequest('/api/learning/student/classes'),
  getStudentSchedule: () => apiRequest('/api/learning/v1/student/schedule'),

  // Session & Homework endpoints
  getSessionById: (sessionId) => apiRequest(`/api/learning/sessions/${sessionId}`),
  updateSessionDetails: (sessionId, payload) => apiRequest(`/api/learning/sessions/${sessionId}/details`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  }),
  gradeSessionHomework: (sessionId, attendanceId, payload) => apiRequest(`/api/learning/sessions/${sessionId}/attendances/${attendanceId}/grade`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  }),
  getTutorHomeworkOverview: () => apiRequest('/api/learning/tutor/homework-overview'),
  getStudentHomeworkOverview: () => apiRequest('/api/learning/student/homework-overview'),

  // Classroom Materials (Course-wide files)
  getClassroomMaterials: (classId) => apiRequest(`/api/learning/classes/${classId}/materials`),
  uploadClassroomMaterial: (classId, formData) => apiRequest(`/api/learning/classes/${classId}/materials`, {
    method: 'POST',
    body: formData
  }),
  deleteClassroomMaterial: (classId, materialId) => apiRequest(`/api/learning/classes/${classId}/materials/${materialId}`, {
    method: 'DELETE'
  }),
  getClassroomMaterialDownloadUrl: (classId, materialId) => apiRequest(`/api/learning/classes/${classId}/materials/${materialId}/download-url`),

  // Session Files (Assignments max 5 & Lecture slides)
  uploadSessionAssignmentFiles: (sessionId, formData) => apiRequest(`/api/learning/sessions/${sessionId}/assignment-files`, {
    method: 'POST',
    body: formData
  }),
  uploadSessionMaterialFiles: (sessionId, formData) => apiRequest(`/api/learning/sessions/${sessionId}/material-files`, {
    method: 'POST',
    body: formData
  }),
  deleteSessionFile: (sessionId, fileId) => apiRequest(`/api/learning/sessions/${sessionId}/files/${fileId}`, {
    method: 'DELETE'
  }),
  getSessionFileDownloadUrl: (sessionId, fileId) => apiRequest(`/api/learning/sessions/${sessionId}/files/${fileId}/download-url`),

  // Student Homework Submission (Mandatory File)
  submitHomeworkWithFile: (sessionId, formData) => apiRequest(`/api/learning/sessions/${sessionId}/homework-submission-file`, {
    method: 'POST',
    body: formData
  }),
  submitHomework: (sessionId, payload) => apiRequest(`/api/learning/sessions/${sessionId}/homework-submission`, {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  deleteHomeworkSubmission: (sessionId) => apiRequest(`/api/learning/sessions/${sessionId}/homework-submission`, {
    method: 'DELETE'
  }),
  getSubmissionDownloadUrl: (sessionId, attendanceId) => apiRequest(`/api/learning/sessions/${sessionId}/attendances/${attendanceId}/submission-download-url`),

  // Syllabus file
  uploadSyllabusFile: (classId, formData) => apiRequest(`/api/learning/classes/${classId}/syllabus-file`, {
    method: 'POST',
    body: formData
  }),
  getSyllabusDownloadUrl: (classId) => apiRequest(`/api/learning/classes/${classId}/syllabus/download-url`)
};
