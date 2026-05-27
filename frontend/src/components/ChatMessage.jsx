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

function formatTime(timestamp) {
  if (!timestamp) return '';
  try {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function ChatMessage({ role, content, sources, isLoading, mode, isStreaming, timestamp }) {
  const { t } = useTranslation();
  const isUser = role === 'user';
  const hasAnswer = role === 'assistant' && content && content.trim();
  const showThinking = !isUser && isStreaming && (!content || content.length === 0);
  const renderedAnswer = !isUser && content ? renderMarkdown(content) : '';

  if (isLoading) {
    return (
      <div className="message-row assistant">
        <div className="typing-bubble">
          <div className="thinking-dot" />
          <div className="thinking-dot" />
          <div className="thinking-dot" />
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

        {sources && sources.length > 0 && (
          <div className="message-sources">
            <div className="source-label">Sources</div>
            {sources.map((src, i) => (
              <div key={i} className="source-chip">
                <span>{src.filename || 'Document'}</span>
                {src.score != null && (
                  <span className="score-badge">{Math.round(src.score * 100)}%</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {timestamp && <span className="message-timestamp">{formatTime(timestamp)}</span>}
    </div>
  );
}
