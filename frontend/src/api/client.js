import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 90000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const detail =
      err.response?.data?.detail ||
      err.response?.data?.error?.message ||
      err.message ||
      'Network error';
    if (import.meta.env.DEV) console.error(`[api] ${status ?? 'ERR'} — ${detail}`);
    if (status === 401 && !err.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('authUser');
      window.dispatchEvent(new Event('auth:change'));
    }
    return Promise.reject({ status, message: detail, raw: err, response: err.response });
  }
);

export default client;
