import api from './axios';

export const medicineApi = {
  search: (params) => api.get('/api/medicines/', { params }),
  getById: (id) => api.get(`/api/medicines/${id}`),
  getCategories: () => api.get('/api/medicines/categories'),
  getFeatured: () => api.get('/api/medicines/featured/list'),
  create: (data) => api.post('/api/medicines/', data),
  update: (id, data) => api.put(`/api/medicines/${id}`, data),
  delete: (id) => api.delete(`/api/medicines/${id}`),
  uploadImages: (id, files) => {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    return api.post(`/api/medicines/${id}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};