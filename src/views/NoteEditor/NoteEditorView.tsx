import React, { useState, useEffect } from 'react';
import { 
  Bold, 
  Italic, 
  Heading2, 
  List, 
  ListOrdered, 
  Code, 
  Quote, 
  Bot, 
  Check, 
  Clock, 
  ArrowLeft,
  Share2
} from 'lucide-react';
import type { KnowledgeItem } from '../../data/mockData';
import './NoteEditorView.css';

interface NoteEditorViewProps {
  note: KnowledgeItem;
  onBack: () => void;
  onAskAIAboutNote: (noteTitle: string) => void;
  showToast: (msg: string) => void;
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
  const debounceRef = React.useRef<any>(null);

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

  const insertFormatting = (prefix: string, suffix: string = '') => {
    setContent(prev => prev + `\n${prefix} ` + suffix);
    showToast('Applied formatting');
  };

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
                <span>Saved just now</span>
              </>
            ) : (
              <>
                <Clock size={13} className="saving-spinner" />
                <span>Saving changes...</span>
              </>
            )}
          </div>
        </div>

        {/* Desktop Formatting Toolbar */}
        <div className="editor-desktop-toolbar">
          <button className="toolbar-btn" onClick={() => insertFormatting('**', '**')} title="Bold">
            <Bold size={15} />
          </button>
          <button className="toolbar-btn" onClick={() => insertFormatting('*', '*')} title="Italic">
            <Italic size={15} />
          </button>
          <span className="toolbar-divider" />
          <button className="toolbar-btn" onClick={() => insertFormatting('## ')} title="Heading 2">
            <Heading2 size={15} />
          </button>
          <button className="toolbar-btn" onClick={() => insertFormatting('- ')} title="Bullet list">
            <List size={15} />
          </button>
          <button className="toolbar-btn" onClick={() => insertFormatting('1. ')} title="Numbered list">
            <ListOrdered size={15} />
          </button>
          <button className="toolbar-btn" onClick={() => insertFormatting('```\n', '\n```')} title="Code block">
            <Code size={15} />
          </button>
          <button className="toolbar-btn" onClick={() => insertFormatting('> ')} title="Quote">
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
          <button 
            className="btn-icon"
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
              showToast('Link copied to clipboard');
            }}
            title="Share"
          >
            <Share2 size={16} />
          </button>
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
            <span>Last edited 2 minutes ago</span>
            <span className="meta-sep">•</span>
            <span>{note.tags.join(', ')}</span>
            <span className="meta-sep">•</span>
            <span>{note.readTime}</span>
          </div>

          {/* Note Content Textarea */}
          <textarea
            className="note-canvas-content"
            value={content}
            onChange={handleContentChange}
            placeholder="Type your notes, markdown, specs, or thoughts here..."
            rows={22}
          />
        </main>
      </div>

      {/* Mobile Bottom Formatting Bar (Sleek, minimal, doesn't eat screen) */}
      <div className="note-mobile-bottom-bar">
        <button className="mobile-bar-btn" onClick={() => insertFormatting('## ')}>
          <Heading2 size={16} />
        </button>
        <button className="mobile-bar-btn" onClick={() => insertFormatting('**', '**')}>
          <Bold size={16} />
        </button>
        <button className="mobile-bar-btn" onClick={() => insertFormatting('- ')}>
          <List size={16} />
        </button>
        <button className="mobile-bar-btn" onClick={() => insertFormatting('```\n', '\n```')}>
          <Code size={16} />
        </button>
        <button 
          className="mobile-bar-btn mobile-ai-pill" 
          onClick={() => onAskAIAboutNote(title)}
        >
          <Bot size={14} />
          <span>AI</span>
        </button>
      </div>
    </div>
  );
};
