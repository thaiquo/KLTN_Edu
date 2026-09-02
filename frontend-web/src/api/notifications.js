import { apiRequest } from './client';

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export const notificationApi = {
  getNotifications(params = {}) {
    return apiRequest(`/api/notifications${buildQuery(params)}`);
  },

  getUnreadCount(params = {}) {
    return apiRequest(`/api/notifications/unread-count${buildQuery(params)}`);
  },

  markRead(id) {
    return apiRequest(`/api/notifications/${id}/read`, {
      method: 'PATCH'
    });
  },

  markAllRead(params = {}) {
    return apiRequest(`/api/notifications/read-all${buildQuery(params)}`, {
      method: 'PATCH'
    });
  }
};
