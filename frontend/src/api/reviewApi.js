import api from './axios';

export const reviewApi = {
  create: (data) => api.post('/api/reviews/', data),
  getByMedicine: (medicineId, params) => api.get(`/api/reviews/medicine/${medicineId}`, { params }),
  getMyReviews: (params) => api.get('/api/reviews/my-reviews', { params }),
};