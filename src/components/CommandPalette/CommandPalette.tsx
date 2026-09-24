import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search,
  FileText,
  CheckSquare,
  FolderKanban,
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
import type { Activity, KnowledgeItem, Task } from '../../data/mockData';
import './CommandPalette.css';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: NavigationTab) => void;
  onOpenNote?: (id: string) => void;
  onOpenDoc?: (id: string) => void;
  onOpenProject?: (id: string) => void;
  recentActivities?: Activity[];
  knowledge?: KnowledgeItem[];
  tasks?: Task[];
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

const DUMMY_SEARCH_TITLES = new Set([
  'firebase security architecture & multi-tenant rules',
  'distributed event-driven architecture spec.pdf',
]);

function sanitizeRecentSearches(items: RecentSearchItem[]): RecentSearchItem[] {
  if (!Array.isArray(items)) return [];
  const seenTitles = new Set<string>();
  const seenTargets = new Set<string>();
  const deduped: RecentSearchItem[] = [];

  for (const item of items) {
    if (!item || typeof item.title !== 'string') continue;
    const cleanTitle = item.title.trim();
    if (!cleanTitle) continue;
    const titleKey = cleanTitle.toLowerCase();

    // Strip out dummy / mock placeholder items
    if (DUMMY_SEARCH_TITLES.has(titleKey) || item.id === 'recent-1' || item.id === 'recent-2') {
      continue;
    }

    // Deduplicate by targetId if present
    if (item.targetId && seenTargets.has(item.targetId)) {
      continue;
    }

    // Deduplicate by normalized title
    if (seenTitles.has(titleKey)) {
      continue;
    }

    seenTitles.add(titleKey);
    if (item.targetId) {
      seenTargets.add(item.targetId);
    }

    deduped.push({
      ...item,
      title: cleanTitle,
      subtitle: item.subtitle ? item.subtitle.trim() : undefined,
    });
  }

  return deduped.slice(0, 8);
}

function loadRecentSearches(): RecentSearchItem[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [];
    }
    const sanitized = sanitizeRecentSearches(parsed);
    // If dummy items or duplicates existed in localStorage, immediately overwrite with sanitized
    if (sanitized.length !== parsed.length) {
      persistRecentSearches(sanitized);
    }
    return sanitized;
  } catch {
    return [];
  }
}

