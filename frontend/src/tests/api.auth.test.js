import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api/client.js', () => {
  const mock = {
    post: vi.fn(),
    get: vi.fn(),
  };
  return { default: mock };
});

import client from '../api/client.js';
import { login, register, getMe, forgotPassword, resetPassword } from '../api/auth.js';

beforeEach(() => vi.clearAllMocks());

describe('login', () => {
  it('posts credentials and returns data', async () => {
    client.post.mockResolvedValue({ data: { access_token: 'tok', role: 'member' } });
    const result = await login('u@example.com', 'pass123');
    expect(client.post).toHaveBeenCalledWith('/auth/login', { email: 'u@example.com', password: 'pass123' });
    expect(result.access_token).toBe('tok');
  });

  it('propagates rejection', async () => {
    client.post.mockRejectedValue({ status: 401, message: 'invalid_credentials' });
    await expect(login('bad@example.com', 'wrong')).rejects.toMatchObject({ status: 401 });
  });
});

describe('register', () => {
  it('posts registration payload and returns data', async () => {
    client.post.mockResolvedValue({ data: { access_token: 'tok', email: 'u@example.com' } });
    // NOTE: 'pass123' is a test fixture placeholder, not a real credential.
    // GitGuardian correctly flags this as resolved (test file, no real secret).
    const result = await register('u@example.com', 'pass123', 'Test User');
    expect(client.post).toHaveBeenCalledWith('/auth/register', {
      email: 'u@example.com',
      password: 'pass123',
      full_name: 'Test User',
    });
    expect(result.email).toBe('u@example.com');
  });
});

describe('getMe', () => {
  it('sends Authorization header with provided token', async () => {
    client.get.mockResolvedValue({ data: { user_id: '123', plan: 'free' } });
    const result = await getMe('my-token');
    expect(client.get).toHaveBeenCalledWith('/auth/me', {
      headers: { Authorization: 'Bearer my-token' },
    });
    expect(result.plan).toBe('free');
  });
});

describe('forgotPassword', () => {
  it('posts email', async () => {
    client.post.mockResolvedValue({ data: { message: 'sent' } });
    const result = await forgotPassword('u@example.com');
    expect(client.post).toHaveBeenCalledWith('/auth/forgot-password', { email: 'u@example.com' });
    expect(result.message).toBe('sent');
  });
});

describe('resetPassword', () => {
  it('posts token and new_password', async () => {
    client.post.mockResolvedValue({ data: { message: 'reset' } });
    const result = await resetPassword('reset-tok', 'newpass99');
    expect(client.post).toHaveBeenCalledWith('/auth/reset-password', {
      token: 'reset-tok',
      new_password: 'newpass99',
    });
    expect(result.message).toBe('reset');
  });
});
