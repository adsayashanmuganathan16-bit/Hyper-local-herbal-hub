import api from './axios';

export const analyticsApi = {
  getSales: (period) => api.get('/api/analytics/sales', { params: { period } }),
  getUsers: () => api.get('/api/analytics/users'),
  exportOrders: (format = 'csv') => api.get('/api/analytics/export/orders', { params: { format } }),
};
