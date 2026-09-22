import { useState, useMemo, useEffect, useCallback } from 'react';
import type { Task, Activity } from '../data/mockData';
import type { NavigationTab } from '../components/AppShell/DesktopSidebar';

export type UrgencyLevel = 'overdue' | 'today' | 'high' | 'normal';

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  type: 'task' | 'document' | 'note' | 'ai';
  read: boolean;
  targetId?: string;
  targetTab?: NavigationTab;
  urgency?: UrgencyLevel;
  sortTimestamp?: number;
}

export interface UseNotificationsResult {
  notifications: NotificationItem[];
  unreadCount: number;
  markAllAsRead: () => void;
  markAsRead: (id: string) => void;
  dismiss: (id: string) => void;
}

/**
 * Parses natural language or structured dueDate string into a JavaScript Date.
 * Handles formats like:
 * - "Today, 5:00 PM", "Today, 17:00", "Today"
 * - "Yesterday", "Yesterday, 3:00 PM"
 * - "Tomorrow", "Tomorrow, 9:00 AM"
 * - "In 2 days"
 * - "Sep 18", "Sep 18, 2026", ISO timestamps ("2026-09-18T10:00:00Z")
 */
export function parseTaskDueDate(dueDateStr?: string, refDate: Date = new Date()): Date | null {
  if (!dueDateStr) return null;
  const str = dueDateStr.trim();
  if (!str) return null;
  const lower = str.toLowerCase();

  // "Today" formats
  if (lower.startsWith('today')) {
    const timeMatch = lower.match(/today[,\s]+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    const d = new Date(refDate);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const meridiem = timeMatch[3]?.toLowerCase();
      if (meridiem === 'pm' && hours < 12) hours += 12;
      if (meridiem === 'am' && hours === 12) hours = 0;
      d.setHours(hours, minutes, 0, 0);
      return d;
    }
    // "Today" without specific time -> considered end of the current day
    d.setHours(23, 59, 59, 999);
    return d;
  }

  // "Yesterday" formats
  if (lower.startsWith('yesterday')) {
    const d = new Date(refDate);
    d.setDate(d.getDate() - 1);
    const timeMatch = lower.match(/yesterday[,\s]+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const meridiem = timeMatch[3]?.toLowerCase();
      if (meridiem === 'pm' && hours < 12) hours += 12;
      if (meridiem === 'am' && hours === 12) hours = 0;
      d.setHours(hours, minutes, 0, 0);
      return d;
    }
    d.setHours(23, 59, 59, 999);
    return d;
  }

  // "Tomorrow" formats
  if (lower.startsWith('tomorrow')) {
    const d = new Date(refDate);
    d.setDate(d.getDate() + 1);
    const timeMatch = lower.match(/tomorrow[,\s]+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const meridiem = timeMatch[3]?.toLowerCase();
      if (meridiem === 'pm' && hours < 12) hours += 12;
      if (meridiem === 'am' && hours === 12) hours = 0;
      d.setHours(hours, minutes, 0, 0);
      return d;
    }
    d.setHours(23, 59, 59, 999);
    return d;
  }

  // "In X days"
  const inDaysMatch = lower.match(/^in\s+(\d+)\s+days?/i);
  if (inDaysMatch) {
    const days = parseInt(inDaysMatch[1], 10);
    const d = new Date(refDate);
    d.setDate(d.getDate() + days);
    d.setHours(23, 59, 59, 999);
    return d;
  }

  // Check standard parseable dates (ISO or "Sep 18")
  let parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    return new Date(parsed);
  }

  // If no year present (e.g. "Sep 18"), try appending current reference year
  const withYear = `${str}, ${refDate.getFullYear()}`;
  parsed = Date.parse(withYear);
  if (!isNaN(parsed)) {
    return new Date(parsed);
  }

  return null;
}

/**
 * Parses activity timestamp (ISO string, relative string like "2 hours ago" or "Yesterday")
 * into a comparable millisecond epoch time.
 */
