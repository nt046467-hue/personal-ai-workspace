import assert from 'node:assert';
import test from 'node:test';
import { parseTaskDueDate, parseActivityTimestamp } from '../../src/hooks/useNotifications';
import type { Task, Activity } from '../../src/data/mockData';

test('Notifications - parseTaskDueDate handles various formats', () => {
  const fixedNow = new Date('2026-09-22T15:00:00.000Z');

  // "Today, 5:00 PM"
  const today5pm = parseTaskDueDate('Today, 5:00 PM', fixedNow);
  assert.ok(today5pm !== null);
  assert.strictEqual(today5pm.getHours(), 17);
  assert.strictEqual(today5pm.getMinutes(), 0);

  // "Today" without time -> end of day
  const todayEndOfDay = parseTaskDueDate('Today', fixedNow);
  assert.ok(todayEndOfDay !== null);
  assert.strictEqual(todayEndOfDay.getHours(), 23);
  assert.strictEqual(todayEndOfDay.getMinutes(), 59);

  // "Yesterday" -> 1 day earlier
  const yesterday = parseTaskDueDate('Yesterday', fixedNow);
  assert.ok(yesterday !== null);
  assert.strictEqual(yesterday.getDate(), fixedNow.getDate() - 1);

  // "Yesterday, 3:00 PM"
  const yesterday3pm = parseTaskDueDate('Yesterday, 3:00 PM', fixedNow);
  assert.ok(yesterday3pm !== null);
  assert.strictEqual(yesterday3pm.getDate(), fixedNow.getDate() - 1);
  assert.strictEqual(yesterday3pm.getHours(), 15);

  // "Tomorrow" -> 1 day later
  const tomorrow = parseTaskDueDate('Tomorrow', fixedNow);
  assert.ok(tomorrow !== null);
  assert.strictEqual(tomorrow.getDate(), fixedNow.getDate() + 1);

  // "In 2 days"
  const in2Days = parseTaskDueDate('In 2 days', fixedNow);
  assert.ok(in2Days !== null);
  assert.strictEqual(in2Days.getDate(), fixedNow.getDate() + 2);

  // ISO string
  const iso = parseTaskDueDate('2026-09-18T10:00:00Z', fixedNow);
  assert.ok(iso !== null);
  assert.strictEqual(iso.toISOString(), '2026-09-18T10:00:00.000Z');

  // Undefined or empty
  assert.strictEqual(parseTaskDueDate(undefined), null);
  assert.strictEqual(parseTaskDueDate(''), null);
});

test('Notifications - parseActivityTimestamp handles relative and real timestamps', () => {
  const fixedNow = new Date('2026-09-22T15:00:00.000Z');

  // Real createdAt on activity
  const actWithCreatedAt: Activity = {
    id: '1',
    title: 'Test',
    detail: 'Detail',
    timestamp: '2 hours ago',
    type: 'task',
    createdAt: '2026-09-22T13:00:00.000Z',
  } as any;
  const parsedReal = parseActivityTimestamp(actWithCreatedAt, fixedNow);
  assert.strictEqual(parsedReal, new Date('2026-09-22T13:00:00.000Z').getTime());

  // Relative "2 hours ago"
  const actRelative2h: Activity = {
    id: '2',
    title: 'Test',
    detail: 'Detail',
    timestamp: '2 hours ago',
    type: 'document',
  };
  const parsed2h = parseActivityTimestamp(actRelative2h, fixedNow);
  assert.strictEqual(parsed2h, fixedNow.getTime() - 2 * 60 * 60 * 1000);

  // Relative "15m ago"
  const actRelative15m: Activity = {
    id: '3',
    title: 'Test',
    detail: 'Detail',
    timestamp: '15m ago',
    type: 'task',
  };
  const parsed15m = parseActivityTimestamp(actRelative15m, fixedNow);
  assert.strictEqual(parsed15m, fixedNow.getTime() - 15 * 60 * 1000);

  // "Yesterday"
  const actYesterday: Activity = {
    id: '4',
    title: 'Test',
    detail: 'Detail',
    timestamp: 'Yesterday',
    type: 'project',
  };
  const parsedYesterday = parseActivityTimestamp(actYesterday, fixedNow);
  assert.strictEqual(parsedYesterday, fixedNow.getTime() - 24 * 60 * 60 * 1000);
});

