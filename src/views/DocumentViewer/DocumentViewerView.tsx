import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Send, 
  ArrowLeft, 
  Download, 
  Share2, 
  Copy,
  ExternalLink,
  Mail,
  X
} from 'lucide-react';
import type { KnowledgeItem } from '../../data/mockData';
import { api } from '../../services/api';
import { Markdown } from '../../components/Markdown';
import './DocumentViewerView.css';

interface DocumentViewerViewProps {
  document: KnowledgeItem;
  onBack: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const DocumentViewerView: React.FC<DocumentViewerViewProps> = ({
  document,
  onBack,
  showToast,
}) => {
  const [mobileAISheetOpen, setMobileAISheetOpen] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);

  // Close share menu on outside click or ESC
  useEffect(() => {
    if (!shareMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) {
        setShareMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShareMenuOpen(false);
    };
    const globalDoc = window.document;
    globalDoc.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      globalDoc.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shareMenuOpen]);
  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'assistant'; text: string; time: string }>>([
    {
      sender: 'assistant',
      text: `I've indexed **${document?.title || 'this document'}** (${document?.pageCount || 18} pages). You can ask me to summarize key findings, extract SLAs, or generate architectural trade-offs.`,
      time: 'Just now',
    },
  ]);

  if (!document) {
    return (
      <div className="doc-viewer-wrapper" style={{ padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <h3 style={{ marginBottom: '8px', color: 'var(--text-primary)' }}>Document Not Found</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>This document is no longer available or was removed.</p>
        <button className="btn btn-primary" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back to Knowledge</span>
        </button>
      </div>
    );
  }

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim()) return;

    const userMsg = { sender: 'user' as const, text, time: 'Just now' };
    const assistantMsg = { sender: 'assistant' as const, text: '', time: 'Just now' };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    if (!textToSend) setInputMessage('');

    try {
      await api.streamAIChat(
        `Regarding document "${document.title}": ${text}`,
        undefined,
        undefined,
        {
          onToken: (token: string) => {
            setMessages(prev => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx >= 0 && updated[lastIdx].sender === 'assistant') {
                updated[lastIdx] = {
                  ...updated[lastIdx],
                  text: updated[lastIdx].text + token,
                };
              }
              return updated;
            });
          },
          onDone: (result: { content: string; sources: any[]; actions: any[]; messageId?: string }) => {
            setMessages(prev => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx >= 0 && updated[lastIdx].sender === 'assistant') {
                updated[lastIdx] = {
                  ...updated[lastIdx],
                  text: result.content,
                };
              }
              return updated;
            });
          },
          onError: (err: string) => {
            showToast(err || 'AI response failed', 'error');
          },
        }
      );
    } catch (err: any) {
      showToast(err.message || 'AI generation failed', 'error');
    }
  };

  const samplePrompts = [
    'Summarize key takeaways',
    'What are the latency SLAs?',
    'Extract security requirements',
  ];

  return (
    <div className="doc-viewer-wrapper">
      {/* Top Header */}
      <div className="doc-viewer-topbar">
        <div className="doc-top-left">
          <button className="btn-icon" onClick={onBack} title="Back">
            <ArrowLeft size={18} />
          </button>
          <div className="doc-top-info">
            <h2 className="doc-top-title">{document.title}</h2>
            <div className="doc-top-sub">
              <span>{document.fileSize || '2.4 MB'}</span>
              <span className="meta-sep">•</span>
              <span>{document.pageCount || 18} Pages</span>
              <span className="meta-sep">•</span>
              <span>Updated {document.updatedAt}</span>
            </div>
          </div>
        </div>

        <div className="doc-top-actions">
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => showToast('Downloading document...')}
          >
            <Download size={14} />
            <span className="hide-mobile">Export</span>
          </button>
          <div className="share-menu-container" ref={shareMenuRef} style={{ position: 'relative' }}>
            <button 
              className={`btn-icon ${shareMenuOpen ? 'active' : ''}`}
              onClick={() => setShareMenuOpen(prev => !prev)}
              title="Share Document"
              aria-label="Share Document"
              aria-expanded={shareMenuOpen}
            >
              <Share2 size={16} />
            </button>

            {shareMenuOpen && (
              <div className="share-dropdown-menu" role="menu">
                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <button 
                    className="share-dropdown-item"
                    role="menuitem"
                    onClick={async () => {
                      setShareMenuOpen(false);
                      try {
                        await navigator.share({
                          title: document.title || 'Workspace Document',
                          text: document.excerpt || document.title,
                          url: window.location.href,
                        });
                        showToast('Shared successfully', 'success');
                      } catch (err: any) {
                        if (err.name !== 'AbortError') {
                          showToast('Failed to open system share', 'error');
                        }
                      }
                    }}
                  >
                    <ExternalLink size={14} />
                    <span>Share via Device Apps…</span>
                  </button>
                )}

                <button 
                  className="share-dropdown-item"
                  role="menuitem"
                  onClick={async () => {
                    setShareMenuOpen(false);
                    await navigator.clipboard?.writeText(window.location.href);
                    showToast('Document link copied to clipboard', 'success');
                  }}
                >
                  <Copy size={14} />
                  <span>Copy Document Link</span>
                </button>

                <button 
                  className="share-dropdown-item"
                  role="menuitem"
                  onClick={() => {
                    setShareMenuOpen(false);
                    const subject = encodeURIComponent(`Document: ${document.title}`);
                    const body = encodeURIComponent(`Document: ${document.title}\n\nLink: ${window.location.href}`);
                    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
                  }}
                >
                  <Mail size={14} />
                  <span>Share via Email</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area: Split on desktop, single-pane on mobile */}
      <div className="doc-viewer-split-layout">
        {/* Left Pane: Document Preview Container */}
        <div className="doc-preview-pane">
          <div className="doc-page-canvas">
            <div className="doc-page-header">
              <span className="doc-page-badge">PAGE 1 OF {document.pageCount || 18}</span>
              <span className="doc-page-status">Confidential • Internal Working Spec</span>
            </div>

            <article className="doc-page-body">
              <h1 className="doc-spec-heading">{document.title.replace('.pdf', '')}</h1>
              <p className="doc-spec-meta">Author: Nabin Thapa • Systems Architecture Group</p>

              <div className="doc-spec-section">
                <h3>1. Executive Architecture Scope</h3>
                <p>
                  This specification governs the message propagation protocol for distributed tenant operations.
                  Client mutations generate signed idempotency envelopes routed to distributed partition queues.
                </p>
                <div className="doc-callout-box">
                  <strong>Critical Invariant:</strong> Events must guarantee exactly-once delivery semantics at the application layer through deduplication caches.
                </div>
              </div>

              <div className="doc-spec-section">
                <h3>2. Performance SLAs & Ingestion</h3>
                <ul>
                  <li><strong>p95 Message Delivery Latency:</strong> &lt; 45ms under 5,000 req/sec</li>
                  <li><strong>Dead Letter Quarantine:</strong> 5 max retries before operator alert</li>
                  <li><strong>Partition Key Isolation:</strong> Tenant UUID hash mod partition count</li>
                </ul>
              </div>

              <div className="doc-spec-section">
                <h3>3. Security Isolation Protocol</h3>
                <p>
                  Zero tenant mutation payloads may bypass cryptographic signature verification.
                  Tokens expired over 3600 seconds are rejected at the edge gateway.
                </p>
              </div>
            </article>
          </div>
        </div>

        {/* Right Pane: Desktop AI Assistant (Split View) */}
        <aside className="doc-ai-pane desktop-only-pane" aria-label="Document AI Assistant">
          <div className="doc-ai-header">
            <div className="ai-title-wrap">
              <Bot size={16} className="accent-glyph" />
              <span className="doc-ai-title">Ask AI about this document</span>
            </div>
            <span className="badge badge-accent">Indexed</span>
          </div>

          <div className="doc-ai-prompts-row">
            {samplePrompts.map((p, idx) => (
              <button 
                key={idx} 
                className="doc-prompt-chip"
                onClick={() => handleSendMessage(p)}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Messages list */}
          <div className="doc-ai-messages-list">
            {messages.map((m, idx) => (
              <div key={idx} className={`doc-msg-bubble msg-${m.sender}`}>
                <div className="msg-content">
                  <Markdown content={m.text} />
                </div>
                <span className="msg-timestamp">{m.time}</span>
              </div>
            ))}
          </div>

          {/* AI Composer */}
          <form 
            className="doc-ai-composer"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
          >
            <input 
              type="text"
              className="doc-ai-input"
              placeholder="Ask a question about this spec..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
            />
            <button type="submit" className="btn-icon doc-ai-send-btn" disabled={!inputMessage.trim()}>
              <Send size={15} />
            </button>
          </form>
        </aside>
      </div>

      {/* =========================================================================
          MOBILE-ONLY FLOATING "ASK AI" BUTTON & FULL-SCREEN BOTTOM SHEET
          ========================================================================= */}
      <div className="mobile-floating-ai-trigger">
        <button 
          className="mobile-ai-fab-btn"
          onClick={() => setMobileAISheetOpen(true)}
          aria-label="Ask AI about this document"
        >
          <Bot size={16} />
          <span>Ask AI about file</span>
        </button>
      </div>

      {mobileAISheetOpen && (
        <div className="mobile-ai-sheet-overlay" onClick={() => setMobileAISheetOpen(false)}>
          <div className="mobile-ai-sheet-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle-bar">
              <div className="sheet-handle" />
            </div>

            <div className="mobile-sheet-ai-header">
              <div className="ai-title-wrap">
                <Bot size={16} className="accent-glyph" />
                <span className="sheet-heading">Ask AI: {document.title}</span>
              </div>
              <button className="btn-icon" onClick={() => setMobileAISheetOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="doc-ai-prompts-row mobile-prompts">
              {samplePrompts.map((p, idx) => (
                <button 
                  key={idx} 
                  className="doc-prompt-chip"
                  onClick={() => handleSendMessage(p)}
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="mobile-ai-messages-scroll">
              {messages.map((m, idx) => (
                <div key={idx} className={`doc-msg-bubble msg-${m.sender}`}>
                  <div className="msg-content">
                    <Markdown content={m.text} />
                  </div>
                  <span className="msg-timestamp">{m.time}</span>
                </div>
              ))}
            </div>

            <form 
              className="mobile-ai-sticky-composer"
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
            >
              <input 
                type="text"
                className="mobile-composer-input"
                placeholder="Ask about this file..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
              />
              <button type="submit" className="btn-icon mobile-composer-send" disabled={!inputMessage.trim()}>
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
