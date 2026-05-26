import { useState } from 'react';
import { useTranslation } from '../i18n/useTranslation';
import '../styles/ChatMessage.css';

function SourceCard({ source }) {
  const scorePercent = Math.round((source.score || 0) * 100);
  const filename = source.filename || `doc:${String(source.document_id).slice(0, 8)}`;

  return (
    <div className="source-card">
      <div className="source-card-header">
        <span className="source-filename" title={filename}>
          {filename}
        </span>
        <div className="source-score-bar-wrap">
          <span className="source-score-value">{scorePercent}%</span>
          <div className="source-score-bar">
            <div className="source-score-fill" style={{ width: `${scorePercent}%` }} />
          </div>
        </div>
      </div>
      <p className="source-excerpt">
        {source.text?.substring(0, 160)}
        {source.text?.length > 160 ? '…' : ''}
      </p>
      {source.chunk_id && (
        <div className="source-chunk-id">chunk:{String(source.chunk_id)}</div>
      )}
    </div>
  );
}

export default function ChatMessage({ role, content, sources, isLoading, mode, isStreaming }) {
  const { t } = useTranslation();
  const [showSources, setShowSources] = useState(false);
  const isUser = role === 'user';
  const hasRealSources = sources && sources.length > 0;
  const hasAnswer = role === 'assistant' && mode === 'rag' && content && content.trim();
  const showThinking = !isUser && isStreaming && (!content || content.length === 0);

  if (isLoading) {
    return (
      <div className="message-row assistant">
        <div className="message-role assistant-role">
          <span>system</span>
        </div>
        <div className="typing-bubble">
          <div className="typing-dot" />
          <div className="typing-dot" />
          <div className="typing-dot" />
        </div>
      </div>
    );
  }

  return (
    <div className={`message-row ${isUser ? 'user' : 'assistant'}`}>
      <div className={`message-role ${isUser ? 'user-role' : 'assistant-role'}`}>
        {isUser ? 'you' : 'system'}
      </div>

      <div className={`message-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}>
        {!isUser && mode === 'retrieval' && (
          <div className="retrieval-badge">{t('retrieval_only_badge')}</div>
        )}
        {hasAnswer ? (
          <div className="answer-block">
            <p className="message-text">
              {content}
              {isStreaming && <span className="cursor" aria-hidden="true" />}
            </p>
          </div>
        ) : (
          content ? (
            <p className="message-text">
              {content}
              {isStreaming && <span className="cursor" aria-hidden="true" />}
            </p>
          ) : (
            showThinking ? (
              <div className="thinking-wrap">
                <div className="typing-bubble">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
                <div className="thinking-text">Lexara is thinking…</div>
              </div>
            ) : (isStreaming ? <span className="cursor" aria-hidden="true" /> : null)
          )
        )}
      </div>

      {hasRealSources && (
        <div className="sources-section">
          <button className="sources-toggle" onClick={() => setShowSources((value) => !value)}>
            <span>{t('references')}</span>
            <span className="sources-count">{sources.length}</span>
            <span className={`sources-toggle-chevron ${showSources ? 'open' : ''}`}>›</span>
          </button>

          {showSources && (
            <div className="sources-grid">
              {sources.map((source, index) => (
                <SourceCard key={index} source={source} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
