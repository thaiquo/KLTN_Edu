import { apiRequest } from './client';

export const tutorStatisticsApi = {
  get: (rangeDays = 30) => apiRequest(`/api/tutor-statistics/v1?rangeDays=${rangeDays}`)
};
