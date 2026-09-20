import React from 'react';
import { Bot, X, BookOpen } from 'lucide-react';
import type { NavigationTab } from './DesktopSidebar';
import './DesktopRightPanel.css';

interface DesktopRightPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentTab: NavigationTab;
  onNavigate: (tab: NavigationTab) => void;
  onOpenNote: (id: string) => void;
  onOpenDoc: (id: string) => void;
}

export const DesktopRightPanel: React.FC<DesktopRightPanelProps> = ({
  isOpen,
  onClose,
  currentTab,
  onNavigate,
  onOpenNote,
  onOpenDoc,
}) => {
  if (!isOpen) return null;

  return (
    <aside className="desktop-context-panel" aria-label="Contextual Assistant Panel">
      <div className="context-panel-header">
        <div className="panel-title-wrap">
          <Bot size={16} className="accent-glyph" />
          <span className="panel-heading">Contextual Intelligence</span>
        </div>
        <button className="btn-icon" onClick={onClose} aria-label="Close context panel">
          <X size={16} />
        </button>
      </div>

      <div className="context-panel-body">
        {/* Workspace Quick Insights */}
        <div className="context-card">
          <h4 className="context-card-title">Active Workspace Focus</h4>
          <p className="context-card-desc">
            You're currently in the <strong>{currentTab.toUpperCase()}</strong> view. 
            3 high-priority tasks are scheduled for completion today.
          </p>
        </div>

        {/* Suggested Actions */}
        <div className="context-section">
          <span className="context-section-label">Quick Suggestions</span>
          <button 
            className="context-action-item"
            onClick={() => onOpenNote('k-1')}
          >
            <BookOpen size={14} className="action-item-icon" />
            <div className="action-item-text">
              <span className="action-item-title">Firebase Security Architecture</span>
              <span className="action-item-sub">Updated 2h ago</span>
            </div>
          </button>

          <button 
            className="context-action-item"
            onClick={() => onOpenDoc('k-2')}
          >
            <BookOpen size={14} className="action-item-icon" />
            <div className="action-item-text">
              <span className="action-item-title">Architecture Spec.pdf</span>
              <span className="action-item-sub">18 pages • p95 SLA</span>
            </div>
          </button>
        </div>

        {/* Context AI Prompt */}
        <div className="context-ai-box">
          <span className="context-ai-title">Ask about this view</span>
          <div className="context-prompt-chip-list">
            <button 
              className="mini-chip"
              onClick={() => onNavigate('ai')}
            >
              "What's blocking today's tasks?"
            </button>
            <button 
              className="mini-chip"
              onClick={() => onNavigate('ai')}
            >
              "Summarize Q3 deliverables"
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
