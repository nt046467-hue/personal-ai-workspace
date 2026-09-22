import React, { useState, useEffect, useRef } from 'react';
import { 
  Bold, 
  Italic, 
  Heading2, 
  List, 
  ListOrdered, 
  CheckSquare,
  Code, 
  Quote, 
  Bot, 
  Check, 
  Clock, 
  ArrowLeft,
  Share2,
  Copy,
  FileText,
  Mail,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import type { KnowledgeItem } from '../../data/mockData';
import './NoteEditorView.css';

interface NoteEditorViewProps {
  note: KnowledgeItem;
  onBack: () => void;
  onAskAIAboutNote: (noteTitle: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onSaveNote?: (id: string, updates: { title?: string; content?: string }) => void;
}

export const NoteEditorView: React.FC<NoteEditorViewProps> = ({
  note,
  onBack,
  onAskAIAboutNote,
  showToast,
  onSaveNote,
}) => {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content || '');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const debounceRef = useRef<any>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shareMenuOpen]);

  // Sync state if active note changes
  useEffect(() => {
    setTitle(note.title);
    setContent(note.content || '');
  }, [note.id]);

  const triggerSave = (newTitle: string, newContent: string) => {
    setSaveStatus('saving');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        if (onSaveNote) {
          await onSaveNote(note.id, { title: newTitle, content: newContent });
        }
        setSaveStatus('saved');
      } catch {
        setSaveStatus('saved');
      }
    }, 600);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    triggerSave(title, val);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    triggerSave(val, content);
  };

  // Smart Selection-Aware Inline Formatting (e.g. **bold**, *italic*, `code`)
  const applyFormatting = (prefix: string, suffix: string = '', defaultPlaceholder: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) {
      const addition = `\n${prefix}${defaultPlaceholder}${suffix}`;
      setContent(prev => {
        const next = prev + addition;
        triggerSave(title, next);
        return next;
      });
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;
    const selectedText = currentText.slice(start, end);

    let newText = '';
    let newCursorPos = start + prefix.length;

    if (selectedText.length > 0) {
      newText = currentText.slice(0, start) + prefix + selectedText + suffix + currentText.slice(end);
      newCursorPos = start + prefix.length + selectedText.length + suffix.length;
    } else {
      const insertion = defaultPlaceholder || '';
      newText = currentText.slice(0, start) + prefix + insertion + suffix + currentText.slice(end);
      newCursorPos = start + prefix.length + insertion.length;
    }

    setContent(newText);
    triggerSave(title, newText);

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    });
  };

  // Smart Selection-Aware Line-Start Formatting (e.g. ## heading, - bullet, - [ ] check)
  const applyLinePrefix = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      const addition = `\n${prefix}`;
      setContent(prev => {
        const next = prev + addition;
        triggerSave(title, next);
        return next;
      });
      return;
    }

    const start = textarea.selectionStart;
    const currentText = textarea.value;
    const lineStart = currentText.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = currentText.indexOf('\n', start);
    const end = lineEnd === -1 ? currentText.length : lineEnd;
    const currentLine = currentText.slice(lineStart, end);

    let newLine = '';
    if (currentLine.startsWith(prefix)) {
      newLine = currentLine.slice(prefix.length);
    } else {
      newLine = prefix + currentLine;
    }

    const newText = currentText.slice(0, lineStart) + newLine + currentText.slice(end);
    const diff = newLine.length - currentLine.length;
    const newCursor = Math.max(lineStart, start + diff);

    setContent(newText);
    triggerSave(title, newText);

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursor, newCursor);
      }
    });
  };

  const wordCount = React.useMemo(() => {
    const trimmed = content.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }, [content]);

  const readTimeEst = React.useMemo(() => {
    const minutes = Math.max(1, Math.ceil(wordCount / 200));
    return `${minutes} min read`;
  }, [wordCount]);

  return (
    <div className="note-editor-wrapper">
      {/* Top Meta Bar */}
      <div className="note-editor-topbar">
        <div className="editor-top-left">
          <button className="btn-icon" onClick={onBack} title="Back to knowledge">
            <ArrowLeft size={18} />
          </button>
          <div className="save-status-indicator">
            {saveStatus === 'saved' ? (
              <>
                <Check size={13} className="saved-check" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Clock size={13} className="saving-spinner" />
                <span>Saving...</span>
              </>
            )}
          </div>
        </div>

        {/* Desktop Formatting Toolbar */}
        <div className="editor-desktop-toolbar">
          <button 
            type="button"
            className="toolbar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyFormatting('**', '**', 'bold text'); }} 
            title="Bold"
          >
            <Bold size={15} />
          </button>
          <button 
            type="button"
            className="toolbar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyFormatting('*', '*', 'italic text'); }} 
            title="Italic"
          >
            <Italic size={15} />
          </button>
          <span className="toolbar-divider" />
          <button 
            type="button"
            className="toolbar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyLinePrefix('## '); }} 
            title="Heading 2"
          >
            <Heading2 size={15} />
          </button>
          <button 
            type="button"
            className="toolbar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyLinePrefix('- '); }} 
            title="Bullet list"
          >
            <List size={15} />
          </button>
          <button 
            type="button"
            className="toolbar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyLinePrefix('- [ ] '); }} 
            title="Checklist item"
          >
            <CheckSquare size={15} />
          </button>
          <button 
            type="button"
            className="toolbar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyLinePrefix('1. '); }} 
            title="Numbered list"
          >
            <ListOrdered size={15} />
          </button>
          <button 
            type="button"
            className="toolbar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyFormatting('```\n', '\n```', 'code'); }} 
            title="Code block"
          >
            <Code size={15} />
          </button>
          <button 
            type="button"
            className="toolbar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyLinePrefix('> '); }} 
            title="Quote"
          >
            <Quote size={15} />
          </button>
        </div>

        <div className="editor-top-right">
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => onAskAIAboutNote(title)}
            title="Ask AI to analyze or summarize this note"
          >
            <Bot size={14} className="accent-glyph" />
            <span className="btn-label-desktop">Ask AI</span>
          </button>
          <div className="share-menu-container" ref={shareMenuRef} style={{ position: 'relative' }}>
            <button 
              className={`btn-icon ${shareMenuOpen ? 'active' : ''}`}
              onClick={() => setShareMenuOpen(prev => !prev)}
              title="Share Note"
              aria-label="Share Note"
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
                          title: title || 'Workspace Note',
                          text: content.slice(0, 160),
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
                    showToast('Note link copied to clipboard', 'success');
                  }}
                >
                  <Copy size={14} />
                  <span>Copy Note Link</span>
                </button>

                <button 
                  className="share-dropdown-item"
                  role="menuitem"
                  onClick={async () => {
                    setShareMenuOpen(false);
                    const fullText = `# ${title}\n\n${content}`;
                    await navigator.clipboard?.writeText(fullText);
                    showToast('Full note markdown copied to clipboard', 'success');
                  }}
                >
                  <FileText size={14} />
                  <span>Copy Note Content</span>
                </button>

                <button 
                  className="share-dropdown-item"
                  role="menuitem"
                  onClick={() => {
                    setShareMenuOpen(false);
                    const subject = encodeURIComponent(title || 'Workspace Note');
                    const body = encodeURIComponent(`${title}\n\n${content}\n\nLink: ${window.location.href}`);
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

      {/* Writing Canvas (Restrained max-width column: 720px) */}
      <div className="note-canvas-scroll">
        <main className="note-canvas-column">
          {/* Note Title Input */}
          <input 
            type="text"
            className="note-canvas-title"
            value={title}
            onChange={handleTitleChange}
            placeholder="Untitled Note"
          />

          {/* Note Metadata Strip */}
          <div className="note-canvas-metadata">
            <span>{wordCount} words</span>
            <span className="meta-sep">•</span>
            <span>{readTimeEst}</span>
            {note.tags && note.tags.length > 0 && (
              <>
                <span className="meta-sep">•</span>
                <span>{note.tags.join(', ')}</span>
              </>
            )}
          </div>

          {/* Note Content Textarea with Selection Ref */}
          <textarea
            ref={textareaRef}
            className="note-canvas-content"
            value={content}
            onChange={handleContentChange}
            placeholder="Write your note in markdown... Select text and tap the formatting toolbar below."
            rows={22}
          />
        </main>
      </div>

      {/* Mobile Bottom Formatting Bar (Horizontally scrollable, touch-friendly, safe keyboard behavior) */}
      <div className="note-mobile-bottom-bar">
        <div className="mobile-bar-scroll">
          <button 
            type="button"
            className="mobile-bar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyLinePrefix('## '); }}
            title="Heading 2"
          >
            <Heading2 size={16} />
          </button>
          <button 
            type="button"
            className="mobile-bar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyFormatting('**', '**', 'bold'); }}
            title="Bold"
          >
            <Bold size={16} />
          </button>
          <button 
            type="button"
            className="mobile-bar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyFormatting('*', '*', 'italic'); }}
            title="Italic"
          >
            <Italic size={16} />
          </button>
          <button 
            type="button"
            className="mobile-bar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyLinePrefix('- '); }}
            title="Bullet list"
          >
            <List size={16} />
          </button>
          <button 
            type="button"
            className="mobile-bar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyLinePrefix('- [ ] '); }}
            title="Checklist"
          >
            <CheckSquare size={16} />
          </button>
          <button 
            type="button"
            className="mobile-bar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyLinePrefix('1. '); }}
            title="Numbered list"
          >
            <ListOrdered size={16} />
          </button>
          <button 
            type="button"
            className="mobile-bar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyFormatting('`', '`', 'code'); }}
            title="Code"
          >
            <Code size={16} />
          </button>
          <button 
            type="button"
            className="mobile-bar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyLinePrefix('> '); }}
            title="Quote"
          >
            <Quote size={16} />
          </button>
          <button 
            type="button"
            className="mobile-bar-btn mobile-ai-pill" 
            onClick={() => onAskAIAboutNote(title)}
            title="Ask AI about this note"
          >
            <Bot size={13} />
            <span>AI</span>
          </button>
          <button 
            type="button"
            className="mobile-bar-btn mobile-dismiss-btn" 
            onClick={() => textareaRef.current?.blur()}
            title="Hide keyboard"
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