export function parseActivityTimestamp(act: Activity, refDate: Date = new Date()): number {
  const now = refDate.getTime();

  // 1. Prefer underlying real timestamp if exists (e.g. createdAt on Activity or DB record)
  const realCreatedAt = (act as any).createdAt || (act as any).created_at;
  if (realCreatedAt) {
    const parsed = Date.parse(String(realCreatedAt));
    if (!isNaN(parsed)) return parsed;
  }

  if (!act.timestamp) return now;

  const raw = act.timestamp.trim();
  const lower = raw.toLowerCase();

  // Try direct date parse
  const directParse = Date.parse(raw);
  if (!isNaN(directParse)) return directParse;

  // Relative units
  if (lower === 'just now') return now;

  const minMatch = lower.match(/^(\d+)\s*m(?:in(?:ute)?s?)?\s*ago$/i);
  if (minMatch) {
    return now - parseInt(minMatch[1], 10) * 60 * 1000;
  }

  const hourMatch = lower.match(/^(\d+)\s*h(?:our)?s?\s*ago$/i);
  if (hourMatch) {
    return now - parseInt(hourMatch[1], 10) * 60 * 60 * 1000;
  }

  if (lower === 'yesterday') {
    return now - 24 * 60 * 60 * 1000;
  }

  const dayMatch = lower.match(/^(\d+)\s*d(?:ay)?s?\s*ago$/i);
  if (dayMatch) {
    return now - parseInt(dayMatch[1], 10) * 24 * 60 * 60 * 1000;
  }

  const weekMatch = lower.match(/^(\d+)\s*w(?:eek)?s?\s*ago$/i);
  if (weekMatch) {
    return now - parseInt(weekMatch[1], 10) * 7 * 24 * 60 * 60 * 1000;
  }

  // Fallback to appended year parse or current time
  const withYear = `${raw}, ${refDate.getFullYear()}`;
  const parsedWithYear = Date.parse(withYear);
  if (!isNaN(parsedWithYear)) return parsedWithYear;

  return now;
}

const STORAGE_READ_KEY = 'myspace_read_notifs';
const STORAGE_DISMISSED_KEY = 'myspace_dismissed_notifs';

