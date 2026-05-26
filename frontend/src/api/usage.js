import client from './client';

export const getTokenUsage = () => client.get('/admin/token-usage').then((response) => response.data);
export const getTokenSummary = () => client.get('/admin/token-summary').then((response) => response.data);
export const getConversations = () => client.get('/admin/conversations').then((response) => response.data);
export const getUsers = () => client.get('/admin/users').then((response) => response.data);
export const updateUserRole = (id, role) => client.patch(`/admin/users/${id}/role`, { role }).then((response) => response.data);
export const updateUserStatus = (id, is_active) => client.patch(`/admin/users/${id}/status`, { is_active }).then((response) => response.data);
export const deleteUser = (id) => client.delete(`/admin/users/${id}`).then((response) => response.data);
