import axios from 'axios';
import { apiBaseUrl } from '../utils/apiBase';

const api = axios.create({ baseURL: apiBaseUrl() });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('herbal_hub_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
