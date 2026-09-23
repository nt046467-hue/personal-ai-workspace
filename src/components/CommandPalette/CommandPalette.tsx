import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Search, 
  FileText, 
  CheckSquare, 
  FolderKanban, 
  Bot,
  BrainCircuit,
  Clock, 
  ArrowRight, 
  X,
  Bookmark
} from 'lucide-react';
import { api } from '../../services/api';
import { HighlightText } from '../HighlightText/HighlightText';
import { openSafeExternalUrl } from '../../utils/security';
import type { NavigationTab } from '../AppShell/DesktopSidebar';
import './CommandPalette.css';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: NavigationTab) => void;
  onOpenNote?: (id: string) => void;
  onOpenDoc?: (id: string) => void;
  onOpenProject?: (id: string) => void;
}

export interface RecentSearchItem {
  id: string;
  type: 'query' | 'note' | 'document' | 'task' | 'project' | 'bookmark';
  title: string;
  subtitle?: string;
  targetId?: string;
  url?: string;
  timestamp: number;
}

const RECENT_SEARCHES_STORAGE_KEY = 'myspace_recent_searches';

const DEFAULT_RECENT_SEARCHES: RecentSearchItem[] = [
  {
    id: 'recent-1',
    type: 'note',
    title: 'Firebase Security Architecture & Multi-Tenant Rules',
    subtitle: 'Notes • Multi-tenant verified',
    targetId: 'k-1',
    timestamp: Date.now() - 3600000,
  },
  {
    id: 'recent-2',
    type: 'document',
    title: 'Distributed Event-Driven Architecture Spec.pdf',
    subtitle: 'Document • 18 pages • p95 SLA',
    targetId: 'k-2',
    timestamp: Date.now() - 7200000,
  },
];

function loadRecentSearches(): RecentSearchItem[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
    if (!raw) return DEFAULT_RECENT_SEARCHES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [];
  } catch {
    return DEFAULT_RECENT_SEARCHES;
  }
}

