import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatMessage from '../components/ChatMessage.jsx';

// ChatMessage uses useTranslation internally — no mock needed since the
// real implementation falls back to English keys.


describe('ChatMessage — user message', () => {
  it('renders user content as plain text', () => {
    render(<ChatMessage role="user" content="Hello world" />);
    expect(screen.getByText('Hello world')).toBeTruthy();
  });

  it('applies user CSS class', () => {
    const { container } = render(<ChatMessage role="user" content="Hi" />);
    expect(container.querySelector('.message-row.user')).toBeTruthy();
  });

  it('does not render a sources section for user messages', () => {
    const { container } = render(<ChatMessage role="user" content="Hi" sources={[]} />);
    expect(container.querySelector('.sources-section')).toBeNull();
  });
});

describe('ChatMessage — assistant message', () => {
  it('applies assistant CSS class', () => {
    const { container } = render(<ChatMessage role="assistant" content="Answer" />);
    expect(container.querySelector('.message-row.assistant')).toBeTruthy();
  });

  it('renders markdown bold as <strong>', () => {
    const { container } = render(<ChatMessage role="assistant" content="**bold text**" />);
    expect(container.querySelector('strong')).toBeTruthy();
    expect(container.querySelector('strong').textContent).toBe('bold text');
  });

  it('renders markdown italic as <em>', () => {
    const { container } = render(<ChatMessage role="assistant" content="*italic*" />);
    expect(container.querySelector('em').textContent).toBe('italic');
  });

  it('renders numbered list as <ol><li>', () => {
    const { container } = render(<ChatMessage role="assistant" content={'1. First\n2. Second'} />);
    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toBe('First');
  });

  it('XSS-escapes HTML in content', () => {
    const { container } = render(
      <ChatMessage role="assistant" content={'<script>alert(1)</script>'} />
    );
    expect(container.innerHTML).not.toContain('<script>');
    expect(container.innerHTML).toContain('&lt;script&gt;');
  });

  it('shows retrieval_only badge in retrieval mode', () => {
    render(<ChatMessage role="assistant" content="Answer" mode="retrieval" />);
    expect(screen.getByText('Document search mode')).toBeTruthy();
  });

  it('does not show retrieval badge in rag mode', () => {
    const { container } = render(<ChatMessage role="assistant" content="Answer" mode="rag" />);
    expect(container.querySelector('.retrieval-badge')).toBeNull();
  });
});

describe('ChatMessage — streaming state', () => {
  it('shows thinking animation when streaming with no content', () => {
    const { container } = render(
      <ChatMessage role="assistant" content="" isStreaming={true} />
    );
    expect(container.querySelector('.thinking-wrap')).toBeTruthy();
  });

  it('shows cursor when streaming with content', () => {
    const { container } = render(
      <ChatMessage role="assistant" content="Partial" isStreaming={true} />
    );
    expect(container.querySelector('.cursor')).toBeTruthy();
  });
});

describe('ChatMessage — timestamp', () => {
  it('renders formatted timestamp', () => {
    const ts = new Date('2024-01-01T14:30:00').toISOString();
    render(<ChatMessage role="user" content="Hi" timestamp={ts} />);
    expect(document.querySelector('.message-timestamp')).toBeTruthy();
  });

  it('does not render timestamp when not provided', () => {
    render(<ChatMessage role="user" content="Hi" />);
    expect(document.querySelector('.message-timestamp')).toBeNull();
  });
});

describe('ChatMessage — sources', () => {
  const sources = [
    { document_id: 'doc-1', filename: 'report.pdf', score: 0.9, text: 'Some relevant text here.' },
    { document_id: 'doc-2', filename: 'notes.txt', score: 0.6, text: 'Another passage.' },
  ];

  it('shows sources toggle button with count', () => {
    render(<ChatMessage role="assistant" content="Answer" sources={sources} />);
    expect(screen.getByText(/2.*references|references.*2/i)).toBeTruthy();
  });

  it('hides source cards by default', () => {
    const { container } = render(
      <ChatMessage role="assistant" content="Answer" sources={sources} />
    );
    expect(container.querySelector('.sources-grid')).toBeNull();
  });

  it('reveals source cards on toggle click', () => {
    render(<ChatMessage role="assistant" content="Answer" sources={sources} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('report.pdf')).toBeTruthy();
    expect(screen.getByText('notes.txt')).toBeTruthy();
  });

  it('collapses source cards on second click', () => {
    const { container } = render(
      <ChatMessage role="assistant" content="Answer" sources={sources} />
    );
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(container.querySelector('.sources-grid')).toBeNull();
  });

  it('shows high-confidence note for score >= 0.75', () => {
    const highSources = [{ document_id: 'd', score: 0.9, text: '' }];
    render(<ChatMessage role="assistant" content="A" sources={highSources} />);
    expect(screen.getByText('✓ From your documents')).toBeTruthy();
  });

  it('shows medium-confidence badge for score 0.55–0.74', () => {
    const medSources = [{ document_id: 'd', score: 0.6, text: '' }];
    render(<ChatMessage role="assistant" content="A" sources={medSources} />);
    expect(document.querySelector('.confidence-medium')).toBeTruthy();
  });

  it('shows low-confidence badge for score < 0.55', () => {
    const lowSources = [{ document_id: 'd', score: 0.3, text: '' }];
    render(<ChatMessage role="assistant" content="A" sources={lowSources} />);
    expect(document.querySelector('.confidence-low')).toBeTruthy();
  });

  it('falls back to doc:ID when filename is missing', () => {
    render(
      <ChatMessage
        role="assistant"
        content="A"
        sources={[{ document_id: 'abcdef123456', score: 0.8, text: '' }]}
      />
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/doc:abcdef/)).toBeTruthy();
  });

  it('truncates long source preview to 120 chars', () => {
    const longText = 'x'.repeat(200);
    const { container } = render(
      <ChatMessage
        role="assistant"
        content="A"
        sources={[{ document_id: 'd', score: 0.9, text: longText }]}
      />
    );
    fireEvent.click(screen.getByRole('button'));
    const preview = container.querySelector('.source-preview');
    expect(preview.textContent.length).toBeLessThanOrEqual(122); // 120 + '…'
  });
});
