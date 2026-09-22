import React from 'react';
import { 
  FileText, 
  CheckSquare, 
  Cpu, 
  X,
  AlertCircle
} from 'lucide-react';
import type { NotificationItem } from '../../hooks/useNotifications';

export interface NotificationRowProps {
  item: NotificationItem;
  onClick: (item: NotificationItem) => void;
  onDismiss: (id: string) => void;
}

export const NotificationRow: React.FC<NotificationRowProps> = ({
  item,
  onClick,
  onDismiss,
}) => {
  const isOverdue = item.urgency === 'overdue';

  const getNotificationIcon = () => {
    if (isOverdue) {
      return <AlertCircle size={16} className="notif-icon-overdue" />;
    }
    switch (item.type) {
      case 'task':
        return <CheckSquare size={16} className="notif-icon-task" />;
      case 'document':
        return <FileText size={16} className="notif-icon-doc" />;
      case 'note':
        return <FileText size={16} className="notif-icon-note" />;
      case 'ai':
        return <Cpu size={15} className="notif-icon-ai" />;
    }
  };

  return (
    <div
      className={`notif-row-item ${item.read ? 'read' : 'unread'} ${isOverdue ? 'urgency-overdue' : ''}`}
      onClick={() => onClick(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(item);
        }
      }}
    >
      <div className={`notif-icon-wrapper ${isOverdue ? 'is-overdue' : ''}`}>
        {getNotificationIcon()}
        {!item.read && <span className={`notif-unread-dot ${isOverdue ? 'is-overdue' : ''}`} />}
      </div>

      <div className="notif-content-block">
        <div className="notif-title-row">
          <span className={`notif-item-title ${isOverdue ? 'is-overdue' : ''}`}>{item.title}</span>
          {isOverdue && <span className="notif-overdue-pill">Overdue</span>}
        </div>
        <p className="notif-item-desc">{item.description}</p>
        <span className="notif-item-time">{item.time}</span>
      </div>

      <button
        className="btn-icon notif-dismiss-btn"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(item.id);
        }}
        title="Dismiss"
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  );
};
