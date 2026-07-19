import api from './axios';

export const orderApi = {
  getMyOrders: (params) => api.get('/api/orders/', { params }),
  getOrder: (id) => api.get(`/api/orders/${id}`),
  getInvoice: (id) => api.get(`/api/orders/${id}/invoice`),
  cancelOrder: (id) => api.put(`/api/orders/${id}/cancel`),
  createOrder: (data) => api.post('/api/checkout/create-order', data),
  verifyPayment: (orderId, data) => api.post(`/api/checkout/verify-payment/${orderId}`, data),
};

