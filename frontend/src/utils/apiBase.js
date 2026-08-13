export function apiBaseUrl() {
  const configured = process.env.REACT_APP_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'http://localhost:8000';
}

export function websocketBaseUrl() {
  return apiBaseUrl().replace(/^http/, 'ws');
}
