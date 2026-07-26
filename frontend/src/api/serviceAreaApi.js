import api from './axios';
export const serviceAreaApi = {
  validate: (address) => api.post('/api/service-areas/validate', address),
  validateLocation: (latitude, longitude) => api.post('/api/service-areas/validate-location', { latitude, longitude }),
  active: () => api.get('/api/service-areas/active'),
  list: () => api.get('/api/service-areas'),
  create: (data) => api.post('/api/service-areas', data),
  update: (id, data) => api.put(`/api/service-areas/${id}`, data),
};
