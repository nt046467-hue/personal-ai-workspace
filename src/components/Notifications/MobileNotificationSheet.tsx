import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bell, CheckCheck, X, ArrowRight } from 'lucide-react';
import type { NavigationTab } from '../AppShell/DesktopSidebar';
import { NotificationRow } from './NotificationRow';
import type { NotificationItem } from '../../hooks/useNotifications';
import './MobileNotificationSheet.css';

interface MobileNotificationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllAsRead: () => void;
  onMarkAsRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onNavigate: (tab: NavigationTab) => void;
  onOpenNote?: (id: string) => void;
  onOpenDoc?: (id: string) => void;
}

export const MobileNotificationSheet: React.FC<MobileNotificationSheetProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllAsRead,
  onMarkAsRead,
  onDismiss,
  onNavigate,
  onOpenNote,
  onOpenDoc,
}) => {
  const touchStartYRef = useRef<number | null>(null);
  const touchCurrentYRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Prevent body scroll behind open modal on mobile
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

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

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchCurrentYRef.current = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    if (touchStartYRef.current !== null && touchCurrentYRef.current !== null) {
      const deltaY = touchCurrentYRef.current - touchStartYRef.current;
      // If pulled down by more than 60px, dismiss the sheet
      if (deltaY > 60) {
        onClose();
      }
    }
    touchStartYRef.current = null;
    touchCurrentYRef.current = null;
  };

  return createPortal(
    <div className="mobile-notif-overlay" onClick={onClose}>
      <div
        className="mobile-notif-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile notifications"
      >
        {/* Swipe drag handle */}
        <div
          className="mobile-notif-handle-bar"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          aria-hidden="true"
        >
          <div className="mobile-notif-handle" />
        </div>

        {/* Sheet Header */}
        <div
          className="mobile-notif-header"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="mobile-notif-header-left">
            <h2 className="mobile-notif-title">Notifications</h2>
            {unreadCount > 0 && (
              <span className="mobile-notif-unread-badge">
                {unreadCount} new
              </span>
            )}
          </div>

          <div className="mobile-notif-header-actions">
            {unreadCount > 0 && (
              <button
                className="mobile-notif-mark-all-btn"
                onClick={onMarkAllAsRead}
                aria-label="Mark all notifications as read"
              >
                <CheckCheck size={14} style={{ marginRight: 4 }} />
                <span>Mark all read</span>
              </button>
            )}
            <button
              className="btn-icon mobile-notif-close-btn"
              onClick={onClose}
              aria-label="Close notifications"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="mobile-notif-list-container">
          {notifications.length === 0 ? (
            <div className="mobile-notif-empty-state">
              <Bell size={28} className="empty-bell-icon" />
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

        {/* Sheet Footer */}
        <div className="mobile-notif-footer">
          <button
            className="mobile-notif-view-all-link"
            onClick={() => {
              onNavigate('home');
              onClose();
            }}
          >
            <span>View workspace command center</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
