import React, { useState, useRef, useEffect } from 'react';
import { Markdown } from '../../components/Markdown';
import { 
  Send, 
  Paperclip, 
  ArrowRight, 
  ArrowDown,
  Square,
  FileText, 
  ExternalLink,
  Bot,
  MessageSquare,
  Plus
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
  isStreaming?: boolean;
  onStopStreaming?: () => void;
  onComposerFocusChange?: (focused: boolean) => void;
  onNewChat?: () => void;
}

export const AIAssistantView: React.FC<AIAssistantViewProps> = ({
  messages,
  onSendMessage,
  onNavigate,
  onOpenNote,
  onOpenDoc,
  onOpenProject,
  onAttachFile,
  isStreaming = false,
  onStopStreaming,
  onComposerFocusChange,
  onNewChat,
}) => {
  const [inputText, setInputText] = useState('');
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track user scroll position: if scrolled up > 200px show "Jump to latest" pill
  const handleScroll = () => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom <= 140;
    setShowJumpToLatest(distanceFromBottom > 200);
  };

  const handleJumpToLatest = () => {
    const el = scrollAreaRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
      isNearBottomRef.current = true;
      setShowJumpToLatest(false);
    }
  };

  // Auto-scroll to bottom on new messages — instant scroll prevents F-02 lag
  useEffect(() => {
    const el = scrollAreaRef.current;
    if (el && isNearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

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

  // Central send: called from both keyboard paths and form submit button
  const sendMessage = () => {
    const text = inputText.trim();
    if (!text || isStreaming) return;
    onSendMessage(text);
    setInputText('');
    isNearBottomRef.current = true;
    setShowJumpToLatest(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = '';
      textareaRef.current.style.overflowY = 'hidden';
    }
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  // Desktop: intercept Enter on keydown before character is inserted
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !(e.nativeEvent as any).isComposing) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Mobile: virtual keyboards insert '\n' into the textarea value BEFORE
  // keydown fires (or instead of it). Catch the trailing newline in onChange.
  // NOTE: do NOT check isComposing here — iOS marks autocorrect text as
  // "composing" even for plain ASCII, which would silently block the send.
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.endsWith('\n')) {
      const stripped = value.slice(0, -1);
      const text = stripped.trim();
      if (text && !isStreaming) {
        onSendMessage(text);
        setInputText('');
        isNearBottomRef.current = true;
        setShowJumpToLatest(false);
        if (textareaRef.current) {
          textareaRef.current.style.height = '';
          textareaRef.current.style.overflowY = 'hidden';
        }
        if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
      } else {
        // Enter on empty box — just strip the \n, don't submit
        setInputText(stripped);
      }
      return;
    }
    setInputText(value);
  };

  const handleFocus = () => {
    // Cancel any pending blur — user is still in the composer
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    isNearBottomRef.current = true;
    onComposerFocusChange?.(true);
    setTimeout(() => {
      const el = scrollAreaRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }, 200);
  };

  // Debounced blur: wait 300ms before telling the parent the composer lost focus.
  // On iOS, tapping the virtual keyboard's Send/Enter fires blur BEFORE the
  // keydown/onChange that sends the message — without the debounce, the bottom
  // nav collapses first and the second tap is needed to re-focus and send.
  const handleBlur = () => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    blurTimerRef.current = setTimeout(() => {
      onComposerFocusChange?.(false);
    }, 300);
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
        {onNewChat && (
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={onNewChat}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '6px 12px', borderRadius: 'var(--radius-full)' }}
            title="Start new conversation"
          >
            <Plus size={14} />
            <span>New Chat</span>
          </button>
        )}
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
                  {msg.timestamp === 'Thinking...' && !msg.content ? (
                    <div className="ai-thinking-indicator">
                      <div className="thinking-dots">
                        <span className="thinking-pulse-dot" />
                        <span className="thinking-pulse-dot" />
                        <span className="thinking-pulse-dot" />
                      </div>
                      <span className="thinking-text">Thinking & searching workspace...</span>
                    </div>
                  ) : (
                    <div className="ai-bubble-markdown">
                      <Markdown content={msg.content || ''} />
                    </div>
                  )}

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

      {/* Floating Jump to Latest Pill */}
      {showJumpToLatest && (
        <button
          type="button"
          className="ai-jump-latest-btn"
          onClick={handleJumpToLatest}
          aria-label="Jump to latest messages"
        >
          <ArrowDown size={14} />
          <span>Jump to latest</span>
        </button>
      )}

      {/* Normal flow bottom composer */}
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
            disabled={!onAttachFile || isStreaming}
            style={{ opacity: onAttachFile && !isStreaming ? 1 : 0.4, cursor: onAttachFile && !isStreaming ? 'pointer' : 'not-allowed' }}
          >
            <Paperclip size={18} />
          </button>
          
          <textarea 
            ref={textareaRef}
            rows={1}
            className="ai-composer-input"
            placeholder="Ask your workspace…"
            value={inputText}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            aria-label="Ask your workspace"
            disabled={isStreaming}
            enterKeyHint="send"
            inputMode="text"
          />

          {isStreaming ? (
            <button 
              type="button" 
              className="ai-stop-btn"
              onClick={onStopStreaming}
              aria-label="Stop generating"
              title="Stop generating"
            >
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button 
              type="submit" 
              className="ai-send-btn btn-primary"
              disabled={!inputText.trim()}
              aria-label="Send message"
              onPointerDown={(e) => {
                // Prevent textarea from losing focus on mobile tap.
                // Without this, the soft keyboard dismisses, the bottom nav pops up,
                // and the resulting layout shift drops the tap event before submit fires.
                e.preventDefault();
              }}
            >
              <Send size={15} />
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
