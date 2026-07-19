import api from './axios';

export const cartApi = {
  getCart: () => api.get('/api/cart/'),
  addToCart: (data) => api.post('/api/cart/add', data),
  updateItem: (medicineId, data) => api.put(`/api/cart/update/${medicineId}`, data),
  removeItem: (medicineId) => api.delete(`/api/cart/remove/${medicineId}`),
  clearCart: () => api.delete('/api/cart/clear'),
};