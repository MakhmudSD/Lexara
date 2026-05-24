import client from './client';

export const sendChat = async (workspaceId, question, topK = 3, userId = null, debug = false) => {
  const payload = {
    workspace_id: workspaceId,
    question,
    top_k: topK,
    debug,
  };

  if (userId) {
    payload.user_id = userId;
  }

  const response = await client.post('/chat', payload);
  return response.data;
};
