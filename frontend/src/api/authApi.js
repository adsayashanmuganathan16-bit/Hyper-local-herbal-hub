import api from './axios';

export const authApi = {
  login: (data) => api.post('/api/auth/login', data),
  register: (data) => api.post('/api/auth/register', data),
  getProfile: () => api.get('/api/auth/me'),
  updateProfile: (data) => api.put('/api/auth/profile', data),
  forgotPassword: (email) => api.post('/api/auth/forgot-password', { email }),
  resetPassword: (token, new_password) =>
    api.post('/api/auth/reset-password', { token, new_password }),
  verifyEmail: (token) => api.post('/api/auth/verify-email', { token }),
  resendVerification: () => api.post('/api/auth/resend-verification', {}),
  changePassword: (current_password, new_password) =>
    api.put('/api/auth/change-password', { current_password, new_password }),
  refreshToken: (refresh_token) =>
    api.post('/api/auth/refresh', { refresh_token }),
  uploadProfileImage: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/api/auth/upload-profile-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};
