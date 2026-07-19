import api from './axios';

export const prescriptionApi = {
  upload: (file, notes) => {
    const formData = new FormData();
    formData.append('file', file);
    if (notes) formData.append('notes', notes);
    return api.post('/api/prescriptions/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getMyPrescriptions: (params) => api.get('/api/prescriptions/', { params }),
  getPrescription: (id) => api.get(`/api/prescriptions/${id}`),
  getAll: (params) => api.get('/api/prescriptions/admin/all', { params }),
  verify: (id, data) => api.put(`/api/prescriptions/admin/${id}/verify`, data),
};
