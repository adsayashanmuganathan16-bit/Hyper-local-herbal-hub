import axios from 'axios';

const financialClient = axios.create({ baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000' });
financialClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('herbal_hub_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const financialApi = {
  sellerProfile: () => financialClient.get('/api/financial/sellers/me'),
  sellerEarnings: () => financialClient.get('/api/financial/sellers/me/earnings'),
  registerSeller: (data) => financialClient.post('/api/financial/sellers/register', data),
  registerSellerAccount: (data) => financialClient.post('/api/financial/sellers/register-account', data),
  sellers: () => financialClient.get('/api/financial/admin/sellers'),
  decideSeller: (id, decision) => financialClient.post(`/api/financial/admin/sellers/${id}/${decision}`),
  payments: () => financialClient.get('/api/financial/admin/payments'),
  payouts: (status) => financialClient.get('/api/financial/admin/payouts', { params: status ? { status } : {} }),
  commission: () => financialClient.get('/api/financial/admin/commission'),
  markPaid: (id, transaction_reference) => financialClient.post(`/api/financial/admin/payouts/${id}/mark-paid`, { transaction_reference }),
  retryPayout: (id) => financialClient.post(`/api/financial/admin/payouts/${id}/retry`),
  setCommission: (percentage) => financialClient.put('/api/financial/admin/commission', { percentage }),
  report: () => financialClient.get('/api/financial/admin/reports/payouts.csv', { responseType: 'blob' }),
  sellerReceipt: (id) => financialClient.get(`/api/financial/sellers/me/payouts/${id}/receipt`, { responseType: 'blob' }),
  adminReceipt: (id) => financialClient.get(`/api/financial/admin/payouts/${id}/receipt`, { responseType: 'blob' }),
};
