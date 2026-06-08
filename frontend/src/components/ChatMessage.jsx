import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { useTranslation } from '../i18n/useTranslation';
import '../styles/ChatMessage.css';

function escapeHtml(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatInline(text = '') {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
}

function renderMarkdown(text = '') {
  const escaped = escapeHtml(text);
  const lines = escaped.split(/\r?\n/);
  const blocks = [];
  let paragraph = [];
  let listItems = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${paragraph.join('<br/>')}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(`<ol>${listItems.map((item) => `<li>${item}</li>`).join('')}</ol>`);
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const numbered = line.match(/^(\d+)\.\s+(.+)$/);

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (numbered) {
      flushParagraph();
      listItems.push(formatInline(numbered[2]));
      continue;
    }

    flushList();
    paragraph.push(formatInline(line));
  }

  flushParagraph();
  flushList();
  return blocks.join('');
}

function SourceCard({ source, plan }) {
  const effectivePlan = (plan || 'free').toLowerCase();
  const score = source.score || 0;
  const scoreClass = score >= 0.75 ? 'high' : score >= 0.55 ? 'medium' : 'low';
  const filename = source.filename || `doc:${String(source.document_id).slice(0, 8)}`;

  // B3: citation richness by plan
  const showExcerpt = effectivePlan === 'pro' || effectivePlan === 'business';
  const showScoreBadge = effectivePlan === 'business';
  const excerptLen = effectivePlan === 'business' ? 400 : 200;
  const excerpt = showExcerpt && source.text
    ? source.text.substring(0, excerptLen) + (source.text.length > excerptLen ? '…' : '')
    : null;

  return (
    <div className="source-card">
      <div className="source-card-header">
        <span className={`source-score-dot ${scoreClass}`} aria-hidden="true" />
        <span className="source-filename" title={filename}>{filename}</span>
        {showScoreBadge && (
          <span className={`source-score-badge source-score-badge--${scoreClass}`}>
            {Math.round(score * 100)}%
          </span>
        )}
      </div>
      {excerpt && <p className="source-preview">{excerpt}</p>}
    </div>
  );
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  try {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function ChatMessage({ role, content, sources, mode, isStreaming, timestamp }) {
  const { t } = useTranslation();
  const [showSources, setShowSources] = useState(false);
  const _plan = (() => { try { const u = JSON.parse(localStorage.getItem('authUser') || '{}'); const exp = u.plan_expires_at && new Date(u.plan_expires_at) < new Date(); return exp ? 'free' : (u.plan || 'free'); } catch { return 'free'; } })();
  const rowRef = useRef(null);

  useEffect(() => {
    const el = rowRef.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.fromTo(
      el,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' }
    );
  // run only on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const isUser = role === 'user';
  const hasRealSources = sources && sources.length > 0;
  const hasAnswer = role === 'assistant' && content && content.trim();
  const showThinking = !isUser && isStreaming && (!content || content.length === 0);
  const renderedAnswer = !isUser && content ? renderMarkdown(content) : '';

  const topScore = sources?.length > 0
    ? Math.max(...sources.map((s) => s.score || 0))
    : null;

  const tier = topScore === null ? null
    : topScore >= 0.7 ? 'high'
    : topScore >= 0.4 ? 'medium'
    : 'low';

  if (role === 'system') {
    return (
      <div className="chat-message-system">
        <span>{content}</span>
      </div>
    );
  }


  return (
    <div ref={rowRef} className={`message-row ${isUser ? 'user' : 'assistant'}`}>
      <div className={`message-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}>
        {!isUser && mode === 'retrieval' && (
          <div className="retrieval-badge">{t('retrieval_only_badge')}</div>
        )}
        {hasAnswer ? (
          <div className="answer-block">
            {isUser ? (
              <p className="message-text">
                {content}
                {isStreaming && <span className="cursor" aria-hidden="true" />}
              </p>
            ) : (
              <>
                <div className="message-text" dangerouslySetInnerHTML={{ __html: renderedAnswer }} />
                {isStreaming && <span className="cursor" aria-hidden="true" />}
              </>
            )}
          </div>
        ) : (
          content ? (
            isUser ? (
              <p className="message-text">
                {content}
                {isStreaming && <span className="cursor" aria-hidden="true" />}
              </p>
            ) : (
              <>
                <div className="message-text" dangerouslySetInnerHTML={{ __html: renderedAnswer }} />
                {isStreaming && <span className="cursor" aria-hidden="true" />}
              </>
            )
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
      </div>

      {timestamp && <span className="message-timestamp">{formatTime(timestamp)}</span>}

      {hasRealSources && (
        <div className="sources-section">
          <div className="sources-meta-row">
            <button className="sources-toggle-btn" type="button" onClick={() => setShowSources((value) => !value)}>
              <span>{sources.length} {t('references')}</span>
              <span className="sources-arrow">{showSources ? '↑' : '↓'}</span>
            </button>

            {tier === 'medium' && (
              <div className="confidence-badge confidence-medium">
                {t('source_medium') || 'Relevant'}
              </div>
            )}
            {tier === 'low' && (
              <div className="confidence-badge confidence-low">
                {t('source_low') || 'Possibly relevant'}
              </div>
            )}
          </div>
          {tier === 'high' && <div className="confidence-high-note">{t('from_your_documents')}</div>}
          {tier === 'low' && <div className="confidence-tip">{t('confidence_tip')}</div>}

          {showSources && (
            <div className="sources-grid">
              {sources.map((source, index) => (
                <SourceCard key={index} source={source} plan={_plan} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
