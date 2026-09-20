import React, { useState, useRef } from 'react';
import { Search, Plus, PanelRight, ChevronRight } from 'lucide-react';
import type { NavigationTab } from './DesktopSidebar';
import { NotificationPopover } from '../Notifications/NotificationPopover';
import type { NotificationItem } from '../Notifications/NotificationPopover';
import './DesktopTopBar.css';

/** Premium custom notification bell SVG — real product-quality icon */
const NotificationBellIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    {/* Bell body */}
    <path
      d="M12 3C8.686 3 6 5.686 6 9v5l-1.5 2.5A.75.75 0 005.25 18H18.75a.75.75 0 00.65-1.125L18 14V9c0-3.314-2.686-6-6-6z"
      fill="currentColor"
      fillOpacity="0.15"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Clapper */}
    <path
      d="M10 18a2 2 0 104 0"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    {/* Subtle rim line at top of bell body */}
    <path
      d="M12 3v0"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

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
}) => {
  const [notifOpen, setNotifOpen] = useState(false);
  // triggerRef lets the popover's outside-click handler exclude the bell button,
  // preventing the race where outside-click closes before the toggle fires.
  const bellBtnRef = useRef<HTMLButtonElement>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'notif-1',
      title: 'Task due today at 5:00 PM',
      description: 'Audit Firestore security rules for per-user tenant isolation',
      time: 'Due in 2h',
      type: 'task',
      read: false,
      targetTab: 'tasks',
    },
    {
      id: 'notif-2',
      title: 'Document vector indexing ready',
      description: 'Distributed Event-Driven Architecture Spec.pdf (18 pages indexed)',
      time: '1h ago',
      type: 'document',
      read: false,
      targetId: 'k-2',
      targetTab: 'doc-viewer',
    },
    {
      id: 'notif-3',
      title: 'Firebase security rules note updated',
      description: 'Partition schemas & custom JWT claim invariants verified',
      time: '3h ago',
      type: 'note',
      read: true,
      targetId: 'k-1',
      targetTab: 'note-editor',
    },
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleDismissNotif = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

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
          onMarkAllAsRead={handleMarkAllAsRead}
          onMarkAsRead={handleMarkAsRead}
          onDismiss={handleDismissNotif}
          onNavigate={onNavigate}
          onOpenNote={onOpenNote}
          onOpenDoc={onOpenDoc}
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
