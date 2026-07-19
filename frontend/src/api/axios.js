// Mock API client.
//
// This project ships as a fully self-contained frontend demo: instead of
// talking to a real HTTP backend, this "axios-like" client routes every
// request to an in-browser mock backend backed by localStorage
// (see src/mock/). It exposes the same get/post/put/delete surface the rest
// of the app already uses, so no page or api module needed to change.
import { handleRequest } from '../mock/backend';

const api = {
  get: (url, config = {}) => handleRequest('GET', url, config),
  post: (url, data, config = {}) => handleRequest('POST', url, { ...config, data }),
  put: (url, data, config = {}) => handleRequest('PUT', url, { ...config, data }),
  delete: (url, config = {}) => handleRequest('DELETE', url, config),
};

export default api;
