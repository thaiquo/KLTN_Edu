import { apiRequest } from './client';

export const userApi = {
  getMe: () => apiRequest('/api/users/me'),
  updateMe: (payload) => apiRequest('/api/users/me', {
    method: 'PUT',
    body: JSON.stringify(payload)
  }),
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('file', file);

    return apiRequest('/api/users/me/avatar', {
      method: 'POST',
      body: formData
    });
  },
  changePassword: (payload) => apiRequest('/api/users/me/password', {
    method: 'PUT',
    body: JSON.stringify(payload)
  })
};
