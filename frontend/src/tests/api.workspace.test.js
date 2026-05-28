import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api/client.js', () => ({
  default: { post: vi.fn(), get: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import client from '../api/client.js';
import {
  quickCreateWorkspace,
  listWorkspaces,
  updateWorkspaceName,
  deleteWorkspace,
} from '../api/workspace.js';

beforeEach(() => vi.clearAllMocks());

describe('quickCreateWorkspace', () => {
  it('posts to /workspaces/quick with given name', async () => {
    client.post.mockResolvedValue({ data: { id: 'ws-1', name: 'my-space' } });
    const result = await quickCreateWorkspace('my-space');
    expect(client.post).toHaveBeenCalledWith('/workspaces/quick', { name: 'my-space' });
    expect(result.name).toBe('my-space');
  });

  it('defaults name to "My Workspace"', async () => {
    client.post.mockResolvedValue({ data: { id: 'ws-2', name: 'My Workspace' } });
    await quickCreateWorkspace();
    expect(client.post).toHaveBeenCalledWith('/workspaces/quick', { name: 'My Workspace' });
  });
});

describe('listWorkspaces', () => {
  it('gets /workspaces and returns data', async () => {
    client.get.mockResolvedValue({ data: { workspaces: [], total: 0 } });
    const result = await listWorkspaces();
    expect(client.get).toHaveBeenCalledWith('/workspaces');
    expect(result.total).toBe(0);
  });
});

describe('updateWorkspaceName', () => {
  it('patches the correct URL with name', async () => {
    client.patch.mockResolvedValue({ data: { id: 'ws-1', name: 'renamed' } });
    const result = await updateWorkspaceName('ws-1', 'renamed');
    expect(client.patch).toHaveBeenCalledWith('/workspaces/ws-1/name', { name: 'renamed' });
    expect(result.name).toBe('renamed');
  });
});

describe('deleteWorkspace', () => {
  it('deletes the correct URL', async () => {
    client.delete.mockResolvedValue({ data: null });
    await deleteWorkspace('ws-1');
    expect(client.delete).toHaveBeenCalledWith('/workspaces/ws-1');
  });

  it('returns undefined (204 No Content)', async () => {
    client.delete.mockResolvedValue({ data: null });
    const result = await deleteWorkspace('ws-1');
    expect(result).toBeUndefined();
  });
});
