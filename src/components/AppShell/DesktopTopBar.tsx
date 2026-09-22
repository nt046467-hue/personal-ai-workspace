import React, { useState, useRef } from 'react';
import { Search, Plus, PanelRight, ChevronRight } from 'lucide-react';
import type { NavigationTab } from './DesktopSidebar';
import { NotificationPopover } from '../Notifications/NotificationPopover';
import { NotificationBellIcon } from '../Notifications/NotificationBellIcon';
import { useNotifications } from '../../hooks/useNotifications';
import type { UseNotificationsResult } from '../../hooks/useNotifications';
import type { Task, Activity } from '../../data/mockData';
import './DesktopTopBar.css';

interface DesktopTopBarProps {
  currentTab: NavigationTab;
  onOpenCommandPalette: () => void;
  onQuickAdd: () => void;
  rightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  showRightPanelToggle: boolean;
  breadcrumbs?: { label: string; tab?: NavigationTab }[];
  onNavigate?: (tab: NavigationTab) => void;
  onOpenNote?: (id: string) => void;
  onOpenDoc?: (id: string) => void;
  tasks?: Task[];
  activities?: Activity[];
  notificationController?: UseNotificationsResult;
}

export const DesktopTopBar: React.FC<DesktopTopBarProps> = ({
  currentTab,
  onOpenCommandPalette,
  onQuickAdd,
  rightPanelOpen,
  onToggleRightPanel,
  showRightPanelToggle,
  breadcrumbs,
  onNavigate = () => {},
  onOpenNote,
  onOpenDoc,
  tasks = [],
  activities = [],
  notificationController,
}) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const bellBtnRef = useRef<HTMLButtonElement>(null);

  // Use controller from parent if provided (single source of truth), or local hook
  const localNotifications = useNotifications(tasks, activities);
  const notifState = notificationController || localNotifications;
  const { notifications, unreadCount, markAllAsRead, markAsRead, dismiss } = notifState;

  const getPageTitle = () => {
    switch (currentTab) {
      case 'home':
        return 'Home';
      case 'knowledge':
        return 'Knowledge Base';
      case 'tasks':
        return 'Tasks';
      case 'projects':
        return 'Projects';
      case 'ai':
        return 'Workspace AI';
      case 'settings':
        return 'Settings';
      case 'note-editor':
        return 'Note Editor';
      case 'doc-viewer':
        return 'Document Preview';
      case 'project-detail':
        return 'Project Workspace';
      default:
        return 'Workspace';
    }
  };

  const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  return (
    <header className="desktop-topbar">
      {/* Left: Breadcrumbs / Title */}
      <div className="topbar-left">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="topbar-breadcrumbs" aria-label="Breadcrumbs">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <ChevronRight size={14} className="breadcrumb-separator" />}
                <span className={`breadcrumb-item ${idx === breadcrumbs.length - 1 ? 'active' : ''}`}>
                  {crumb.label}
                </span>
              </React.Fragment>
            ))}
          </nav>
        ) : (
          <h1 className="topbar-title">{getPageTitle()}</h1>
        )}
      </div>

      {/* Center: Universal Search */}
      <div className="topbar-center">
        <button 
          className="topbar-search-trigger"
          onClick={onOpenCommandPalette}
          title="Search workspace or run action"
        >
          <Search size={15} className="search-icon" />
          <span className="search-placeholder">Search your workspace...</span>
          <kbd className="search-kbd">{isMac ? '⌘K' : 'Ctrl+K'}</kbd>
        </button>
      </div>

      {/* Right: Actions */}
      <div className="topbar-right" style={{ position: 'relative' }}>
        <button 
          ref={bellBtnRef}
          className={`btn-icon topbar-action-btn notif-bell-btn ${notifOpen ? 'active' : ''}`}
          onClick={() => setNotifOpen(prev => !prev)}
          title={`Notifications (${unreadCount} unread)`}
          aria-label={`Notifications, ${unreadCount} unread`}
          aria-expanded={notifOpen}
          aria-haspopup="dialog"
          id="notification-bell-btn"
        >
          <NotificationBellIcon size={18} />
          {unreadCount > 0 && (
            <span className="notification-badge" aria-hidden="true">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Real Notification Popover */}
        <NotificationPopover
          isOpen={notifOpen}
          onClose={() => setNotifOpen(false)}
          triggerRef={bellBtnRef}
          notifications={notifications}
          onMarkAllAsRead={markAllAsRead}
          onMarkAsRead={markAsRead}
          onDismiss={dismiss}
          onNavigate={onNavigate}
          onOpenNote={onOpenNote}
          onOpenDoc={onOpenDoc}
        />

        <button 
          className="btn-icon topbar-action-btn"
          style={{ display: 'none' }}
          aria-hidden="true"
        />

        <button 
          className="btn btn-primary btn-sm topbar-create-btn"
          onClick={onQuickAdd}
          title="Quick add item"
        >
          <Plus size={15} />
          <span>New</span>
        </button>

        {showRightPanelToggle && (
          <button 
            className={`btn-icon topbar-action-btn ${rightPanelOpen ? 'active' : ''}`}
            onClick={onToggleRightPanel}
            title={rightPanelOpen ? "Close AI context panel" : "Open AI context panel"}
            aria-label="Toggle Context Panel"
          >
            <PanelRight size={17} />
          </button>
        )}
      </div>
    </header>
  );
};
