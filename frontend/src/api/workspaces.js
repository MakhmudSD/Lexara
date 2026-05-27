import client from './client';

export const getOrgWorkspaces = (orgSlug) =>
  client.get(`/orgs/${orgSlug}/workspaces`).then((response) => response.data);

export const createOrgWorkspace = (orgSlug, name) =>
  client.post(`/orgs/${orgSlug}/workspaces`, { name }).then((response) => response.data);

// Legacy flat paths — keep for admin scripts / backward compat
export const getWorkspaces = () => client.get('/workspaces').then((response) => response.data);
