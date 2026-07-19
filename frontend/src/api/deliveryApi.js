import api from './axios';

export const deliveryApi = {
  track: (orderId) => api.get(`/api/delivery/track/${orderId}`),
  getMyDeliveries: (params) => api.get('/api/delivery/my-deliveries', { params }),
  updateStatus: (id, data) => api.put(`/api/delivery/${id}/update-status`, data),
};