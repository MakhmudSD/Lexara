import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';

// Re-import client fresh for each suite so interceptors are re-registered
let client;
beforeEach(async () => {
  vi.resetModules();
  client = (await import('../api/client.js')).default;
});

describe('axios client — request interceptor', () => {
  it('attaches Authorization header when token exists', async () => {
    localStorage.setItem('access_token', 'tok-abc');
    const config = { headers: {} };
    // Manually run request interceptors
    const intercepted = await client.interceptors.request.handlers[0].fulfilled(config);
    expect(intercepted.headers.Authorization).toBe('Bearer tok-abc');
  });

  it('does not add Authorization when no token', async () => {
    const config = { headers: {} };
    const intercepted = await client.interceptors.request.handlers[0].fulfilled(config);
    expect(intercepted.headers.Authorization).toBeUndefined();
  });
});

describe('axios client — response error interceptor', () => {
  it('normalises error from response.data.error.message', async () => {
    const err = {
      response: { status: 409, data: { error: { message: 'email_in_use' } } },
      message: 'Request failed',
    };
    await expect(
      client.interceptors.response.handlers[0].rejected(err)
    ).rejects.toMatchObject({ status: 409, message: 'email_in_use' });
  });

  it('falls back to err.message when no response body', async () => {
    const err = { response: { status: 500, data: {} }, message: 'timeout' };
    await expect(
      client.interceptors.response.handlers[0].rejected(err)
    ).rejects.toMatchObject({ status: 500, message: 'timeout' });
  });

  it('uses "Network error" when completely missing response', async () => {
    const err = { message: undefined };
    await expect(
      client.interceptors.response.handlers[0].rejected(err)
    ).rejects.toMatchObject({ message: 'Network error' });
  });

  it('passes through successful responses unchanged', async () => {
    const res = { status: 200, data: { ok: true } };
    const result = client.interceptors.response.handlers[0].fulfilled(res);
    expect(result).toBe(res);
  });
});
