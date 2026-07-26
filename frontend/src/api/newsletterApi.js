import api from './axios';

export const newsletterApi = {
  subscribe: (email) => api.post('/api/newsletter/subscribe', { email }),
  getSubscribers: (params) => api.get('/api/newsletter/admin/subscribers', { params }),
};
