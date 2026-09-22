import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  Bell, 
  CheckCheck, 
  ArrowRight
} from 'lucide-react';
import type { NavigationTab } from '../AppShell/DesktopSidebar';
import { NotificationRow } from './NotificationRow';
import type { NotificationItem } from '../../hooks/useNotifications';
import './NotificationPopover.css';

export type { NotificationItem };

interface NotificationPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  /** Ref to the trigger button — excluded from outside-click so toggle works correctly */
  triggerRef?: React.RefObject<HTMLElement | null>;
  notifications: NotificationItem[];
  onMarkAllAsRead: () => void;
  onMarkAsRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onNavigate: (tab: NavigationTab) => void;
  onOpenNote?: (id: string) => void;
  onOpenDoc?: (id: string) => void;
}

export const NotificationPopover: React.FC<NotificationPopoverProps> = ({
  isOpen,
  onClose,
  triggerRef,
  notifications,
  onMarkAllAsRead,
  onMarkAsRead,
  onDismiss,
  onNavigate,
  onOpenNote,
  onOpenDoc,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

  const updateCoords = useCallback(() => {
    if (!triggerRef?.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const top = rect.bottom + 8;
    const popoverWidth = Math.min(400, window.innerWidth - 24);
    const rawRight = window.innerWidth - rect.right;
    const right = Math.max(12, Math.min(rawRight, window.innerWidth - popoverWidth - 12));
    setCoords({ top, right });
  }, [triggerRef]);

  useEffect(() => {
    if (!isOpen) return;
    updateCoords();

    const handleClickOutside = (e: MouseEvent) => {
      // Exclude the trigger button — its own onClick handles the toggle
      if (triggerRef?.current?.contains(e.target as Node)) return;
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        triggerRef?.current?.focus();
      }
    };

    window.addEventListener('resize', updateCoords);
    window.addEventListener('scroll', updateCoords, true);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, triggerRef, updateCoords]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleItemClick = (item: NotificationItem) => {
    onMarkAsRead(item.id);
    if (item.type === 'note' && item.targetId && onOpenNote) {
      onOpenNote(item.targetId);
    } else if (item.type === 'document' && item.targetId && onOpenDoc) {
      onOpenDoc(item.targetId);
    } else if (item.targetTab) {
      onNavigate(item.targetTab);
    }
    onClose();
  };

  return createPortal(
    <div 
      className="notification-popover-card" 
      ref={popoverRef} 
      role="dialog" 
      aria-label="Notifications"
      style={{
        top: `${coords.top}px`,
        right: `${coords.right}px`,
      }}
    >
      {/* Popover Header */}
      <div className="notif-header">
        <div className="notif-header-title-row">
          <span className="notif-heading">Notifications</span>
          {unreadCount > 0 && <span className="notif-unread-badge">{unreadCount} new</span>}
        </div>
        {unreadCount > 0 && (
          <button className="notif-action-text-btn" onClick={onMarkAllAsRead}>
            <CheckCheck size={13} style={{ marginRight: 4 }} />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="notif-list-container">
        {notifications.length === 0 ? (
          <div className="notif-empty-state">
            <Bell size={24} className="empty-bell-icon" />
            <span className="empty-bell-text">All caught up!</span>
            <span className="empty-bell-sub">No pending alerts or notifications.</span>
          </div>
        ) : (
          notifications.map((item) => (
            <NotificationRow
              key={item.id}
              item={item}
              onClick={handleItemClick}
              onDismiss={onDismiss}
            />
          ))
        )}
      </div>

      {/* Popover Footer */}
      <div className="notif-footer">
        <button
          className="notif-view-all-link"
          onClick={() => {
            onNavigate('home');
            onClose();
          }}
        >
          <span>View workspace command center</span>
          <ArrowRight size={12} />
        </button>
      </div>
    </div>,
    document.body
  );
};
