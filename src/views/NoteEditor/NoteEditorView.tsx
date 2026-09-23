import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
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
  ChevronDown,
  AlertCircle,
  Eye,
  Edit3,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import type { KnowledgeItem } from '../../data/mockData';
import { Markdown } from '../../components/Markdown';
import { useKeyboardAwareBottom } from '../../hooks/useKeyboardAwareBottom';
import './NoteEditorView.css';

interface NoteEditorViewProps {
  note: KnowledgeItem;
  onBack: () => void;
  onAskAIAboutNote: (noteTitle: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onSaveNote?: (id: string, updates: { title?: string; content?: string }) => void;
}

interface DraftData {
  title: string;
  content: string;
  ts: number;
}

function getDraftKey(noteId: string) {
  return `note-draft:${noteId}`;
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
  // N-6: Three-state save status — 'saved' | 'saving' | 'error'
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  // N-1: View mode toggle — 'edit' | 'preview'
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  // N-10: Restore-draft banner
  const [draftBanner, setDraftBanner] = useState<DraftData | null>(null);

  // Keyboard-aware bottom offset: pins the mobile toolbar above the on-screen keyboard
  const keyboardBottom = useKeyboardAwareBottom();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Refs to always hold the latest title/content/saveStatus — needed for
  // closures in beforeunload listener and retry handler to avoid stale values.
  // Updated in useLayoutEffect (not during render) to satisfy react(refs) rule.
  const latestTitle = useRef(title);
  const latestContent = useRef(content);
  const latestSaveStatus = useRef(saveStatus);

  useLayoutEffect(() => {
    latestTitle.current = title;
    latestContent.current = content;
    latestSaveStatus.current = saveStatus;
  });

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

  // N-10 (mount): Check for a stored draft for this note.
  // N-11: Also clears debounce and retry timers when note.id changes.
  useEffect(() => {
    setTitle(note.title);
    setContent(note.content || '');
    setSaveStatus('saved');
    setViewMode('edit');

    // N-11: Clear any pending debounce/retry from the previous note
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (retryRef.current) clearTimeout(retryRef.current);

    // N-10: Check localStorage for an unsaved draft for this note
    try {
      const raw = localStorage.getItem(getDraftKey(note.id));
      if (raw) {
        const draft: DraftData = JSON.parse(raw);
        // Only prompt if the draft is newer than the note's last saved state.
        // KnowledgeItem may carry an `updatedAt` string; use it if available.
        const noteTs = (note as any).updatedAt ? new Date((note as any).updatedAt).getTime() : 0;
        if (draft.ts > noteTs) {
          setDraftBanner(draft);
        } else {
          // Draft is stale — quietly discard it
          localStorage.removeItem(getDraftKey(note.id));
        }
      }
    } catch {
      // Corrupt localStorage entry — ignore
      localStorage.removeItem(getDraftKey(note.id));
    }

    return () => {
      // N-11: Cleanup on unmount or note change
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // N-9: beforeunload — persist draft if there's a pending or failed save
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (latestSaveStatus.current !== 'saved') {
        try {
          localStorage.setItem(
            getDraftKey(note.id),
            JSON.stringify({
              title: latestTitle.current,
              content: latestContent.current,
              ts: Date.now(),
            } satisfies DraftData),
          );
        } catch {
          // localStorage quota exceeded or private mode — silently skip
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [note.id]); // note.id in deps so the key is always correct

  // Core save function — fires after debounce or retry
  const performSave = useCallback(
    async (savedTitle: string, savedContent: string) => {
      try {
        if (onSaveNote) {
          await onSaveNote(note.id, { title: savedTitle, content: savedContent });
        }
        setSaveStatus('saved');
        // N-10: Remove any persisted draft once a save succeeds
        localStorage.removeItem(getDraftKey(note.id));
      } catch {
        // N-6: On failure, set error — never report success
        setSaveStatus('error');
        // N-7: Schedule one automatic retry after 2 s
        if (retryRef.current) clearTimeout(retryRef.current);
        retryRef.current = setTimeout(async () => {
          try {
            if (onSaveNote) {
              await onSaveNote(note.id, {
                title: latestTitle.current,
                content: latestContent.current,
              });
            }
            setSaveStatus('saved');
            localStorage.removeItem(getDraftKey(note.id));
          } catch {
            // Retry also failed — stay in 'error' until the next successful save
          }
        }, 2000);
      }
    },
    [note.id, onSaveNote],
  );

  const triggerSave = useCallback(
    (newTitle: string, newContent: string) => {
      setSaveStatus('saving');
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        performSave(newTitle, newContent);
      }, 600);
    },
    [performSave],
  );

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

  // N-4: Interactive checkbox toggle in preview mode.
  // Matches by ordinal position among task-list lines (not text content).
  const handleTaskToggle = useCallback(
    (taskIndex: number, checked: boolean) => {
      const lines = latestContent.current.split('\n');
      const taskLineRegex = /^(\s*[-*+]\s+)\[([ x])\]/i;
      let foundCount = 0;
      const newLines = lines.map((line) => {
        if (taskLineRegex.test(line)) {
          if (foundCount === taskIndex) {
            foundCount++;
            // Flip the checkbox state
            return checked
              ? line.replace(/\[ \]/i, '[x]')
              : line.replace(/\[x\]/i, '[ ]');
          }
          foundCount++;
        }
        return line;
      });
      const newContent = newLines.join('\n');
      setContent(newContent);
      triggerSave(latestTitle.current, newContent);
    },
    [triggerSave],
  );

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

  const isEditMode = viewMode === 'edit';

  return (
    <div className="note-editor-wrapper">
      {/* Top Meta Bar */}
      <div className="note-editor-topbar">
        <div className="editor-top-left">
          <button className="btn-icon" onClick={onBack} title="Back to knowledge">
            <ArrowLeft size={18} />
          </button>
          {/* N-6/N-7: Save status indicator — three states */}
          <div className={`save-status-indicator${saveStatus === 'error' ? ' save-status-error' : ''}`}>
            {saveStatus === 'saved' && (
              <>
                <Check size={13} className="saved-check" />
                <span>Saved</span>
              </>
            )}
            {saveStatus === 'saving' && (
              <>
                <Clock size={13} className="saving-spinner" />
                <span>Saving...</span>
              </>
            )}
            {saveStatus === 'error' && (
              <>
                <AlertCircle size={13} className="save-error-icon" />
                <span>Couldn't save — retrying…</span>
                <button
                  type="button"
                  className="save-retry-btn"
                  title="Retry now"
                  onClick={() => performSave(latestTitle.current, latestContent.current)}
                >
                  <RefreshCw size={11} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Desktop Formatting Toolbar — hidden in preview mode */}
        <div className="editor-desktop-toolbar">
          {/* N-1: Edit / Preview mode toggle */}
          <div className="view-mode-toggle" role="group" aria-label="Editor view mode">
            <button
              type="button"
              id="note-view-toggle-edit"
              className={`view-mode-btn${isEditMode ? ' active' : ''}`}
              onClick={() => setViewMode('edit')}
              title="Edit mode"
              aria-pressed={isEditMode}
            >
              <Edit3 size={13} />
              <span>Edit</span>
            </button>
            <button
              type="button"
              id="note-view-toggle-preview"
              className={`view-mode-btn${!isEditMode ? ' active' : ''}`}
              onClick={() => setViewMode('preview')}
              title="Preview mode"
              aria-pressed={!isEditMode}
            >
              <Eye size={13} />
              <span>Preview</span>
            </button>
          </div>

          <span className="toolbar-divider" />

          {/* N-5: Formatting buttons — disabled in preview mode */}
          <button 
            type="button"
            className="toolbar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyFormatting('**', '**', 'bold text'); }} 
            title="Bold"
            disabled={!isEditMode}
            aria-disabled={!isEditMode}
          >
            <Bold size={15} />
          </button>
          <button 
            type="button"
            className="toolbar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyFormatting('*', '*', 'italic text'); }} 
            title="Italic"
            disabled={!isEditMode}
            aria-disabled={!isEditMode}
          >
            <Italic size={15} />
          </button>
          <span className="toolbar-divider" />
          <button 
            type="button"
            className="toolbar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyLinePrefix('## '); }} 
            title="Heading 2"
            disabled={!isEditMode}
            aria-disabled={!isEditMode}
          >
            <Heading2 size={15} />
          </button>
          <button 
            type="button"
            className="toolbar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyLinePrefix('- '); }} 
            title="Bullet list"
            disabled={!isEditMode}
            aria-disabled={!isEditMode}
          >
            <List size={15} />
          </button>
          <button 
            type="button"
            className="toolbar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyLinePrefix('- [ ] '); }} 
            title="Checklist item"
            disabled={!isEditMode}
            aria-disabled={!isEditMode}
          >
            <CheckSquare size={15} />
          </button>
          <button 
            type="button"
            className="toolbar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyLinePrefix('1. '); }} 
            title="Numbered list"
            disabled={!isEditMode}
            aria-disabled={!isEditMode}
          >
            <ListOrdered size={15} />
          </button>
          <button 
            type="button"
            className="toolbar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyFormatting('```\n', '\n```', 'code'); }} 
            title="Code block"
            disabled={!isEditMode}
            aria-disabled={!isEditMode}
          >
            <Code size={15} />
          </button>
          <button 
            type="button"
            className="toolbar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyLinePrefix('> '); }} 
            title="Quote"
            disabled={!isEditMode}
            aria-disabled={!isEditMode}
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

                {/* N-12: Copies raw markdown — correct portable format */}
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
          {/* N-10: Restore-draft banner */}
          {draftBanner && (
            <div className="draft-restore-banner" role="alert">
              <AlertTriangle size={15} className="draft-banner-icon" />
              <span className="draft-banner-msg">
                You have unsaved changes from a previous session.
              </span>
              <div className="draft-banner-actions">
                <button
                  type="button"
                  className="draft-btn draft-btn-restore"
                  onClick={() => {
                    setTitle(draftBanner.title);
                    setContent(draftBanner.content);
                    triggerSave(draftBanner.title, draftBanner.content);
                    localStorage.removeItem(getDraftKey(note.id));
                    setDraftBanner(null);
                  }}
                >
                  Restore
                </button>
                <button
                  type="button"
                  className="draft-btn draft-btn-discard"
                  onClick={() => {
                    localStorage.removeItem(getDraftKey(note.id));
                    setDraftBanner(null);
                  }}
                >
                  Discard
                </button>
              </div>
            </div>
          )}

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
            <span className="meta-sep">•</span>
            <span className="meta-mode-badge">{isEditMode ? 'Editing' : 'Preview'}</span>
          </div>

          {/* N-2: Edit pane (textarea) or Preview pane (Markdown renderer) */}
          {isEditMode ? (
            <textarea
              ref={textareaRef}
              className="note-canvas-content"
              value={content}
              onChange={handleContentChange}
              placeholder="Write your note in markdown... Select text and tap the formatting toolbar below."
              rows={22}
            />
          ) : (
            <div className="note-preview-area">
              {content.trim() ? (
                /* N-2: Reuse the existing Markdown component */
                /* N-4: Pass handleTaskToggle for interactive checkboxes */
                <Markdown content={content} onTaskToggle={handleTaskToggle} />
              ) : (
                <p className="note-preview-empty">Nothing to preview yet. Switch to Edit and start writing.</p>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Mobile Bottom Formatting Bar — pinned above the on-screen keyboard via
          visualViewport-derived keyboardBottom offset (0 when keyboard is closed). */}
      <div
        className="note-mobile-bottom-bar"
        style={{ bottom: keyboardBottom }}
      >
        <div className="mobile-bar-scroll">
          {/* Mobile view mode toggle */}
          <button
            type="button"
            id="note-mobile-toggle-edit"
            className={`mobile-bar-btn mobile-toggle-btn${isEditMode ? ' active' : ''}`}
            onClick={() => setViewMode('edit')}
            title="Edit"
            aria-pressed={isEditMode}
          >
            <Edit3 size={15} />
          </button>
          <button
            type="button"
            id="note-mobile-toggle-preview"
            className={`mobile-bar-btn mobile-toggle-btn${!isEditMode ? ' active' : ''}`}
            onClick={() => setViewMode('preview')}
            title="Preview"
            aria-pressed={!isEditMode}
          >
            <Eye size={15} />
          </button>

          <span className="mobile-bar-divider" />

          <button 
            type="button"
            className="mobile-bar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyLinePrefix('## '); }}
            title="Heading 2"
            disabled={!isEditMode}
          >
            <Heading2 size={16} />
          </button>
          <button 
            type="button"
            className="mobile-bar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyFormatting('**', '**', 'bold'); }}
            title="Bold"
            disabled={!isEditMode}
          >
            <Bold size={16} />
          </button>
          <button 
            type="button"
            className="mobile-bar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyFormatting('*', '*', 'italic'); }}
            title="Italic"
            disabled={!isEditMode}
          >
            <Italic size={16} />
          </button>
          <button 
            type="button"
            className="mobile-bar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyLinePrefix('- '); }}
            title="Bullet list"
            disabled={!isEditMode}
          >
            <List size={16} />
          </button>
          <button 
            type="button"
            className="mobile-bar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyLinePrefix('- [ ] '); }}
            title="Checklist"
            disabled={!isEditMode}
          >
            <CheckSquare size={16} />
          </button>
          <button 
            type="button"
            className="mobile-bar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyLinePrefix('1. '); }}
            title="Numbered list"
            disabled={!isEditMode}
          >
            <ListOrdered size={16} />
          </button>
          <button 
            type="button"
            className="mobile-bar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyFormatting('`', '`', 'code'); }}
            title="Code"
            disabled={!isEditMode}
          >
            <Code size={16} />
          </button>
          <button 
            type="button"
            className="mobile-bar-btn" 
            onMouseDown={(e) => { e.preventDefault(); applyLinePrefix('> '); }}
            title="Quote"
            disabled={!isEditMode}
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
