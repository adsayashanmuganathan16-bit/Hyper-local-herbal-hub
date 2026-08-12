// Mock API client.
//
// This project ships as a fully self-contained frontend demo: instead of
// talking to a real HTTP backend, this "axios-like" client routes every
// request to an in-browser mock backend backed by localStorage
// (see src/mock/). It exposes the same get/post/put/delete surface the rest
// of the app already uses, so no page or api module needed to change.
import { handleRequest } from '../mock/backend';
import axios from 'axios';

// The full application uses FastAPI/MongoDB. Keep the browser-only demo as an
// explicit opt-in so a missing build-time variable can never bypass payments.
const useRealBackend = process.env.REACT_APP_USE_REAL_API !== 'false';
const realApi = axios.create({ baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000' });
realApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('herbal_hub_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const api = {
  get: (url, config = {}) => useRealBackend ? realApi.get(url, config) : handleRequest('GET', url, config),
  post: (url, data, config = {}) => useRealBackend ? realApi.post(url, data, config) : handleRequest('POST', url, { ...config, data }),
  put: (url, data, config = {}) => useRealBackend ? realApi.put(url, data, config) : handleRequest('PUT', url, { ...config, data }),
  patch: (url, data, config = {}) => useRealBackend ? realApi.patch(url, data, config) : handleRequest('PATCH', url, { ...config, data }),
  delete: (url, config = {}) => useRealBackend ? realApi.delete(url, config) : handleRequest('DELETE', url, config),
};

export default api;
