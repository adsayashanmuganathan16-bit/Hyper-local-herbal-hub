import api from './axios';

export const mapApi = {
  getTracking: (orderId) => api.get(`/api/delivery/track/${orderId}`),
};
