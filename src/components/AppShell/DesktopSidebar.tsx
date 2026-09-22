import React from 'react';
import { 
  Home, 
  BookOpen, 
  CheckSquare, 
  FolderKanban, 
  Bot, 
  Settings, 
  ChevronLeft, 
  Sun, 
  Moon, 
  FileText,
  Pin
} from 'lucide-react';
import { MySpaceLogo } from '../Brand/MySpaceLogo';
import { CURRENT_USER } from '../../data/mockData';
import type { UserSession } from '../../services/api';
import './DesktopSidebar.css';

import type { KnowledgeItem } from '../../data/mockData';

export type NavigationTab = 'home' | 'knowledge' | 'tasks' | 'projects' | 'ai' | 'settings' | 'profile' | 'note-editor' | 'doc-viewer' | 'project-detail';

interface DesktopSidebarProps {
  currentTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  pendingTasksCount: number;
  user?: UserSession;
  onOpenAuth?: () => void;
  onOpenProfile?: () => void;
  pinnedItems?: KnowledgeItem[];
  onOpenNote?: (id: string) => void;
  onOpenDoc?: (id: string) => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  currentTab,
  onSelectTab,
  theme,
  onToggleTheme,
  collapsed,
  onToggleCollapse,
  pendingTasksCount,
  user,
  onOpenAuth,
  onOpenProfile,
  pinnedItems = [],
  onOpenNote,
  onOpenDoc,
}) => {
  const activeUser = user || CURRENT_USER;
  return (
    <aside className={`desktop-sidebar ${collapsed ? 'collapsed' : 'expanded'}`}>
      {/* Workspace Header & Logo */}
      <div className="sidebar-header">
        {collapsed ? (
          /* Collapsed: show brand M-mark icon as expand trigger */
          <button
            className="collapse-btn btn-icon collapsed-expand-btn"
            onClick={onToggleCollapse}
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <MySpaceLogo size={24} />
          </button>
        ) : (
          /* Expanded: mark icon + theme-aware text (always readable in dark/light) */
          <>
            <div className="sidebar-brand" onClick={() => onSelectTab('home')} style={{ cursor: 'pointer' }}>
              <div className="brand-icon">
                <MySpaceLogo size={24} />
              </div>
              <div className="brand-info">
                <span className="brand-name">MySpace<span className="brand-accent">AI</span></span>
                <span className="brand-workspace">{CURRENT_USER.workspaceName}</span>
              </div>
            </div>
            <button 
              className="collapse-btn btn-icon" 
              onClick={onToggleCollapse}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft size={16} />
            </button>
          </>
        )}
      </div>

      {/* Primary Navigation */}
      <nav className="sidebar-nav">
        <div className="nav-group">
          {!collapsed && <span className="nav-group-label">Workspace</span>}
          
          <button 
            className={`nav-item ${currentTab === 'home' ? 'active' : ''}`}
            onClick={() => onSelectTab('home')}
            title="Home"
          >
            <Home size={18} className="nav-icon" />
            {!collapsed && <span className="nav-text">Home</span>}
          </button>

          <button 
            className={`nav-item ${currentTab === 'knowledge' || currentTab === 'note-editor' || currentTab === 'doc-viewer' ? 'active' : ''}`}
            onClick={() => onSelectTab('knowledge')}
            title="Knowledge Base"
          >
            <BookOpen size={18} className="nav-icon" />
            {!collapsed && <span className="nav-text">Knowledge</span>}
          </button>

          <button 
            className={`nav-item ${currentTab === 'tasks' ? 'active' : ''}`}
            onClick={() => onSelectTab('tasks')}
            title="Tasks"
          >
            <CheckSquare size={18} className="nav-icon" />
            {!collapsed && <span className="nav-text">Tasks</span>}
            {!collapsed && pendingTasksCount > 0 && (
              <span className="nav-badge badge badge-default">{pendingTasksCount}</span>
            )}
          </button>

          <button 
            className={`nav-item ${currentTab === 'projects' || currentTab === 'project-detail' ? 'active' : ''}`}
            onClick={() => onSelectTab('projects')}
            title="Projects"
          >
            <FolderKanban size={18} className="nav-icon" />
            {!collapsed && <span className="nav-text">Projects</span>}
          </button>

          <button 
            className={`nav-item ${currentTab === 'ai' ? 'active' : ''}`}
            onClick={() => onSelectTab('ai')}
            title="AI Assistant"
          >
            <Bot size={18} className="nav-icon ai-nav-icon" />
            {!collapsed && (
              <div className="nav-text-container">
                <span className="nav-text">AI Assistant</span>
                <span className="ai-status-pill">Ready</span>
              </div>
            )}
          </button>
        </div>

        {/* Pinned & Quick Access */}
        {!collapsed && (
          <div className="nav-group favorites-group">
            <span className="nav-group-label">
              <Pin size={11} style={{ marginRight: 4 }} /> Pinned & Focus
            </span>
            {pinnedItems.length > 0 ? (
              pinnedItems.slice(0, 5).map((item) => (
                <button 
                  key={item.id}
                  className="nav-subitem" 
                  onClick={() => {
                    if (item.type === 'document') {
                      onOpenDoc ? onOpenDoc(item.id) : onSelectTab('doc-viewer');
                    } else {
                      onOpenNote ? onOpenNote(item.id) : onSelectTab('note-editor');
                    }
                  }}
                  title={item.title}
                >
                  <FileText size={14} className="subitem-icon" />
                  <span className="subitem-text">{item.title}</span>
                </button>
              ))
            ) : (
              <div className="sidebar-empty-hint">
                <span>No pinned items yet</span>
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Footer / Profile & Settings */}
      <div className="sidebar-footer">
        <button 
          className={`footer-item ${currentTab === 'settings' ? 'active' : ''}`}
          onClick={() => onSelectTab('settings')}
          title="Settings"
        >
          <Settings size={18} className="nav-icon" />
          {!collapsed && <span className="nav-text">Settings</span>}
        </button>

        <button 
          className="footer-item theme-toggle-btn"
          onClick={onToggleTheme}
          title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {theme === 'dark' ? <Sun size={18} className="nav-icon" /> : <Moon size={18} className="nav-icon" />}
          {!collapsed && <span className="nav-text">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>

        <div 
          className="user-profile-strip"
          onClick={() => {
            if (user) {
              if (onOpenProfile) {
                onOpenProfile();
              } else {
                onSelectTab('settings');
              }
            } else {
              onOpenAuth?.();
            }
          }}
          role="button"
          tabIndex={0}
          title={user ? "View My Profile" : "Sign in to workspace"}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (user) {
                if (onOpenProfile) {
                  onOpenProfile();
                } else {
                  onSelectTab('settings');
                }
              } else {
                onOpenAuth?.();
              }
            }
          }}
        >
          <div className="user-avatar" title={activeUser.name}>
            {activeUser.avatar}
          </div>
          {!collapsed && (
            <div className="user-details">
              <span className="user-name">{activeUser.name}</span>
              <span className="user-role">{activeUser.role}</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
