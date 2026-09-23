import { apiRequest } from './client';

export const reviewApi = {
  getMyClassReviewStatus: (classRoomId) => apiRequest(`/api/learning/reviews/classes/${classRoomId}/my`),
  createMyClassReview: (classRoomId, payload) => apiRequest(`/api/learning/reviews/classes/${classRoomId}/my`, {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  updateMyClassReview: (classRoomId, payload) => apiRequest(`/api/learning/reviews/classes/${classRoomId}/my`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  }),
  getTutorReviews: (tutorId, { page = 0, size = 5 } = {}) => apiRequest(
    `/api/learning/public/tutors/${tutorId}/reviews?page=${page}&size=${size}`
  ),
  getTutorRatingSummary: (tutorId) => apiRequest(`/api/learning/public/tutors/${tutorId}/rating-summary`)
};
