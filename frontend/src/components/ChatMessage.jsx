import { useState } from 'react';
import { useTranslation } from '../i18n/useTranslation';
import '../styles/ChatMessage.css';

function SourceCard({ source }) {
  const score = source.score || 0;
  const scoreDot = score >= 0.75 ? '🟢' : score >= 0.55 ? '🟡' : '⚪';
  const filename = source.filename || `doc:${String(source.document_id).slice(0, 8)}`;
  const preview = source.text ? `${source.text.substring(0, 120)}${source.text.length > 120 ? '…' : ''}` : '';

  return (
    <div className="source-card">
      <div className="source-card-header">
        <span className="source-score-dot" aria-hidden="true">{scoreDot}</span>
        <span className="source-filename" title={filename}>
          {filename}
        </span>
      </div>
      <p className="source-preview">
        {preview}
      </p>
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

  if (isLoading) {
    return (
      <div className="message-row assistant">
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
          <div className="confidence-tip">
            {t('confidence_tip')}
          </div>
        )}
      </div>

      {hasRealSources && (
        <div className="sources-section">
          <div className="sources-meta-row">
            <button className="sources-toggle-btn" type="button" onClick={() => setShowSources((value) => !value)}>
              <span className="sources-icon">📄</span>
              <span>{sources.length} {t('references')}</span>
              <span className="sources-arrow">{showSources ? '↑' : '↓'}</span>
            </button>

            {tier === 'medium' && (
              <div className="confidence-badge confidence-medium">
                {t('confidence_medium')}
              </div>
            )}

            {tier === 'low' && (
              <div className="confidence-badge confidence-low">
                {t('confidence_low')}
              </div>
            )}
          </div>

          {tier === 'high' && (
            <div className="from-documents-note">
              {t('from_your_documents')}
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
