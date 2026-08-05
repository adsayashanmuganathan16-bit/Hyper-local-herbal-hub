import api from './axios';

export const wishlistApi = {
  get: () => api.get('/api/wishlist/'),
  add: (medicineId) => api.post(`/api/wishlist/${medicineId}`),
  remove: (medicineId) => api.delete(`/api/wishlist/${medicineId}`),
  clear: () => api.delete('/api/wishlist/'),
};
