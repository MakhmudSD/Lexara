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

  const topScore = sources?.length > 0
    ? Math.max(...sources.map((s) => s.score || 0))
    : null;

  const tier = topScore === null ? null
    : topScore >= 0.75 ? 'high'
    : topScore >= 0.55 ? 'medium'
    : 'low';

  const tierConfig = {
    high:   { color: '#16a34a', bg: '#f0fdf4', label: `${Math.round(topScore * 100)}% match` },
    medium: { color: '#d97706', bg: '#fffbeb', label: `${Math.round(topScore * 100)}% match · verify sources` },
    low:    { color: '#dc2626', bg: '#fef2f2', label: `Low match · document may not contain this answer` },
  };

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

          {tier && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: tierConfig[tier].bg,
              border: `1px solid ${tierConfig[tier].color}22`,
              borderRadius: 100, padding: '3px 10px',
              fontSize: 11, color: tierConfig[tier].color,
              fontFamily: 'var(--font-mono)', marginTop: 8,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: tierConfig[tier].color }} />
              {tierConfig[tier].label}
            </div>
          )}

          {tier === 'low' && (
            <p style={{ fontSize: 11, color: '#dc2626', marginTop: 6, lineHeight: 1.5 }}>
              The retrieved passages have low similarity to your question.
              The answer above may not accurately reflect your documents.
            </p>
          )}

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
