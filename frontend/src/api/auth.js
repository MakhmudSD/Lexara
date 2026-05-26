import client from './client';

export const login = (email, password) =>
  client.post('/auth/login', { email, password }).then((response) => response.data);

export const register = (email, password, full_name) =>
  client.post('/auth/register', { email, password, full_name }).then((response) => response.data);

export const getMe = (token) =>
  client.get('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => response.data);
