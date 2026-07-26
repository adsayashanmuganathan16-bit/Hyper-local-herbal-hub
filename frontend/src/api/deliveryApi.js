import api from './axios';

export const deliveryApi = {
  track: (orderId) => api.get(`/api/orders/${orderId}/tracking`),
  getMyDeliveries: (params) => api.get('/api/delivery/my-deliveries', { params }),
  updateStatus: (id, data) => api.put(`/api/delivery/${id}/update-status`, data),
  getAssignments: () => api.get('/api/delivery-staff/me/orders'),
  action: (id, action, reason) => api.post(`/api/delivery-staff/deliveries/${id}/action`, { action, reason }),
  updateLocation: (data) => api.post('/api/courier/location', data),
  listStaff: (params) => api.get('/api/delivery-staff', { params }),
  liveStaff: () => api.get('/api/delivery-staff/live'),
  history: (params) => api.get('/api/delivery-staff/history', { params }),
  createStaff: (data) => api.post('/api/delivery-staff', data),
  updateStaff: (id, data) => api.put(`/api/delivery-staff/${id}`, data),
  setActive: (id, is_active) => api.put(`/api/delivery-staff/${id}/active`, { is_active }),
  deleteStaff: (id) => api.delete(`/api/delivery-staff/${id}`),
  assign: (order_id, staff_id) => api.post('/api/delivery-staff/assign', { order_id, staff_id }),
};
