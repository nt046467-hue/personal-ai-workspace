/**
 * Date and relative time formatting utilities.
 * Accurately parses SQLite UTC DATETIME/CURRENT_TIMESTAMP values across timezones.
 */

export function parseSqliteUtc(dateInput: any): Date {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return dateInput;
  if (typeof dateInput === 'number') return new Date(dateInput);

  const str = String(dateInput).trim();
  if (!str) return new Date();

  // SQLite standard format: "YYYY-MM-DD HH:MM:SS" -> treat explicitly as UTC
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(str)) {
    return new Date(str.replace(' ', 'T') + 'Z');
  }

  // ISO format without Z or timezone offset
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(str)) {
    return new Date(str + 'Z');
  }

  return new Date(str);
}

export function formatRelativeTime(dateInput: any): string {
  const date = parseSqliteUtc(dateInput);
  const now = Date.now();
  const diffMs = now - date.getTime();

  // Less than 45 seconds or slight clock difference
  if (diffMs < 45 * 1000) {
    return 'Just now';
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) {
    return 'Just now';
  }
  if (diffMinutes === 1) {
    return '1m ago';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  if (diffHours === 1) {
    return '1 hour ago';
  }
  if (diffHours < 24) {
    return `${diffHours} hours ago`;
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}
