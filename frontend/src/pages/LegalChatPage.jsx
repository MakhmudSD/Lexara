import { useState } from 'react';
import ChatMessage from '../components/ChatMessage';
import { LexaraIcon } from '../assets/LexaraLogo';
import { useTranslation } from '../i18n/useTranslation';
import { useChatSession } from '../hooks/useChatSession';
import '../styles/ChatPage.css';
import '../styles/LegalChatPage.css';

export default function LegalChatPage({ workspaceId, workspaceName, jurisdiction = 'KR', onBack, onUpgrade }) {
  const { t } = useTranslation();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleQuotaError = ({ code }) => {
    if (code === 'legal_quota_exceeded') setShowUpgradeModal(true);
  };

  const {
    messages, sessions, activeSessionId,
    input, setInput, sidebarOpen, setSidebarOpen,
    isLoading, error,
    messagesEndRef, textareaRef,
    sendMessage, createNewSession, deleteSession, loadSession,
  } = useChatSession({ workspaceId, jurisdiction, t, onQuotaError: handleQuotaError });

  const canSend = input.trim() && !isLoading;
  const isEmpty = messages.length === 0 && !isLoading;

  const displayTitle = jurisdiction === 'UZ'
    ? (t('uzbek_law') || 'Uzbek Law')
    : (t('korean_law') || 'Korean Law');

  const emptyStateText = jurisdiction === 'UZ'
    ? (t('legal_uz_empty') || 'Ask about Uzbek statutes — Labour Code, Civil Code, Criminal Code, and the Constitution.')
    : (t('legal_kr_empty') || 'Ask about Korean statutes — Personal Information Protection Act, Labor Standards Act, Civil Act, Criminal Act, and the Constitution.');

  const formatDate = (date) => {
    try { return new Date(date).toLocaleDateString(); } catch { return ''; }
  };

  return (
    <div className="chat-page">
      <button className="sidebar-toggle" onClick={() => setSidebarOpen((value) => !value)}>
        {sidebarOpen ? '✕' : '☰'}
      </button>
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`chat-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-section">
          <div className="sidebar-label">{t('conversations')}</div>
          <button className="new-chat-btn" onClick={createNewSession}>
            + {t('new_conversation')}
          </button>
          <div className="sessions-list">
            {[...sessions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map((session) => (
              <div
                key={session.id}
                className={`session-item ${activeSessionId === session.id ? 'active' : ''}`}
                onClick={() => { loadSession(session.id); setSidebarOpen(false); }}
              >
                <span className="session-title">{session.title || t('new_conversation')}</span>
                <span className="session-date">{formatDate(session.createdAt)}</span>
                <button
                  className="session-delete"
                  onClick={(event) => { event.stopPropagation(); deleteSession(session.id); }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="chat-main">
        <div className="legal-chat-header">
          <div className="legal-chat-header-ws">
            <span className="legal-chat-badge">{jurisdiction}</span>
            <div className="chat-status-dot" />
            <span className="legal-chat-ws-name">{displayTitle}</span>
          </div>
          <button type="button" className="legal-chat-back" onClick={onBack}>
            {t('legal_back') || '← All databases'}
          </button>
        </div>

        <div className="chat-messages">
          {isEmpty && (
            <div className="legal-chat-empty">
              <LexaraIcon size={32} />
              <p>{emptyStateText}</p>
            </div>
          )}
          {messages.map((message, index) => (
            <ChatMessage
              key={message.id || index}
              role={message.role}
              content={message.content}
              sources={message.sources}
              mode={message.mode}
              isStreaming={message.isStreaming}
              timestamp={message.timestamp}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="chat-input-area">
          <div className="chat-input-wrapper">
            <textarea
              ref={textareaRef}
              className="chat-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder={t('ask_placeholder') || 'Ask a legal question…'}
              disabled={isLoading}
              rows={1}
            />
            <button className="send-btn" onClick={() => sendMessage(input)} disabled={!canSend} title={t('send')}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2 14L14 8 2 2" />
                <path d="M14 8H6" />
              </svg>
            </button>
          </div>
          <div className="input-hint">{t('newline_hint') || '⏎ Send · ⇧⏎ New line'}</div>
        </div>
      </main>

      {showUpgradeModal && (
        <div className="legal-upgrade-overlay" role="dialog" aria-modal="true">
          <div className="legal-upgrade-modal">
            <h2>{t('legal_upgrade_modal_title') || 'Monthly limit reached'}</h2>
            <p>{t('legal_upgrade_modal_body') || "You've used all 5 free legal questions this month. Upgrade to Pro for unlimited Korean law — and Business for Uzbek law too."}</p>
            <div className="legal-upgrade-modal-actions">
              <button
                className="legal-upgrade-btn-primary"
                onClick={() => { if (onUpgrade) onUpgrade(); }}
              >
                {t('legal_upgrade_modal_cta') || 'Upgrade now'}
              </button>
              <button
                className="legal-upgrade-btn-secondary"
                onClick={() => setShowUpgradeModal(false)}
              >
                {t('legal_upgrade_modal_dismiss') || 'Maybe later'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
