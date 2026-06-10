import client, { API_BASE_URL } from './client';

export const sendChat = (workspaceId, question, userId = null, topK = 5) =>
  client.post('/chat', {
    workspace_id: workspaceId,
    question,
    ...(userId ? { user_id: userId } : {}),
    top_k: topK,
    debug: false,
  }).then((response) => response.data);

export const streamChat = async (
  workspaceId,
  question,
  history,
  onDelta,
  onSources,
  onDone,
  onError,
) => {
  try {
    const token = localStorage.getItem('access_token');
    let userId = null;
    try {
      const authUser = JSON.parse(localStorage.getItem('authUser') || '{}');
      userId = authUser?.id || authUser?.user_id || null;
    } catch {
      // ignore
    }
    const response = await fetch(`${API_BASE_URL}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        question,
        top_k: 5,
        history: history.slice(-12),
        ...(userId ? { user_id: userId } : {}),
      }),
    });

    if (!response.ok || !response.body) {
      const fallback = await response.text();
      let errData;
      try {
        const parsed = JSON.parse(fallback);
        const errorObj = parsed.error || parsed;
        errData = { code: errorObj.code || 'request_failed', message: errorObj.message || fallback || 'Streaming request failed' };
      } catch {
        errData = { code: 'request_failed', message: fallback || 'Streaming request failed' };
      }
      onError?.(errData);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const eventChunk of events) {
        const dataLine = eventChunk
          .split('\n')
          .find((line) => line.startsWith('data: '));

        if (!dataLine) continue;

        let payload;
        try {
          payload = JSON.parse(dataLine.slice(6));
        } catch {
          onError?.({ code: 'parse_error', message: 'Malformed response from server' });
          continue;
        }
        if (payload.type === 'sources') onSources?.(payload.data);
        if (payload.type === 'delta') onDelta?.(payload.data);
        if (payload.type === 'done') onDone?.(payload.data);
        if (payload.type === 'error') onError?.(payload.data);
      }
    }
  } catch (error) {
    onError?.({ code: 'network_error', message: error.message || 'Streaming request failed' });
  }
};
