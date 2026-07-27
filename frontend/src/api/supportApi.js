import api from './axios';

export const supportApi = {
  sendMessage: (payload) => api.post('/api/support/messages', payload),
  getMessages: (params) => api.get('/api/support/admin/messages', { params }),
  reply: (id, message) => api.post(`/api/support/admin/messages/${id}/reply`, { message }),
  updateStatus: (id, status) => api.put(`/api/support/admin/messages/${id}/status`, { status }),
};
