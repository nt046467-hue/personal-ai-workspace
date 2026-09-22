import React from 'react';
import { Bot, X, BookOpen, Sparkles } from 'lucide-react';
import type { NavigationTab } from './DesktopSidebar';
import type { Task, KnowledgeItem } from '../../data/mockData';
import { formatTimeAgo } from '../../utils/time';
import './DesktopRightPanel.css';

interface DesktopRightPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentTab: NavigationTab;
  onNavigate: (tab: NavigationTab) => void;
  onOpenNote: (id: string) => void;
  onOpenDoc: (id: string) => void;
  tasks?: Task[];
  knowledge?: KnowledgeItem[];
  onAskAI?: (prompt: string) => void;
}

export const DesktopRightPanel: React.FC<DesktopRightPanelProps> = ({
  isOpen,
  onClose,
  currentTab,
  onNavigate,
  onOpenNote,
  onOpenDoc,
  tasks = [],
  knowledge = [],
  onAskAI,
}) => {
  if (!isOpen) return null;

  const pendingHighPriority = tasks.filter(t => !t.completed && t.priority === 'high').length;
  const pendingTotal = tasks.filter(t => !t.completed).length;

  const getViewDescription = () => {
    switch (currentTab) {
      case 'home':
        return pendingHighPriority > 0
          ? `You're currently in the HOME view. ${pendingHighPriority} high-priority tasks are scheduled for completion today.`
          : `You're currently in the HOME view. ${pendingTotal} tasks are active in your workspace.`;
      case 'tasks':
        return `You're currently in the TASKS view. ${pendingTotal} tasks pending across your active projects.`;
      case 'knowledge':
        return `You're browsing KNOWLEDGE. ${knowledge.length} notes and documents are indexed and ready for AI search.`;
      case 'projects':
      case 'project-detail':
        return "You're in the PROJECTS view tracking milestones, deliverables, and project files.";
      case 'ai':
        return "MySpace Intelligence assistant is active. Ask questions across all your workspace context.";
      default:
        return `You're currently viewing the ${currentTab.toUpperCase()} section.`;
    }
  };

  const getContextPrompts = () => {
    switch (currentTab) {
      case 'tasks':
        return ["What should I prioritize first?", "List tasks due soon"];
      case 'knowledge':
        return ["Summarize my newest document", "Find key architectural decisions"];
      case 'projects':
        return ["Summarize active project progress", "What are the next milestones?"];
      case 'home':
      default:
        return ["What's blocking today's tasks?", "Give me a daily morning brief"];
    }
  };

  const handlePromptClick = (prompt: string) => {
    if (onAskAI) {
      onAskAI(prompt);
    } else {
      onNavigate('ai');
    }
  };

  const recentItems = knowledge.slice(0, 3);

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
            {getViewDescription()}
          </p>
        </div>

        {/* Suggested Actions */}
        <div className="context-section">
          <span className="context-section-label">Quick Suggestions</span>
          {recentItems.length > 0 ? (
            recentItems.map((item) => (
              <button 
                key={item.id}
                className="context-action-item"
                onClick={() => item.type === 'document' ? onOpenDoc(item.id) : onOpenNote(item.id)}
              >
                <BookOpen size={14} className="action-item-icon" />
                <div className="action-item-text">
                  <span className="action-item-title">{item.title}</span>
                  <span className="action-item-sub">{formatTimeAgo(item.updatedAt)} • {item.readTime || (item.type === 'document' ? 'Document' : 'Note')}</span>
                </div>
              </button>
            ))
          ) : (
            <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
              No notes or documents saved yet.
            </div>
          )}
        </div>

        {/* Context AI Prompt */}
        <div className="context-ai-box">
          <span className="context-ai-title">Ask about this view</span>
          <div className="context-prompt-chip-list">
            {getContextPrompts().map((prompt, idx) => (
              <button 
                key={idx}
                className="mini-chip"
                onClick={() => handlePromptClick(prompt)}
              >
                <Sparkles size={11} style={{ marginRight: 4, display: 'inline', verticalAlign: 'middle' }} />
                "{prompt}"
              </button>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};
