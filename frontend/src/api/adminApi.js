import api from './axios';

export const adminApi = {
  getDashboard: () => api.get('/api/admin/dashboard'),
  getUsers: (params) => api.get('/api/admin/users', { params }),
  toggleUserActive: (id) => api.put(`/api/admin/users/${id}/toggle-active`),
  removeUser: (id) => api.delete(`/api/admin/users/${id}`),
  getAllOrders: (params) => api.get('/api/orders/admin/all', { params }),
  updateOrderStatus: (id, data) => api.put(`/api/orders/admin/${id}/status`, data),
};
