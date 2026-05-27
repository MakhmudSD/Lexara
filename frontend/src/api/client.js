import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 90000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
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
    console.error(`[api] ${status ?? 'ERR'} — ${detail}`);
    return Promise.reject({ status, message: detail, raw: err, response: err.response });
  }
);

export default client;
