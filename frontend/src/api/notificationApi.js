import api from './axios';

export const notificationApi = {
  getNotifications: (params) => api.get('/api/notifications/', { params }),
  markRead: (id) => api.put(`/api/notifications/${id}/read`),
  markAllRead: () => api.put('/api/notifications/read-all'),
  delete: (id) => api.delete(`/api/notifications/${id}`),
  deleteAll: () => api.delete('/api/notifications/'),
};
