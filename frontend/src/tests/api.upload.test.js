import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api/client.js', () => ({
  default: { post: vi.fn() },
}));

import client from '../api/client.js';
import { uploadDocument } from '../api/upload.js';

beforeEach(() => vi.clearAllMocks());

const makeFile = (name = 'doc.pdf', type = 'application/pdf') =>
  new File(['content'], name, { type });

describe('uploadDocument — validation', () => {
  it('throws when workspaceId is missing', async () => {
    await expect(uploadDocument(makeFile(), '')).rejects.toThrow(
      'A workspace must be selected'
    );
    expect(client.post).not.toHaveBeenCalled();
  });

  it('throws when workspaceId is whitespace only', async () => {
    await expect(uploadDocument(makeFile(), '   ')).rejects.toThrow(
      'A workspace must be selected'
    );
  });

  it('throws when file is null', async () => {
    await expect(uploadDocument(null, 'ws-1')).rejects.toThrow('No file provided.');
    expect(client.post).not.toHaveBeenCalled();
  });
});

describe('uploadDocument — happy path', () => {
  it('posts FormData to /documents/upload', async () => {
    client.post.mockResolvedValue({ data: { document_id: 'd-1', chunk_count: 3 } });
    const result = await uploadDocument(makeFile(), 'ws-1');
    expect(client.post).toHaveBeenCalledOnce();
    const [url, formData] = client.post.mock.calls[0];
    expect(url).toBe('/documents/upload');
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get('workspace_id')).toBe('ws-1');
    expect(result.document_id).toBe('d-1');
  });

  it('trims workspace_id before posting', async () => {
    client.post.mockResolvedValue({ data: {} });
    await uploadDocument(makeFile(), '  ws-99  ');
    const formData = client.post.mock.calls[0][1];
    expect(formData.get('workspace_id')).toBe('ws-99');
  });

  it('appends user_id when provided', async () => {
    client.post.mockResolvedValue({ data: {} });
    await uploadDocument(makeFile(), 'ws-1', 'user-42');
    const formData = client.post.mock.calls[0][1];
    expect(formData.get('user_id')).toBe('user-42');
  });

  it('omits user_id when null', async () => {
    client.post.mockResolvedValue({ data: {} });
    await uploadDocument(makeFile(), 'ws-1', null);
    const formData = client.post.mock.calls[0][1];
    expect(formData.get('user_id')).toBeNull();
  });

  it('calls onProgress with percentage', async () => {
    client.post.mockImplementation(async (_url, _data, config) => {
      config.onUploadProgress({ loaded: 50, total: 100 });
      return { data: {} };
    });
    const onProgress = vi.fn();
    await uploadDocument(makeFile(), 'ws-1', null, onProgress);
    expect(onProgress).toHaveBeenCalledWith(50);
  });

  it('skips onProgress callback when total is 0', async () => {
    client.post.mockImplementation(async (_url, _data, config) => {
      config.onUploadProgress({ loaded: 0, total: 0 });
      return { data: {} };
    });
    const onProgress = vi.fn();
    await uploadDocument(makeFile(), 'ws-1', null, onProgress);
    expect(onProgress).not.toHaveBeenCalled();
  });
});
