import { useState } from 'react';
import '../styles/ChatMessage.css';

function renderInline(text) {
  const parts = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[0].startsWith('**')) {
      parts.push(<strong key={m.index}>{m[1]}</strong>);
    } else {
      parts.push(<em key={m.index}>{m[2]}</em>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function renderMarkdown(text) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        const m = lines[i].match(/^\d+\. (.+)$/);
        items.push(<li key={i}>{renderInline(m ? m[1] : lines[i])}</li>);
        i++;
      }
      elements.push(<ol key={`ol-${i}`}>{items}</ol>);
      continue;
    }
    if (line.trim()) {
      elements.push(<p key={i}>{renderInline(line)}</p>);
    }
    i++;
  }
  return elements;
}

function ConfidenceBadge({ score }) {
  if (score >= 0.75) return <span className="confidence-high">✓ From your documents</span>;
  if (score >= 0.55) return <span className="confidence-medium">medium confidence</span>;
  return <span className="confidence-low">low confidence</span>;
}

function SourceCard({ source }) {
  const scorePercent = Math.round(source.score * 100);
  const filename = source.filename || `doc:${source.document_id?.substring(0, 6)}`;
  const rawText = source.text || '';
  const preview = rawText.length > 120 ? rawText.substring(0, 120) + '…' : rawText;

  return (
    <div className="source-card">
      <div className="source-card-header">
        <span className="source-filename" title={source.filename}>{filename}</span>
        <div className="source-score-bar-wrap">
          <span className="source-score-value">{scorePercent}%</span>
          <div className="source-score-bar">
            <div className="source-score-fill" style={{ width: `${scorePercent}%` }} />
          </div>
        </div>
      </div>
      <p className="source-preview">{preview}</p>
      {source.chunk_id && (
        <div className="source-chunk-id">chunk:{source.chunk_id}</div>
      )}
    </div>
  );
}

export default function ChatMessage({ role, content, sources, isLoading, isStreaming, mode, timestamp }) {
  const [showSources, setShowSources] = useState(false);
  const isUser = role === 'user';
  const hasRealSources = sources && sources.length > 0;

  if (isLoading || (isStreaming && !content)) {
    return (
      <div className="message-row assistant">
        <div className="message-role assistant-role"><span>system</span></div>
        <div className="thinking-wrap">
          <div className="typing-bubble">
            <div className="typing-dot" />
            <div className="typing-dot" />
            <div className="typing-dot" />
          </div>
        </div>
      </div>
    );
  }

  const maxScore = hasRealSources ? Math.max(...sources.map(s => s.score)) : 0;

  return (
    <div className={`message-row ${isUser ? 'user' : 'assistant'}`}>
      <div className={`message-role ${isUser ? 'user-role' : 'assistant-role'}`}>
        <span>{isUser ? 'you' : 'system'}</span>
        {timestamp && (
          <span className="message-timestamp">{new Date(timestamp).toLocaleTimeString()}</span>
        )}
      </div>

      <div className={`message-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}>
        {isUser ? (
          <p className="message-text">{content}</p>
        ) : (
          <div className="message-text">
            {renderMarkdown(content)}
            {isStreaming && <span className="cursor" />}
          </div>
        )}
        {mode === 'retrieval' && (
          <div className="retrieval-badge">retrieval only — no LLM key set</div>
        )}
      </div>

      {!isUser && hasRealSources && (
        <div className="sources-section">
          <ConfidenceBadge score={maxScore} />
          <button
            className="sources-toggle"
            onClick={() => setShowSources(s => !s)}
          >
            <span>{sources.length} references</span>
            <span className={`sources-toggle-chevron ${showSources ? 'open' : ''}`}>›</span>
          </button>
          {showSources && (
            <div className="sources-grid">
              {sources.map((src, i) => <SourceCard key={i} source={src} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
