import client from './client';

export const getLogs = async () => {
  const response = await client.get('/admin/logs');
  return response.data;
};

export const getRequests = async () => {
  const response = await client.get('/admin/requests');
  return response.data;
};

export const getDocuments = async () => {
  const response = await client.get('/admin/documents');
  return response.data;
};

export const getRetrievals = async () => {
  const response = await client.get('/admin/retrievals');
  return response.data;
};

export const getHealth = async () => {
  const response = await client.get('/admin/health');
  return response.data;
};
