
import { format, differenceInDays } from 'date-fns';

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
