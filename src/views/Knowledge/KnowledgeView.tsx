import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  LayoutList, 
  LayoutGrid, 
  Search, 
  Plus, 
  MoreHorizontal, 
  Pin,
  BookOpen,
  Sparkles,
  Trash2,
  Copy,
  ExternalLink,
  Check
} from 'lucide-react';
import type { KnowledgeItem } from '../../data/mockData';
import { formatTimeAgo } from '../../utils/time';
import './KnowledgeView.css';

interface KnowledgeViewProps {
  knowledge: KnowledgeItem[];
  onOpenNote: (id: string) => void;
  onOpenDoc: (id: string) => void;
  onNewNote: () => void;
  onDeleteNote?: (id: string) => void;
  onAskAI?: (item: KnowledgeItem) => void;
  onTogglePin?: (id: string) => void;
}

export const KnowledgeView: React.FC<KnowledgeViewProps> = ({
  knowledge,
  onOpenNote,
  onOpenDoc,
  onNewNote,
  onDeleteNote,
  onAskAI,
  onTogglePin,
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleWindowClick = () => {
      setActiveMenuId(null);
    };
    if (activeMenuId) {
      window.addEventListener('click', handleWindowClick);
      return () => window.removeEventListener('click', handleWindowClick);
    }
  }, [activeMenuId]);

  const filteredItems = knowledge.filter(item => {
    const matchesFilter = filterType === 'all' || item.type === filterType;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const handleOpenItem = (item: KnowledgeItem) => {
    if (item.type === 'document') {
      onOpenDoc(item.id);
    } else {
      onOpenNote(item.id);
    }
  };

  return (
    <div className="knowledge-view">
      {/* View Toolbar */}
      <div className="knowledge-toolbar">
        <div className="toolbar-left">
          {/* Search bar */}
          <div className="knowledge-search-wrapper">
            <Search size={15} className="knowledge-search-icon" />
            <input 
              type="text"
              className="knowledge-search-input"
              placeholder="Search notes, documents, specs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Type filters */}
          <div className="type-filters-row">
            {['all', 'note', 'document', 'research', 'code'].map((type) => (
              <button
                key={type}
                className={`filter-chip ${filterType === type ? 'active' : ''}`}
                onClick={() => setFilterType(type)}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="toolbar-right">
          {/* Desktop List / Grid switch */}
          <div className="view-mode-toggle">
            <button 
              className={`mode-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
              aria-label="List view"
            >
              <LayoutList size={16} />
            </button>
            <button 
              className={`mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
              aria-label="Grid view"
            >
              <LayoutGrid size={16} />
            </button>
          </div>

          <button className="btn btn-primary btn-sm" onClick={onNewNote}>
            <Plus size={14} />
            <span>New Note</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      {filteredItems.length === 0 ? (
        <div className="empty-knowledge-state">
          <BookOpen size={36} className="empty-glyph" />
          <h3 className="empty-title">Your knowledge library is empty</h3>
          <p className="empty-desc">Add a note, upload a file, or save something useful to build your knowledge base.</p>
          <div className="empty-actions">
            <button className="btn btn-primary btn-sm" onClick={onNewNote}>
              <Plus size={14} /> Add Note
            </button>
          </div>
        </div>
      ) : viewMode === 'list' ? (
        /* List View (Default on desktop & mobile) */
        <div className="knowledge-list-container">
          {filteredItems.map((item) => (
            <div 
              key={item.id} 
              className="knowledge-list-row"
              onClick={() => handleOpenItem(item)}
            >
              <div className="row-icon-col">
                <div className={`doc-type-icon type-${item.type}`}>
                  <FileText size={17} />
                </div>
              </div>

              <div className="row-main-col">
                <div className="row-title-bar">
                  <span className="row-item-title">{item.title}</span>
                  {item.pinned && <Pin size={12} className="pinned-icon" />}
                </div>
                <span className="row-item-excerpt">{item.excerpt}</span>
                <div className="row-tags-strip">
                  {item.tags.map(t => (
                    <span key={t} className="knowledge-tag-pill">{t}</span>
                  ))}
                </div>
              </div>

              <div className="row-meta-col">
                <span className="meta-read-time">{item.readTime}</span>
                <span className="meta-updated">{formatTimeAgo(item.updatedAt)}</span>
              </div>

              <div className="row-actions-col">
                <button 
                  className="btn-icon" 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setActiveMenuId(prev => prev === item.id ? null : item.id);
                  }}
                  title="More actions"
                  aria-label="More actions"
                  aria-expanded={activeMenuId === item.id}
                >
                  <MoreHorizontal size={16} />
                </button>

                {activeMenuId === item.id && (
                  <div 
                    className="knowledge-dropdown-menu" 
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button 
                      className="dropdown-item"
                      onClick={() => {
                        setActiveMenuId(null);
                        handleOpenItem(item);
                      }}
                    >
                      <ExternalLink size={13} />
                      <span>Open {item.type === 'document' ? 'Document' : 'Note'}</span>
                    </button>

                    {onAskAI && (
                      <button 
                        className="dropdown-item"
                        onClick={() => {
                          setActiveMenuId(null);
                          onAskAI(item);
                        }}
                      >
                        <Sparkles size={13} />
                        <span>Ask AI about this</span>
                      </button>
                    )}

                    {onTogglePin && (
                      <button 
                        className="dropdown-item"
                        onClick={() => {
                          setActiveMenuId(null);
                          onTogglePin(item.id);
                        }}
                      >
                        <Pin size={13} />
                        <span>{item.pinned ? 'Unpin from Sidebar' : 'Pin to Sidebar'}</span>
                      </button>
                    )}

                    <button 
                      className="dropdown-item"
                      onClick={() => {
                        navigator.clipboard.writeText(item.title);
                        setCopiedId(item.id);
                        setTimeout(() => setCopiedId(null), 1500);
                        setActiveMenuId(null);
                      }}
                    >
                      {copiedId === item.id ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copiedId === item.id ? 'Copied!' : 'Copy Title'}</span>
                    </button>

                    {onDeleteNote && (
                      <>
                        <div className="dropdown-divider" />
                        <button 
                          className="dropdown-item danger"
                          onClick={() => {
                            setActiveMenuId(null);
                            if (window.confirm(`Delete "${item.title}"?`)) {
                              onDeleteNote(item.id);
                            }
                          }}
                        >
                          <Trash2 size={13} />
                          <span>Delete</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Grid View (Desktop only compact cards) */
        <div className="knowledge-grid-container">
          {filteredItems.map((item) => (
            <div 
              key={item.id} 
              className="knowledge-grid-card"
              onClick={() => handleOpenItem(item)}
            >
              <div className="grid-card-header">
                <div className={`doc-type-icon type-${item.type}`}>
                  <FileText size={16} />
                </div>
                <span className="badge badge-default">{item.type}</span>
              </div>

              <h3 className="grid-card-title">{item.title}</h3>
              <p className="grid-card-excerpt">{item.excerpt}</p>

              <div className="grid-card-footer">
                <div className="grid-tags">
                  {item.tags.slice(0, 2).map(t => (
                    <span key={t} className="knowledge-tag-pill">{t}</span>
                  ))}
                  {item.tags.length > 2 && <span className="knowledge-tag-more">+{item.tags.length - 2}</span>}
                </div>
                <span className="grid-updated-time">{formatTimeAgo(item.updatedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
