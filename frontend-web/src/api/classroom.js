import { apiRequest } from "./client";

export const classroomApi = {
  getApprovedSubjects: (userId) =>
    apiRequest("/classrooms/approved-subjects", {
      headers: userId ? { "X-User-Id": userId } : {},
    }),

  createClassRoom: (userId, data) =>
    apiRequest("/classrooms", {
      method: "POST",
      headers: userId ? { "X-User-Id": userId } : {},
      body: JSON.stringify(data),
    }),

  getMyClassRooms: (userId) =>
    apiRequest("/classrooms/me", {
      headers: userId ? { "X-User-Id": userId } : {},
    }),

  getAllForAdmin: () => apiRequest("/classrooms/admin"),

  getById: (id) => apiRequest(`/classrooms/${id}`),

  approve: (id) =>
    apiRequest(`/classrooms/${id}/approve`, {
      method: "PUT",
    }),

  reject: (id) =>
    apiRequest(`/classrooms/${id}/reject`, {
      method: "PUT",
    }),

  cancel: (userId, id) =>
    apiRequest(`/classrooms/${id}/cancel`, {
      method: "PUT",
      headers: userId ? { "X-User-Id": userId } : {},
    }),
};
