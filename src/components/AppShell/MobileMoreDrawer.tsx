import React from 'react';
import { FolderKanban, CheckSquare, Settings, BookOpen, Sun, Moon, X } from 'lucide-react';
import { CURRENT_USER } from '../../data/mockData';
import type { NavigationTab } from './DesktopSidebar';
import './MobileMoreDrawer.css';

interface MobileMoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: NavigationTab) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export const MobileMoreDrawer: React.FC<MobileMoreDrawerProps> = ({
  isOpen,
  onClose,
  onNavigate,
  theme,
  onToggleTheme,
}) => {
  if (!isOpen) return null;

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
        <div className="more-user-card">
          <div className="more-user-avatar">
            {CURRENT_USER.avatar}
          </div>
          <div className="more-user-info">
            <span className="more-user-name">{CURRENT_USER.name}</span>
            <span className="more-user-email">{CURRENT_USER.email}</span>
          </div>
          <button className="btn-icon" onClick={onClose} aria-label="Close menu">
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
            <span className="more-card-sub">3 pending today</span>
          </button>

          <button 
            className="more-nav-card" 
            onClick={() => { onNavigate('projects'); onClose(); }}
          >
            <div className="more-icon-box projects-icon">
              <FolderKanban size={20} />
            </div>
            <span className="more-card-title">Projects</span>
            <span className="more-card-sub">4 active tracks</span>
          </button>

          <button 
            className="more-nav-card" 
            onClick={() => { onNavigate('knowledge'); onClose(); }}
          >
            <div className="more-icon-box knowledge-icon">
              <BookOpen size={20} />
            </div>
            <span className="more-card-title">Knowledge</span>
            <span className="more-card-sub">6 documents & notes</span>
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