test('Notifications - Unified feed sorting: Overdue first (oldest due first), then due-today, then recency', () => {
  // Test time: 2026-09-22 at 20:00 (8:00 PM) local time
  const now = new Date(2026, 8, 22, 20, 0, 0);

  const mockTasks: Task[] = [
    {
      id: 'task-completed',
      title: 'Should be ignored because completed',
      project: 'P1',
      projectId: 'p-1',
      dueDate: 'Yesterday',
      dueCategory: 'today',
      priority: 'high',
      completed: true,
    },
    {
      id: 'task-overdue-yesterday',
      title: 'Fix server bug',
      project: 'P1',
      projectId: 'p-1',
      dueDate: 'Yesterday',
      dueCategory: 'today',
      priority: 'medium',
      completed: false,
    },
    {
      id: 'task-overdue-older',
      title: 'Renew domain registration',
      project: 'P1',
      projectId: 'p-1',
      dueDate: 'Sep 18, 2026',
      dueCategory: 'upcoming',
      priority: 'medium',
      completed: false,
    },
    {
      id: 'task-due-today-later',
      title: 'Prepare slides',
      project: 'P1',
      projectId: 'p-1',
      dueDate: 'Today, 9:00 PM', // 9:00 PM is after 8:00 PM -> due today
      dueCategory: 'today',
      priority: 'medium',
      completed: false,
    },
    {
      id: 'task-high-priority',
      title: 'Security review',
      project: 'P1',
      projectId: 'p-1',
      dueDate: 'Tomorrow',
      dueCategory: 'tomorrow',
      priority: 'high',
      completed: false,
    },
  ];

  const mockActivities: Activity[] = [
    {
      id: 'act-recent',
      title: 'Deployed v2.1',
      detail: 'Release notes available',
      timestamp: '15m ago',
      type: 'document',
    },
    {
      id: 'act-older',
      title: 'Uploaded spec',
      detail: 'Architecture diagram',
      timestamp: '3 hours ago',
      type: 'document',
    },
  ];

  // Helper recreating the exact merging & sorting from useNotifications hook
  interface InternalItem {
    id: string;
    title: string;
    description: string;
    time: string;
    type: string;
    urgency: string;
    urgencyRank: number;
    sortTimestamp: number;
  }

  const merged: InternalItem[] = [];

  mockTasks.forEach(t => {
    if (t.completed) return;
    const parsedDueDate = parseTaskDueDate(t.dueDate, now);
    const isPastDueDate = parsedDueDate ? parsedDueDate.getTime() < now.getTime() : false;
    const isExplicitOverdue = (t.dueCategory as string) === 'overdue' || (t.dueDate || '').toLowerCase().includes('yesterday');
    const isOverdue = isPastDueDate || isExplicitOverdue;

    let urgency = 'normal';
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
    }

    const sortTimestamp = parsedDueDate ? parsedDueDate.getTime() : (urgencyRank <= 1 ? now.getTime() : 0);

    merged.push({
      id: `notif-task-${t.id}`,
      title,
      description: t.title,
      time: t.dueDate,
      type: 'task',
      urgency,
      urgencyRank,
      sortTimestamp,
    });
  });

  mockActivities.forEach(act => {
    const activityTime = parseActivityTimestamp(act, now);
    merged.push({
      id: `notif-act-${act.id}`,
      title: act.title,
      description: act.detail,
      time: act.timestamp,
      type: act.type,
      urgency: 'normal',
      urgencyRank: 3,
      sortTimestamp: activityTime,
    });
  });

  merged.sort((a, b) => {
    if (a.urgencyRank !== b.urgencyRank) {
      return a.urgencyRank - b.urgencyRank;
    }
    if (a.urgencyRank === 0) {
      return a.sortTimestamp - b.sortTimestamp; // oldest overdue first
    }
    if (a.urgencyRank === 1 || a.urgencyRank === 2) {
      return a.sortTimestamp - b.sortTimestamp; // soonest first
    }
    return b.sortTimestamp - a.sortTimestamp; // most recent first
  });

  const finalNotifs = merged.slice(0, 8);

  // Verification 1: Completed task is excluded
  assert.ok(!finalNotifs.some(n => n.id.includes('completed')));

  // Verification 2: Overdue tasks are at the very top (rank 0)
  assert.strictEqual(finalNotifs[0].urgency, 'overdue');
  assert.strictEqual(finalNotifs[1].urgency, 'overdue');

  // Verification 3: Within overdue, oldest due date first (Sep 18 is older than Yesterday)
  assert.strictEqual(finalNotifs[0].id, 'notif-task-task-overdue-older');
  assert.strictEqual(finalNotifs[1].id, 'notif-task-task-overdue-yesterday');

  // Verification 4: Due today task is ranked next (rank 1)
  assert.strictEqual(finalNotifs[2].id, 'notif-task-task-due-today-later');
  assert.strictEqual(finalNotifs[2].urgency, 'today');
  assert.strictEqual(finalNotifs[2].title, 'Task due today');

  // Verification 5: High priority task is next (rank 2)
  assert.strictEqual(finalNotifs[3].id, 'notif-task-task-high-priority');
  assert.strictEqual(finalNotifs[3].urgency, 'high');

  // Verification 6: Normal items (activities) are ordered by recency (15m ago before 3 hours ago)
  assert.strictEqual(finalNotifs[4].id, 'notif-act-act-recent');
  assert.strictEqual(finalNotifs[5].id, 'notif-act-act-older');
});
