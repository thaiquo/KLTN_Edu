import { apiRequest } from "./client";

export const tutorAvailabilityApi = {
  getMine: (userId) => apiRequest("/tutors/me/availability", { headers: { "X-User-Id": userId } }),
  replaceMine: (userId, availabilities) => apiRequest("/tutors/me/availability", {
    method: "PUT",
    headers: { "X-User-Id": userId },
    body: JSON.stringify({ availabilities }),
  }),
};
