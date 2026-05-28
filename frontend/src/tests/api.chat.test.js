import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api/client.js', () => ({
  default: { post: vi.fn() },
  API_BASE_URL: 'http://localhost:8000',
}));

import client from '../api/client.js';
import { sendChat, streamChat } from '../api/chat.js';

beforeEach(() => vi.clearAllMocks());

describe('sendChat', () => {
  it('posts to /chat with correct payload', async () => {
    client.post.mockResolvedValue({ data: { answer: 'Hello', sources: [] } });
    const result = await sendChat('ws-1', 'What is this?', 'user-1', 3);
    expect(client.post).toHaveBeenCalledWith('/chat', {
      workspace_id: 'ws-1',
      question: 'What is this?',
      user_id: 'user-1',
      top_k: 3,
      debug: false,
    });
    expect(result.answer).toBe('Hello');
  });

  it('omits user_id when null', async () => {
    client.post.mockResolvedValue({ data: { answer: '' } });
    await sendChat('ws-1', 'Q?', null);
    const payload = client.post.mock.calls[0][1];
    expect(payload).not.toHaveProperty('user_id');
  });

  it('defaults top_k to 5', async () => {
    client.post.mockResolvedValue({ data: {} });
    await sendChat('ws-1', 'Q?');
    expect(client.post.mock.calls[0][1].top_k).toBe(5);
  });
});

// Helper to build a minimal SSE ReadableStream from an array of event strings
function makeSSEStream(events) {
  const encoder = new TextEncoder();
  const chunks = events.map((e) => encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(chunks[i++]);
      } else {
        controller.close();
      }
    },
  });
}

describe('streamChat — SSE parsing', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('dispatches sources, delta, and done events', async () => {
    const sources = [{ document_id: 'd-1', score: 0.9 }];
    global.fetch.mockResolvedValue({
      ok: true,
      body: makeSSEStream([
        { type: 'sources', data: sources },
        { type: 'delta', data: 'Hello ' },
        { type: 'delta', data: 'world' },
        { type: 'done', data: { mode: 'rag', latency_ms: 120 } },
      ]),
    });

    const onSources = vi.fn();
    const onDelta = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    await streamChat('ws-1', 'Q?', [], onDelta, onSources, onDone, onError);

    expect(onSources).toHaveBeenCalledWith(sources);
    expect(onDelta).toHaveBeenCalledWith('Hello ');
    expect(onDelta).toHaveBeenCalledWith('world');
    expect(onDone).toHaveBeenCalledWith({ mode: 'rag', latency_ms: 120 });
    expect(onError).not.toHaveBeenCalled();
  });

  it('calls onError when response is not ok', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      body: null,
      text: async () => 'Service unavailable',
    });

    const onError = vi.fn();
    await streamChat('ws-1', 'Q?', [], vi.fn(), vi.fn(), vi.fn(), onError);
    expect(onError).toHaveBeenCalledWith('Service unavailable');
  });

  it('calls onError on SSE error event', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      body: makeSSEStream([{ type: 'error', data: 'quota_exceeded' }]),
    });

    const onError = vi.fn();
    await streamChat('ws-1', 'Q?', [], vi.fn(), vi.fn(), vi.fn(), onError);
    expect(onError).toHaveBeenCalledWith('quota_exceeded');
  });

  it('limits history to last 12 turns', async () => {
    global.fetch.mockResolvedValue({ ok: true, body: makeSSEStream([]) });
    const history = Array.from({ length: 20 }, (_, i) => ({ role: 'user', content: `q${i}` }));
    await streamChat('ws-1', 'Q?', history, vi.fn(), vi.fn(), vi.fn(), vi.fn());
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.history).toHaveLength(12);
  });

  it('attaches Authorization header when token in localStorage', async () => {
    localStorage.setItem('authToken', 'stream-tok');
    global.fetch.mockResolvedValue({ ok: true, body: makeSSEStream([]) });
    await streamChat('ws-1', 'Q?', [], vi.fn(), vi.fn(), vi.fn(), vi.fn());
    const headers = global.fetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe('Bearer stream-tok');
  });
});
