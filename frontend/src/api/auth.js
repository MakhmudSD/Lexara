import client from './client';

export const login = (email, password) =>
  client.post('/auth/login', { email, password }).then((response) => response.data);

export const register = (email, password, full_name, ref = null) => {
  const payload = { email, password, full_name };
  if (ref) payload.ref = ref;
  return client.post('/auth/register', payload).then((response) => response.data);
};

export const getMe = (token) =>
  client.get('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => response.data);

export const forgotPassword = (email) =>
  client.post('/auth/forgot-password', { email }).then((response) => response.data);

export const resetPassword = (token, new_password) =>
  client.post('/auth/reset-password', { token, new_password }).then((response) => response.data);
