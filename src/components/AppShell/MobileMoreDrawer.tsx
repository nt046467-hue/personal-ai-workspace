import React from 'react';
import { FolderKanban, CheckSquare, Settings, BookOpen, Sun, Moon, X } from 'lucide-react';
import { CURRENT_USER, type Task, type Project, type KnowledgeItem } from '../../data/mockData';
import type { NavigationTab } from './DesktopSidebar';
import type { UserSession } from '../../services/api';
import './MobileMoreDrawer.css';

interface MobileMoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: NavigationTab) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenProfile?: () => void;
  tasks?: Task[];
  projects?: Project[];
  knowledge?: KnowledgeItem[];
  user?: UserSession | null;
}

export const MobileMoreDrawer: React.FC<MobileMoreDrawerProps> = ({
  isOpen,
  onClose,
  onNavigate,
  theme,
  onToggleTheme,
  onOpenProfile,
  tasks,
  projects,
  knowledge,
  user,
}) => {
  if (!isOpen) return null;

  const userDisplayName = user?.name || CURRENT_USER.name;
  const userEmail = user?.email || CURRENT_USER.email;
  const userAvatar = user?.avatar || CURRENT_USER.avatar;

  const pendingTasks = (tasks || []).filter(t => !t.completed);
  const pendingCount = pendingTasks.length;
  const todayPendingCount = pendingTasks.filter(t => t.dueCategory === 'today').length;
  const taskSubText = pendingCount === 0
    ? 'All done for now'
    : `${pendingCount} pending${todayPendingCount > 0 ? ` (${todayPendingCount} today)` : ''}`;

  const activeProjectsCount = (projects || []).length;
  const projectSubText = activeProjectsCount === 0
    ? 'No active tracks'
    : `${activeProjectsCount} active ${activeProjectsCount === 1 ? 'project' : 'projects'}`;

  const knowledgeCount = (knowledge || []).length;
  const knowledgeSubText = knowledgeCount === 0
    ? 'No saved items'
    : `${knowledgeCount} ${knowledgeCount === 1 ? 'document / note' : 'documents & notes'}`;

  return (
    <div className="bottom-sheet-overlay" onClick={onClose}>
      <div 
        className="mobile-more-sheet" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="More Navigation"
      >
        <div className="sheet-handle-bar">
          <div className="sheet-handle" />
        </div>

        {/* User Card */}
        <div 
          className="more-user-card"
          style={{ cursor: onOpenProfile ? 'pointer' : 'default' }}
          onClick={() => {
            if (onOpenProfile) {
              onClose();
              onOpenProfile();
            }
          }}
        >
          <div className="more-user-avatar">
            {userAvatar}
          </div>
          <div className="more-user-info">
            <span className="more-user-name">{userDisplayName}</span>
            <span className="more-user-email">{userEmail}</span>
          </div>
          <button className="btn-icon" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        {/* Navigation Grid */}
        <div className="more-nav-grid">
          <button 
            className="more-nav-card" 
            onClick={() => { onNavigate('tasks'); onClose(); }}
          >
            <div className="more-icon-box tasks-icon">
              <CheckSquare size={20} />
            </div>
            <span className="more-card-title">Tasks</span>
            <span className="more-card-sub">{taskSubText}</span>
          </button>

          <button 
            className="more-nav-card" 
            onClick={() => { onNavigate('projects'); onClose(); }}
          >
            <div className="more-icon-box projects-icon">
              <FolderKanban size={20} />
            </div>
            <span className="more-card-title">Projects</span>
            <span className="more-card-sub">{projectSubText}</span>
          </button>

          <button 
            className="more-nav-card" 
            onClick={() => { onNavigate('knowledge'); onClose(); }}
          >
            <div className="more-icon-box knowledge-icon">
              <BookOpen size={20} />
            </div>
            <span className="more-card-title">Knowledge</span>
            <span className="more-card-sub">{knowledgeSubText}</span>
          </button>

          <button 
            className="more-nav-card" 
            onClick={() => { onNavigate('settings'); onClose(); }}
          >
            <div className="more-icon-box settings-icon">
              <Settings size={20} />
            </div>
            <span className="more-card-title">Settings</span>
            <span className="more-card-sub">Account & display</span>
          </button>
        </div>

        {/* Theme row */}
        <div className="more-theme-row">
          <span className="more-theme-label">Appearance</span>
          <button className="btn btn-secondary btn-sm" onClick={onToggleTheme}>
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
