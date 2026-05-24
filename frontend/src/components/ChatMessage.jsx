import { useState } from 'react';
import '../styles/ChatMessage.css';

export default function ChatMessage({ role, content, sources }) {
  const [showSources, setShowSources] = useState(false);

  const isUser = role === 'user';

  return (
    <div className={`chat-message ${isUser ? 'user' : 'assistant'}`}>
      <div className={`message-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}>
        <p className="message-text">{content}</p>
      </div>

      {sources && sources.length > 0 && (
        <div className="sources-container">
          <button className="sources-toggle" onClick={() => setShowSources(!showSources)}>
            📚 {sources.length} source{sources.length !== 1 ? 's' : ''} {showSources ? '▼' : '▶'}
          </button>
          {showSources && (
            <div className="sources-list">
              {sources.map((source, idx) => (
                <div key={idx} className="source-item">
                  <div className="source-header">
                    <strong>{source.filename}</strong>
                    <span className="source-score">{(source.score * 100).toFixed(1)}%</span>
                  </div>
                  <p className="source-text">{source.text.substring(0, 200)}...</p>
                  <span className="source-chunk">Chunk: {source.chunk_id}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
