import client from './client';

/**
 * Create a workspace without needing an org ID.
 * Hits POST /workspaces/quick — backend resolves the org automatically.
 */
export const quickCreateWorkspace = async (name = 'My Workspace') => {
  const response = await client.post('/workspaces/quick', { name });
  return response.data; // { id, name, organization_id, ... }
};

export const listWorkspaces = async () => {
  const response = await client.get('/workspaces');
  return response.data;
};

export const updateWorkspaceName = async (workspaceId, name) => {
  const response = await client.patch(`/workspaces/${workspaceId}/name`, { name });
  return response.data;
};
