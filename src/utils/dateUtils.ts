
import { format, differenceInDays, formatDistanceToNowStrict } from 'date-fns';

/**
 * Format a date with relative time for recent dates:
 * - "Today" if the date is today
 * - "Yesterday" if the date is yesterday
 * - "X days ago" if the date is less than 7 days ago
 * - "MMM d, yyyy" format for dates older than 7 days
 */
export const formatDateLong = (dateString: string | Date): string => {
  return format(new Date(dateString), 'MMM d, yyyy');
};

export const formatRelativeDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  
  // Reset time portion to compare just the dates
  const dateWithoutTime = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const nowWithoutTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Calculate days difference between the dates
  const diffInDays = differenceInDays(nowWithoutTime, dateWithoutTime);
  
  if (diffInDays === 0) {
    return 'Today';
  } else if (diffInDays === 1) {
    return 'Yesterday';
  } else if (diffInDays < 7) {
    return `${diffInDays} days ago`;
  } else {
    return format(date, 'MMM d, yyyy');
  }
};

/**
 * Compact timestamp for notification rows.
 * - invalid date -> '' (render nothing rather than "Invalid Date")
 * - future dates (clock skew) -> 'Just now'
 * - < 60s -> 'Just now'
 * - < 24h (rolling) -> '3 minutes ago', '2 hours ago'
 * - >= 24h -> delegates to formatRelativeDate ('Yesterday', '5 days ago', 'Jun 28, 2026')
 */
export const formatNotificationTime = (dateString: string | Date): string => {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return 'Just now';
  if (diffMs < 86_400_000) return formatDistanceToNowStrict(date, { addSuffix: true });

  return formatRelativeDate(typeof dateString === 'string' ? dateString : date.toISOString());
};
