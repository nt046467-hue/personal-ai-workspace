import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Paperclip, 
  ArrowRight, 
  FileText, 
  ExternalLink,
  Bot,
  MessageSquare
} from 'lucide-react';
import { MySpaceLogo } from '../../components/Brand/MySpaceLogo';
import type { AIMessage } from '../../data/mockData';
import { AI_PROMPTS } from '../../data/mockData';
import type { NavigationTab } from '../../components/AppShell/DesktopSidebar';
import './AIAssistantView.css';

interface AIAssistantViewProps {
  messages: AIMessage[];
  onSendMessage: (text: string) => void;
  onNavigate: (tab: NavigationTab) => void;
  onOpenNote: (id: string) => void;
  onOpenDoc: (id: string) => void;
  onOpenProject: (id: string) => void;
  onAttachFile?: (file: File) => void;
}

export const AIAssistantView: React.FC<AIAssistantViewProps> = ({
  messages,
  onSendMessage,
  onNavigate,
  onOpenNote,
  onOpenDoc,
  onOpenProject,
  onAttachFile,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  // Track user scroll position so manual upward scrolling is preserved
  const handleScroll = () => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const threshold = 140;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
  };

  // Auto-scroll to bottom of conversation on new messages only if user was already near the bottom
  useEffect(() => {
    const el = scrollAreaRef.current;
    if (el && isNearBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  // Dynamically measure composer height so message scroll area always has exact required clearance
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    const updateHeight = () => {
      const h = el.offsetHeight;
      if (h > 0) {
        document.documentElement.style.setProperty('--mobile-composer-height', `${h}px`);
      }
    };
    updateHeight();
    const ro = new ResizeObserver(updateHeight);
    ro.observe(el);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty('--mobile-composer-height');
    };
  }, []);

  // Smooth textarea height: compact single/two-line when empty or short, grows smoothly up to 110px
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    if (!inputText) {
      el.style.height = '';
      el.style.overflowY = 'hidden';
      return;
    }
    el.style.height = 'auto';
    const maxHeight = 110;
    const newHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${newHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [inputText]);

  // Handle on-screen keyboard via visualViewport on mobile
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const updateViewport = () => {
      const keyboardOffset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      if (keyboardOffset > 50) {
        document.documentElement.style.setProperty('--mobile-composer-bottom', `${keyboardOffset + 4}px`);
        document.documentElement.style.setProperty('--mobile-keyboard-open', '1');
        const el = scrollAreaRef.current;
        if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      } else {
        document.documentElement.style.removeProperty('--mobile-composer-bottom');
        document.documentElement.style.removeProperty('--mobile-keyboard-open');
      }
    };
    vv.addEventListener('resize', updateViewport);
    vv.addEventListener('scroll', updateViewport);
    return () => {
      vv.removeEventListener('resize', updateViewport);
      vv.removeEventListener('scroll', updateViewport);
      document.documentElement.style.removeProperty('--mobile-composer-bottom');
      document.documentElement.style.removeProperty('--mobile-keyboard-open');
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
    isNearBottomRef.current = true;
    if (textareaRef.current) {
      textareaRef.current.style.height = '';
      textareaRef.current.style.overflowY = 'hidden';
    }
    setTimeout(() => {
      if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
      }
    }, 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      const isMobile = typeof window !== 'undefined' && 
        (window.innerWidth <= 820 || ('ontouchstart' in window && navigator.maxTouchPoints > 0));
      if (!isMobile) {
        e.preventDefault();
        handleSubmit(e);
      }
    }
  };

  const handleFocus = () => {
    isNearBottomRef.current = true;
    setTimeout(() => {
      const el = scrollAreaRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }, 200);
  };

  const handleActionClick = (action: string, targetId?: string) => {
    if (action === 'navigate_tasks') {
      onNavigate('tasks');
    } else if (action === 'open_note' && targetId) {
      onOpenNote(targetId);
    } else if (action === 'open_doc' && targetId) {
      onOpenDoc(targetId);
    } else if (action === 'open_project' && targetId) {
      onOpenProject(targetId);
    }
  };

  return (
    <div className="ai-workspace-view">
      {/* Workspace AI Title Strip */}
      <div className="ai-view-header">
        <div className="ai-brand-header">
          <div className="ai-glyph-circle" style={{ background: 'transparent', border: 'none' }}>
            <MySpaceLogo size={26} />
          </div>
          <div className="ai-header-text">
            <h2 className="ai-header-title">MySpace Intelligence</h2>
            <span className="ai-header-subtitle">Direct context over your tasks, documents, and code notes</span>
          </div>
        </div>
      </div>

      {/* Main Conversation Container */}
      <div className="ai-messages-scroll-area" ref={scrollAreaRef} onScroll={handleScroll}>
        <div className="ai-content-column">
          {/* Workspace Prompt Suggestions */}
          <div className="ai-suggested-strip">
            <span className="suggested-label">Ask about your workspace:</span>
            <div className="suggested-chips-flow">
              {AI_PROMPTS.map((prompt, idx) => (
                <button 
                  key={idx} 
                  className="suggested-chip"
                  onClick={() => onSendMessage(prompt)}
                >
                  <MessageSquare size={12} className="chip-sparkle" />
                  <span>{prompt}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Conversation History */}
          <div className="ai-dialog-flow">
            {messages.map((msg) => (
              <div key={msg.id} className={`ai-message-row ${msg.sender}`}>
                {msg.sender === 'assistant' && (
                  <div className="ai-avatar-badge">
                    <Bot size={15} />
                  </div>
                )}
                
                <div className="ai-bubble-body">
                  <div 
                    className="ai-bubble-markdown"
                    dangerouslySetInnerHTML={{ 
                      __html: (msg.content || '')
                        .replace(/### (.*?)\n/g, '<h3>$1</h3>')
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\*(.*?)\*/g, '<em>$1</em>')
                        .replace(/`([^`]+)`/g, '<code>$1</code>')
                        .replace(/\n\n/g, '<br/><br/>')
                        .replace(/\n/g, '<br/>')
                    }}
                  />

                  {/* Sources Section */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="ai-sources-card">
                      <span className="sources-header-text">Sources Referenced</span>
                      <div className="sources-pill-row">
                        {msg.sources.map((src) => (
                          <button 
                            key={src.id} 
                            className="source-item-pill"
                            onClick={() => {
                              if (src.type === 'note') onOpenNote(src.id);
                              else if (src.type === 'document') onOpenDoc(src.id);
                              else if (src.type === 'project') onOpenProject(src.id);
                            }}
                          >
                            <FileText size={12} className="source-icon" />
                            <span className="source-name">{src.title}</span>
                            <ExternalLink size={10} className="source-ext" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contextual Action Buttons */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="ai-actions-strip">
                      {msg.actions.map((act, idx) => (
                        <button 
                          key={idx} 
                          className="btn btn-secondary btn-sm ai-action-btn"
                          onClick={() => handleActionClick(act.action, act.targetId)}
                        >
                          <span>{act.label}</span>
                          <ArrowRight size={12} />
                        </button>
                      ))}
                    </div>
                  )}

                  <span className="ai-msg-time">{msg.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
          {/* Scroll anchor */}
          <div ref={messagesEndRef} style={{ height: 1 }} />
        </div>
      </div>

      {/* Sticky Bottom Composer */}
      <div className="ai-composer-dock" ref={composerRef}>
        {/* Hidden file input — triggered by paperclip button */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && onAttachFile) {
              onAttachFile(file);
            }
            // Reset so the same file can be re-selected
            e.target.value = '';
          }}
        />

        <form className="ai-composer-form" onSubmit={handleSubmit}>
          <button 
            type="button" 
            className="btn-icon composer-attach-btn" 
            title="Attach file (PDF, DOCX, TXT, MD…)"
            aria-label="Attach file"
            onClick={() => fileInputRef.current?.click()}
            disabled={!onAttachFile}
            style={{ opacity: onAttachFile ? 1 : 0.4, cursor: onAttachFile ? 'pointer' : 'not-allowed' }}
          >
            <Paperclip size={18} />
          </button>
          
          <textarea 
            ref={textareaRef}
            rows={1}
            className="ai-composer-input"
            placeholder="Ask about your workspace, notes, or tasks..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
          />

          <button 
            type="submit" 
            className="ai-send-btn btn-primary"
            disabled={!inputText.trim()}
            aria-label="Send message"
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );
};
