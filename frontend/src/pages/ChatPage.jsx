import { useState, useEffect, useRef } from 'react';
import ChatMessage from '../components/ChatMessage';
import FileUploader from '../components/FileUploader';
import WorkspaceSelector from '../components/WorkspaceSelector';
import { sendChat } from '../api/chat';
import '../styles/ChatPage.css';

export default function ChatPage({ workspaceId, onChangeWorkspace }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || !workspaceId) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setError('');

    // Add user message to UI
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await sendChat(workspaceId, userMessage);
      
      // Add AI message with sources
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.answer,
          sources: response.sources,
        },
      ]);
    } catch (err) {
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to get response';
      setError(errorMsg);
      console.error('Chat error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="chat-page">
      <div className="chat-sidebar">
        <WorkspaceSelector
          workspaceId={workspaceId}
          onWorkspaceChange={onChangeWorkspace}
          onStartChat={() => {
            setMessages([]);
            setError('');
          }}
        />
        <FileUploader
          workspaceId={workspaceId}
          onUploadSuccess={() => {
            setError('');
          }}
          onUploadError={(msg) => {
            setError(msg);
          }}
        />
      </div>

      <div className="chat-main">
        <div className="chat-header">
          <h1>🤖 RAG Chat</h1>
          <p className="chat-subtitle">Workspace: {workspaceId}</p>
        </div>

        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="empty-state">
              <p>👋 Start a conversation by asking a question about your documents.</p>
            </div>
          )}
          {messages.map((msg, idx) => (
            <ChatMessage key={idx} role={msg.role} content={msg.content} sources={msg.sources} />
          ))}
          {isLoading && (
            <div className="chat-message assistant">
              <div className="message-bubble assistant-bubble loading">
                <span className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="chat-input-container">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question about your documents..."
            className="chat-input"
            disabled={!workspaceId || isLoading}
            rows="3"
          />
          <button onClick={handleSendMessage} disabled={!inputValue.trim() || isLoading || !workspaceId} className="send-btn">
            {isLoading ? '⏳ Loading...' : '📤 Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
