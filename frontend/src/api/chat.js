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
    const token = localStorage.getItem('authToken');
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
      }),
    });

    if (!response.ok || !response.body) {
      const fallback = await response.text();
      throw new Error(fallback || 'Streaming request failed');
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

        const payload = JSON.parse(dataLine.slice(6));
        if (payload.type === 'sources') onSources?.(payload.data);
        if (payload.type === 'delta') onDelta?.(payload.data);
        if (payload.type === 'done') onDone?.(payload.data);
        if (payload.type === 'error') onError?.(payload.data);
      }
    }
  } catch (error) {
    onError?.(error.message || 'Streaming request failed');
  }
};
