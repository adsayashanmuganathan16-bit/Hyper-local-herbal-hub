import api from './axios';

export const orderApi = {
  getMyOrders: (params) => api.get('/api/orders/', { params }),
  getOrder: (id) => api.get(`/api/orders/${id}`),
  getPostalTracking: (id) => api.get(`/api/orders/${id}/postal-tracking`),
  updateShipping: (id, data) => api.put(`/api/orders/${id}/shipping`, data),
  updateDeliveryStatus: (id, status) => api.put(`/api/orders/${id}/delivery-status`, { status }),
  confirmReceived: (id) => api.put(`/api/orders/${id}/confirm-received`),
  reportNotReceived: (id) => api.put(`/api/orders/${id}/report-not-received`),
  getInvoice: (id) => api.get(`/api/orders/${id}/invoice`),
  cancelOrder: (id) => api.put(`/api/orders/${id}/cancel`),
  createOrder: (data) => api.post('/api/checkout/create-order', data),
  verifyPayment: (orderId, data) => api.post(`/api/checkout/verify-payment/${orderId}`, data),
  getMockPayment: (orderId) => api.get(`/api/payments/mock/${orderId}`),
  payMock: (orderId, data) => api.post(`/api/payments/mock/${orderId}/pay`, data),
};
