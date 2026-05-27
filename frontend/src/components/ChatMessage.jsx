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
    medium: {
      bg: '#fffbeb',
      color: '#92400e',
      border: '#fde68a',
      label: t('confidence_medium'),
    },
    low: {
      bg: '#f9fafb',
      color: '#6b7280',
      border: '#e5e7eb',
      label: t('confidence_low'),
    },
  };

  if (isLoading) {
    return (
      <div className="message-row assistant">
        <div className="message-role assistant-role">
          <span>{t('system_label')}</span>
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
        {isUser ? t('you_label') : t('system_label')}
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
                <div className="thinking-text">{t('thinking')}</div>
              </div>
            ) : (isStreaming ? <span className="cursor" aria-hidden="true" /> : null)
          )
        )}
        {!isUser && tier === 'low' && (
          <div style={{
            marginTop: 8,
            fontSize: 12,
            color: 'var(--text-secondary)',
            fontStyle: 'italic',
            lineHeight: 1.5,
          }}>
            {t('confidence_tip')}
          </div>
        )}
      </div>

      {hasRealSources && (
        <div className="sources-section">
          <button className="sources-toggle" onClick={() => setShowSources((value) => !value)}>
            <span>{t('references')}</span>
            <span className="sources-count">{sources.length}</span>
            <span className={`sources-toggle-chevron ${showSources ? 'open' : ''}`}>›</span>
          </button>

          {tier === 'high' && (
            <div style={{
              marginTop: 8,
              fontSize: 11,
              color: 'var(--text-tertiary)',
              fontFamily: 'var(--font-mono)',
            }}>
              {t('from_your_documents')}
            </div>
          )}

          {tier === 'medium' && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: tierConfig.medium.bg,
              border: `1px solid ${tierConfig.medium.border}`,
              borderRadius: 100,
              padding: '2px 10px',
              fontSize: 11,
              color: tierConfig.medium.color,
              fontFamily: 'var(--font-mono)',
              marginTop: 8,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: tierConfig.medium.color }} />
              {tierConfig.medium.label}
            </div>
          )}

          {tier === 'low' && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: tierConfig.low.bg,
              border: `1px solid ${tierConfig.low.border}`,
              borderRadius: 100,
              padding: '2px 10px',
              fontSize: 11,
              color: tierConfig.low.color,
              fontFamily: 'var(--font-mono)',
              marginTop: 8,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: tierConfig.low.color }} />
              {tierConfig.low.label}
            </div>
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
