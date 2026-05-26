import client from './client';

export const uploadDocument = async (file, workspaceId) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('workspace_id', workspaceId);

  const response = await client.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};
