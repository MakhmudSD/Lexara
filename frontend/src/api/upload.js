import client from './client';

export const uploadDocument = async (file, workspaceId, userId = null) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('workspace_id', workspaceId);
  if (userId) {
    formData.append('user_id', userId);
  }

  const response = await client.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};