function persistRecentSearches(items: RecentSearchItem[]) {
  try {
    localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(items.slice(0, 8)));
  } catch (err) {
    console.warn('[Search] Failed to persist recent searches:', err);
  }
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenNote,
  onOpenDoc,
  onOpenProject,
}) => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>(loadRecentSearches);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSearchResults([]);
      setRecentSearches(loadRecentSearches());
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd+K — toggle open/close
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        return;
      }
      // Escape — always close
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Debounced search against backend /api/search
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await api.searchWorkspace(query.trim());
        setSearchResults(results || []);
      } catch (err) {
        console.error('[Search] Failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [query]);

  const recordRecentItem = useCallback((entry: Omit<RecentSearchItem, 'timestamp'>) => {
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => {
        if (entry.targetId && item.targetId) return item.targetId !== entry.targetId;
        return item.title.toLowerCase() !== entry.title.toLowerCase();
      });
      const updated = [{ ...entry, timestamp: Date.now() }, ...filtered].slice(0, 8);
      persistRecentSearches(updated);
      return updated;
    });
  }, []);

  const handleClearRecentSearches = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches([]);
    try {
      localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify([]));
    } catch {}
  };

  const handleRemoveRecentSearch = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setRecentSearches((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      persistRecentSearches(updated);
      return updated;
    });
  };

  const handleSelectRecentSearch = (item: RecentSearchItem) => {
    if (item.type === 'query') {
      setQuery(item.title);
      inputRef.current?.focus();
      return;
    }
    if (item.type === 'note' && item.targetId) {
      if (onOpenNote) onOpenNote(item.targetId);
      else onNavigate('note-editor');
    } else if (item.type === 'document' && item.targetId) {
      if (onOpenDoc) onOpenDoc(item.targetId);
      else onNavigate('doc-viewer');
    } else if (item.type === 'task') {
      onNavigate('tasks');
    } else if (item.type === 'project' && item.targetId) {
      if (onOpenProject) onOpenProject(item.targetId);
      else onNavigate('projects');
    } else if (item.type === 'bookmark') {
      openSafeExternalUrl(item.url || item.title);
    }
    onClose();
  };

  if (!isOpen) return null;

  const defaultSuggested = [
    { id: 'act-1', title: 'Ask AI: Summarize my recent work', icon: <Bot size={16} />, action: () => { onNavigate('ai'); onClose(); } },
    { id: 'act-2', title: 'Open Firebase Security Rules', icon: <FileText size={16} />, action: () => { if (onOpenNote) onOpenNote('k-1'); else onNavigate('note-editor'); onClose(); } },
    { id: 'act-3', title: 'View Architecture Spec.pdf', icon: <FileText size={16} />, action: () => { if (onOpenDoc) onOpenDoc('k-2'); else onNavigate('doc-viewer'); onClose(); } },
    { id: 'act-4', title: 'Filter Today’s Unfinished Tasks', icon: <CheckSquare size={16} />, action: () => { onNavigate('tasks'); onClose(); } },
  ];

  const knowledgeResults = searchResults.filter(r => r.type === 'note' || r.type === 'document');
  const taskResults = searchResults.filter(r => r.type === 'task');
  const projectResults = searchResults.filter(r => r.type === 'project');
  const bookmarkResults = searchResults.filter(r => r.type === 'bookmark');

  const getRecentIcon = (type: RecentSearchItem['type']) => {
    switch (type) {
      case 'task': return <CheckSquare size={16} className="item-icon" />;
      case 'project': return <FolderKanban size={16} className="item-icon" />;
      case 'bookmark': return <Bookmark size={16} className="item-icon" />;
      case 'query': return <Clock size={16} className="item-icon" />;
      case 'document':
      case 'note':
      default:
        return <FileText size={16} className="item-icon" />;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="command-palette-modal" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Universal Search"
      >
        {/* Search Header */}
        <div className="command-search-header">
          <Search size={18} className="command-search-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            className="command-search-input"
            placeholder="Search notes, documents, tasks, projects, or commands..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              } else if (e.key === 'Enter' && query.trim()) {
                recordRecentItem({
                  id: `query-${Date.now()}`,
                  type: 'query',
                  title: query.trim(),
                  subtitle: 'Search query',
                });
              }
            }}
            autoComplete="off"
            spellCheck="false"
          />
          <div className="command-search-actions">
            {query && (
              <button 
                type="button"
                className="command-clear-btn" 
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                aria-label="Clear search"
                title="Clear search"
              >
                <X size={16} />
              </button>
            )}
            <kbd className="command-esc-badge" onClick={onClose} title="Close (ESC)">ESC</kbd>
          </div>
        </div>

        {/* Results Body */}
        <div className="command-results-list">
          {!query ? (
            <>
              {recentSearches.length > 0 && (
                <div className="command-section">
                  <div className="command-section-header-row">
                    <span className="command-section-title">
                      <Clock size={12} style={{ marginRight: 6 }} /> Recent Searches
                    </span>
                    <button
                      type="button"
                      className="command-section-clear-btn"
                      onClick={handleClearRecentSearches}
                      title="Clear recent searches"
                    >
                      Clear
                    </button>
                  </div>
                  {recentSearches.map((item) => (
                    <div 
                      key={item.id} 
                      className="command-item" 
                      onClick={() => handleSelectRecentSearch(item)}
                    >
                      {getRecentIcon(item.type)}
                      <div className="item-content">
                        <span className="item-title">{item.title}</span>
                        {item.subtitle && <span className="item-subtitle">{item.subtitle}</span>}
                      </div>
                      <span className="item-badge">{item.type}</span>
                      <button
                        type="button"
                        className="item-remove-btn"
                        onClick={(e) => handleRemoveRecentSearch(e, item.id)}
                        title="Remove"
                        aria-label="Remove"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="command-section">
                <span className="command-section-title">Suggested Actions</span>
                {defaultSuggested.map((item) => (
                  <div key={item.id} className="command-item" onClick={item.action}>
                    <div className="item-icon action-icon">{item.icon}</div>
                    <div className="item-content">
                      <span className="item-title">{item.title}</span>
                    </div>
                    <ArrowRight size={14} className="item-arrow" />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {isSearching ? (
                <div className="command-empty-state">
                  <BrainCircuit size={24} className="empty-icon accent-glyph" />
                  <p className="empty-text">Searching your workspace...</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="command-empty-state">
                  <Search size={28} className="empty-icon" />
                  <p className="empty-text">No matching records found for "{query}"</p>
                  <span className="empty-sub">Try searching for "Firebase", "Audit", or "Architecture"</span>
                </div>
              ) : (
                <>
                  {knowledgeResults.length > 0 && (
                    <div className="command-section">
                      <span className="command-section-title">Knowledge & Documents</span>
                      {knowledgeResults.map((item) => (
                        <div 
                          key={item.id} 
                          className="command-item"
                          onClick={() => {
                            recordRecentItem({
                              id: item.id,
                              type: item.type === 'document' ? 'document' : 'note',
                              title: item.title,
                              subtitle: item.excerpt || (item.type === 'document' ? 'Document' : 'Note'),
                              targetId: item.id,
                            });
                            if (item.type === 'document') {
                              if (onOpenDoc) onOpenDoc(item.id);
                              else onNavigate('doc-viewer');
                            } else {
                              if (onOpenNote) onOpenNote(item.id);
                              else onNavigate('note-editor');
                            }
                            onClose();
                          }}
                        >
                          <FileText size={16} className="item-icon" />
                          <div className="item-content">
                            <span className="item-title">
                              <HighlightText text={item.title} query={query} />
                            </span>
                            <span className="item-subtitle">
                              <HighlightText text={item.excerpt} query={query} />
                            </span>
                          </div>
                          <span className="item-badge">{item.type}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {taskResults.length > 0 && (
                    <div className="command-section">
                      <span className="command-section-title">Tasks</span>
                      {taskResults.map((t) => (
                        <div 
                          key={t.id} 
                          className="command-item"
                          onClick={() => {
                            recordRecentItem({
                              id: t.id,
                              type: 'task',
                              title: t.title,
                              subtitle: t.metadata?.priority ? `Priority: ${t.metadata.priority}` : 'Task',
                              targetId: t.id,
                            });
                            onNavigate('tasks');
                            onClose();
                          }}
                        >
                          <CheckSquare size={16} className="item-icon" />
                          <div className="item-content">
                            <span className="item-title">
                              <HighlightText text={t.title} query={query} />
                            </span>
                            <span className="item-subtitle">
                              <HighlightText text={t.excerpt} query={query} />
                            </span>
                          </div>
                          <span className="badge badge-default">
                            {t.metadata?.priority || 'task'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {projectResults.length > 0 && (
                    <div className="command-section">
                      <span className="command-section-title">Projects</span>
                      {projectResults.map((p) => (
                        <div 
                          key={p.id} 
                          className="command-item"
                          onClick={() => {
                            recordRecentItem({
                              id: p.id,
                              type: 'project',
                              title: p.title,
                              subtitle: `Project • ${p.metadata?.progress || 0}%`,
                              targetId: p.id,
                            });
                            if (onOpenProject) onOpenProject(p.id);
                            else onNavigate('projects');
                            onClose();
                          }}
                        >
                          <FolderKanban size={16} className="item-icon" />
                          <div className="item-content">
                            <span className="item-title">
                              <HighlightText text={p.title} query={query} />
                            </span>
                            <span className="item-subtitle">
                              <HighlightText text={p.excerpt} query={query} />
                            </span>
                          </div>
                          <span className="item-badge">{p.metadata?.progress || 0}%</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {bookmarkResults.length > 0 && (
                    <div className="command-section">
                      <span className="command-section-title">Bookmarks</span>
                      {bookmarkResults.map((b) => (
                        <div 
                          key={b.id} 
                          className="command-item"
                          onClick={() => {
                            recordRecentItem({
                              id: b.id,
                              type: 'bookmark',
                              title: b.title,
                              subtitle: b.metadata?.url || 'Bookmark',
                              url: b.metadata?.url || b.title,
                            });
                            openSafeExternalUrl(b.metadata?.url || b.title);
                            onClose();
                          }}
                        >
                          <Bookmark size={16} className="item-icon" />
                          <div className="item-content">
                            <span className="item-title">
                              <HighlightText text={b.title} query={query} />
                            </span>
                            <span className="item-subtitle">
                              <HighlightText text={b.excerpt} query={query} />
                            </span>
                          </div>
                          <span className="item-badge">Link</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer info */}
        <div className="command-footer">
          <div className="command-hint">
            <span>Navigation:</span>
            <kbd className="command-hint-kbd">↑</kbd>
            <kbd className="command-hint-kbd">↓</kbd>
            <span>Select:</span>
            <kbd className="command-hint-kbd">↵</kbd>
          </div>
          <span className="command-brand-label">MySpace Intelligence Search</span>
        </div>
      </div>
    </div>
  );
};