function getStoredSet(key: string): Set<string> {
  try {
    const stored = localStorage.getItem(key);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

export function useNotifications(
  tasks: Task[] = [],
  activities: Activity[] = [],
  referenceDate?: Date
): UseNotificationsResult {
  const [readIds, setReadIds] = useState<Set<string>>(() => getStoredSet(STORAGE_READ_KEY));
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => getStoredSet(STORAGE_DISMISSED_KEY));

  // Sync across tabs/windows or multi-instance triggers via window storage event
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_READ_KEY && e.newValue) {
        try {
          setReadIds(new Set(JSON.parse(e.newValue)));
        } catch {}
      } else if (e.key === STORAGE_DISMISSED_KEY && e.newValue) {
        try {
          setDismissedIds(new Set(JSON.parse(e.newValue)));
        } catch {}
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Build merged, urgency-and-recency-ordered notification feed
  const notifications: NotificationItem[] = useMemo(() => {
    const now = referenceDate || new Date();

    interface InternalItem extends NotificationItem {
      urgencyRank: number; // 0 = overdue, 1 = today, 2 = high, 3 = normal
      sortTimestamp: number;
    }

    const merged: InternalItem[] = [];

    // 1. Incomplete Tasks
    tasks.forEach(t => {
      if (t.completed) return;

      const id = `notif-task-${t.id}`;
      if (dismissedIds.has(id)) return;

      const parsedDueDate = parseTaskDueDate(t.dueDate, now);
      const isPastDueDate = parsedDueDate ? parsedDueDate.getTime() < now.getTime() : false;
      const isExplicitOverdue = (t.dueCategory as string) === 'overdue' || (t.dueDate || '').toLowerCase().includes('yesterday');
      const isOverdue = isPastDueDate || isExplicitOverdue;

      let urgency: UrgencyLevel = 'normal';
      let urgencyRank = 3;
      let title = 'Task';

      if (isOverdue) {
        urgency = 'overdue';
        urgencyRank = 0;
        title = 'Overdue';
      } else if (t.dueCategory === 'today') {
        urgency = 'today';
        urgencyRank = 1;
        title = 'Task due today';
      } else if (t.priority === 'high') {
        urgency = 'high';
        urgencyRank = 2;
        title = 'High priority task';
      } else {
        // Normal priority upcoming task
        urgency = 'normal';
        urgencyRank = 3;
        title = t.dueCategory === 'tomorrow' ? 'Task due tomorrow' : 'Task';
      }

      // Determine sorting timestamp:
      // For overdue / today / high / normal, use parsedDueDate timestamp when available
      const sortTimestamp = parsedDueDate ? parsedDueDate.getTime() : (urgencyRank <= 1 ? now.getTime() : 0);

      merged.push({
        id,
        title,
        description: t.title,
        time: t.dueDate || (isOverdue ? 'Overdue' : 'Today'),
        type: 'task',
        read: readIds.has(id),
        targetTab: 'tasks',
        urgency,
        urgencyRank,
        sortTimestamp,
      });
    });

    // 2. Real workspace activities
    activities.forEach(act => {
      const id = `notif-act-${act.id}`;
      if (dismissedIds.has(id)) return;

      const activityTime = parseActivityTimestamp(act, now);

      merged.push({
        id,
        title: act.title,
        description: act.detail || '',
        time: act.timestamp,
        type: act.type === 'task' ? 'task' : act.type === 'document' ? 'document' : 'note',
        read: readIds.has(id),
        targetTab: act.type === 'task' ? 'tasks' : 'knowledge',
        targetId: act.targetId,
        urgency: 'normal',
        urgencyRank: 3,
        sortTimestamp: activityTime,
      });
    });

    // 3. Sort merged list:
    // - Urgency rank ascending (overdue=0, today=1, high=2, normal=3)
    // - Overdue group (0): oldest due date first (ascending timestamp: smallest first)
    // - Due today group (1): soonest due time first (ascending timestamp)
    // - High priority group (2): soonest due time first (ascending timestamp)
    // - Normal group (3): activities + normal tasks sorted by most-recent timestamp first (descending timestamp: largest first)
    merged.sort((a, b) => {
      if (a.urgencyRank !== b.urgencyRank) {
        return a.urgencyRank - b.urgencyRank;
      }
      if (a.urgencyRank === 0) {
        return a.sortTimestamp - b.sortTimestamp;
      }
      if (a.urgencyRank === 1 || a.urgencyRank === 2) {
        return a.sortTimestamp - b.sortTimestamp;
      }
      // Normal rank: most recent first (descending)
      return b.sortTimestamp - a.sortTimestamp;
    });

    // 4. Apply cap of 8 items AFTER merging and sorting
    return merged.slice(0, 8).map(item => ({
      id: item.id,
      title: item.title,
      description: item.description,
      time: item.time,
      type: item.type,
      read: item.read,
      targetId: item.targetId,
      targetTab: item.targetTab,
      urgency: item.urgency,
      sortTimestamp: item.sortTimestamp,
    }));
  }, [tasks, activities, readIds, dismissedIds, referenceDate]);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  const markAllAsRead = useCallback(() => {
    setReadIds(prev => {
      const allIds = new Set([...prev, ...notifications.map(n => n.id)]);
      try {
        localStorage.setItem(STORAGE_READ_KEY, JSON.stringify(Array.from(allIds)));
      } catch {}
      return allIds;
    });
  }, [notifications]);

  const markAsRead = useCallback((id: string) => {
    setReadIds(prev => {
      const updated = new Set(prev);
      updated.add(id);
      try {
        localStorage.setItem(STORAGE_READ_KEY, JSON.stringify(Array.from(updated)));
      } catch {}
      return updated;
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setDismissedIds(prev => {
      const updated = new Set(prev);
      updated.add(id);
      try {
        localStorage.setItem(STORAGE_DISMISSED_KEY, JSON.stringify(Array.from(updated)));
      } catch {}
      return updated;
    });
  }, []);

  return {
    notifications,
    unreadCount,
    markAllAsRead,
    markAsRead,
    dismiss,
  };
}
