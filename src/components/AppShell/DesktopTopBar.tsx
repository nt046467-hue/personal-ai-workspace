import React, { useState, useRef, useMemo } from 'react';
import { Search, Plus, PanelRight, ChevronRight } from 'lucide-react';
import type { NavigationTab } from './DesktopSidebar';
import { NotificationPopover } from '../Notifications/NotificationPopover';
import type { NotificationItem } from '../Notifications/NotificationPopover';
import type { Task, Activity } from '../../data/mockData';
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
  tasks?: Task[];
  activities?: Activity[];
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
}) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const bellBtnRef = useRef<HTMLButtonElement>(null);

  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('myspace_read_notifs');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('myspace_dismissed_notifs');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Synthesize real notifications from active tasks and workspace activities
  const notifications: NotificationItem[] = useMemo(() => {
    const list: NotificationItem[] = [];

    // 1. Task notifications for high priority or due today
    tasks
      .filter(t => !t.completed && (t.dueCategory === 'today' || t.priority === 'high'))
      .slice(0, 4)
      .forEach(t => {
        const id = `notif-task-${t.id}`;
        if (!dismissedIds.has(id)) {
          list.push({
            id,
            title: t.dueCategory === 'today' ? 'Task due today' : 'High priority task',
            description: t.title,
            time: t.dueDate || 'Today',
            type: 'task',
            read: readIds.has(id),
            targetTab: 'tasks',
          });
        }
      });

    // 2. Real activity notifications
    activities.slice(0, 4).forEach(act => {
      const id = `notif-act-${act.id}`;
      if (!dismissedIds.has(id)) {
        list.push({
          id,
          title: act.title,
          description: act.detail || '',
          time: act.timestamp,
          type: act.type === 'task' ? 'task' : act.type === 'document' ? 'document' : 'note',
          read: readIds.has(id),
          targetTab: act.type === 'task' ? 'tasks' : 'knowledge',
        });
      }
    });

    return list;
  }, [tasks, activities, readIds, dismissedIds]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllAsRead = () => {
    const allIds = new Set([...readIds, ...notifications.map(n => n.id)]);
    setReadIds(allIds);
    try {
      localStorage.setItem('myspace_read_notifs', JSON.stringify(Array.from(allIds)));
    } catch {}
  };

  const handleMarkAsRead = (id: string) => {
    const updated = new Set(readIds);
    updated.add(id);
    setReadIds(updated);
    try {
      localStorage.setItem('myspace_read_notifs', JSON.stringify(Array.from(updated)));
    } catch {}
  };

  const handleDismissNotif = (id: string) => {
    const updated = new Set(dismissedIds);
    updated.add(id);
    setDismissedIds(updated);
    try {
      localStorage.setItem('myspace_dismissed_notifs', JSON.stringify(Array.from(updated)));
    } catch {}
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
