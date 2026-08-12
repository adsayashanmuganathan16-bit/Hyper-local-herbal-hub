import api from './axios';

export const financialApi = {
  sellerProfile: () => api.get('/api/financial/sellers/me'),
  sellerEarnings: () => api.get('/api/financial/sellers/me/earnings'),
  registerSeller: (data) => api.post('/api/financial/sellers/register', data),
  registerSellerAccount: (data) => api.post('/api/financial/sellers/register-account', data),
  sellers: () => api.get('/api/financial/admin/sellers'),
  decideSeller: (id, decision) => api.post(`/api/financial/admin/sellers/${id}/${decision}`),
  payments: () => api.get('/api/financial/admin/payments'),
  payouts: (status) => api.get('/api/financial/admin/payouts', { params: status ? { status } : {} }),
  payout: (id) => api.get(`/api/financial/admin/payouts/${id}`),
  commission: () => api.get('/api/financial/admin/commission'),
  updatePayoutStatus: (id, status) => api.patch(`/api/financial/admin/payouts/${id}/status`, { status }),
  markPaid: (id, transaction_reference) => api.post(`/api/financial/admin/payouts/${id}/mark-paid`, { transaction_reference }),
  retryPayout: (id) => api.post(`/api/financial/admin/payouts/${id}/retry`),
  setCommission: (percentage) => api.put('/api/financial/admin/commission', { percentage }),
  report: () => api.get('/api/financial/admin/reports/payouts.csv', { responseType: 'blob' }),
  sellerReceipt: (id) => api.get(`/api/financial/sellers/me/payouts/${id}/receipt`, { responseType: 'blob' }),
  adminReceipt: (id) => api.get(`/api/financial/admin/payouts/${id}/receipt`, { responseType: 'blob' }),
};
