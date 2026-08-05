import api from './axios';

export const sellerApi = {
  getDashboard: () => api.get('/api/seller/dashboard'),
  getProducts: (params) => api.get('/api/seller/products', { params }),
  getOrders: () => api.get('/api/seller/orders'),
  deleteOrder: (id) => api.delete(`/api/seller/orders/${id}`),
  getCustomers: (params) => api.get('/api/seller/customers', { params }),
  archiveCustomer: (id) => api.put(`/api/seller/customers/${id}/archive`),
  readyForPickup: (id) => api.post(`/api/seller/orders/${id}/ready-for-pickup`),
  dispatch: (id, data) => api.post(`/api/seller/orders/${id}/dispatch`, data),
  delivered: (id) => api.post(`/api/seller/orders/${id}/delivered`),
};