function persistRecentSearches(items: RecentSearchItem[]) {
  try {
    const sanitized = sanitizeRecentSearches(items);
    localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(sanitized));
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
  recentActivities = [],
  knowledge = [],
  tasks = [],
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
    const cleanTitle = (entry.title || '').trim();
    if (!cleanTitle) return;

    setRecentSearches((prev) => {
      const lowerNewTitle = cleanTitle.toLowerCase();
      // Remove any item that matches either the same normalized title OR the same targetId
      const filtered = prev.filter((item) => {
        if (!item || !item.title) return false;
        if (entry.targetId && item.targetId && entry.targetId === item.targetId) {
          return false;
        }
        if (item.title.trim().toLowerCase() === lowerNewTitle) {
          return false;
        }
        return true;
      });

      const updatedItem: RecentSearchItem = {
        ...entry,
        title: cleanTitle,
        subtitle: entry.subtitle?.trim(),
        timestamp: Date.now(),
      };

      const updated = sanitizeRecentSearches([updatedItem, ...filtered]);
      persistRecentSearches(updated);
      return updated;
    });
  }, []);

  const handleClearRecentSearches = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches([]);
    try {
      localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify([]));
    } catch { }
  };

  const handleRemoveRecentSearch = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setRecentSearches((prev) => {
      const targetItem = prev.find(item => item.id === id);
      const targetTitle = targetItem?.title?.trim().toLowerCase();
      const updated = prev.filter((item) => {
        if (item.id === id) return false;
        if (targetTitle && item.title.trim().toLowerCase() === targetTitle) return false;
        return true;
      });
      const sanitized = sanitizeRecentSearches(updated);
      persistRecentSearches(sanitized);
      return sanitized;
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

  const suggestedItems = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      type: 'note' | 'document' | 'task' | 'project' | 'bookmark';
      subtitle?: string;
      targetId?: string;
      action: () => void;
    }> = [];

    // Try real activities first
    if (recentActivities && recentActivities.length > 0) {
      for (const act of recentActivities) {
        if (items.length >= 4) break;
        const targetId = act.targetId;
        if (act.type === 'document' && targetId) {
          items.push({
            id: act.id,
            title: act.detail || act.title,
            type: 'document',
            subtitle: act.title,
            targetId,
            action: () => { if (onOpenDoc) onOpenDoc(targetId); else onNavigate('doc-viewer'); onClose(); },
          });
        } else if (act.type === 'note' && targetId) {
          items.push({
            id: act.id,
            title: act.detail || act.title,
            type: 'note',
            subtitle: act.title,
            targetId,
            action: () => { if (onOpenNote) onOpenNote(targetId); else onNavigate('note-editor'); onClose(); },
          });
        } else if (act.type === 'task') {
          items.push({
            id: act.id,
            title: act.detail || act.title,
            type: 'task',
            subtitle: 'Task',
            targetId,
            action: () => { onNavigate('tasks'); onClose(); },
          });
        } else if (act.type === 'project' && targetId) {
          items.push({
            id: act.id,
            title: act.detail || act.title,
            type: 'project',
            subtitle: 'Project',
            targetId,
            action: () => { if (onOpenProject) onOpenProject(targetId); else onNavigate('projects'); onClose(); },
          });
        }
      }
    }

    // Fill with real knowledge items
    if (items.length < 4 && knowledge && knowledge.length > 0) {
      for (const k of knowledge) {
        if (items.length >= 4) break;
        if (items.some(i => i.targetId === k.id)) continue;
        items.push({
          id: `k-${k.id}`,
          title: k.title,
          type: k.type === 'document' ? 'document' : 'note',
          subtitle: k.excerpt || (k.type === 'document' ? 'Document' : 'Note'),
          targetId: k.id,
          action: () => {
            if (k.type === 'document') {
              if (onOpenDoc) onOpenDoc(k.id); else onNavigate('doc-viewer');
            } else {
              if (onOpenNote) onOpenNote(k.id); else onNavigate('note-editor');
            }
            onClose();
          },
        });
      }
    }

    // Fill with real tasks
    if (items.length < 4 && tasks && tasks.length > 0) {
      for (const t of tasks) {
        if (items.length >= 4) break;
        if (items.some(i => i.targetId === t.id)) continue;
        items.push({
          id: `t-${t.id}`,
          title: t.title,
          type: 'task',
          subtitle: t.project || 'Task',
          targetId: t.id,
          action: () => { onNavigate('tasks'); onClose(); },
        });
      }
    }

    return items;
  }, [recentActivities, knowledge, tasks, onOpenDoc, onOpenNote, onOpenProject, onNavigate, onClose]);

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

              {suggestedItems.length > 0 && (
                <div className="command-section">
                  <span className="command-section-title">Recent Workspace Items</span>
                  {suggestedItems.map((item) => (
                    <div
                      key={item.id}
                      className="command-item"
                      onClick={() => {
                        recordRecentItem({
                          id: item.id,
                          type: item.type,
                          title: item.title,
                          subtitle: item.subtitle,
                          targetId: item.targetId,
                        });
                        item.action();
                      }}
                    >
                      {getRecentIcon(item.type)}
                      <div className="item-content">
                        <span className="item-title">{item.title}</span>
                        {item.subtitle && <span className="item-subtitle">{item.subtitle}</span>}
                      </div>
                      <span className="item-badge">{item.type}</span>
                      <ArrowRight size={14} className="item-arrow" />
                    </div>
                  ))}
                </div>
              )}

              {recentSearches.length === 0 && suggestedItems.length === 0 && (
                <div className="command-empty-state">
                  <Search size={28} className="empty-icon" />
                  <p className="empty-text">Start typing to search your workspace</p>
                  <span className="empty-sub">Search notes, documents, tasks, and projects</span>
                </div>
              )}
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
