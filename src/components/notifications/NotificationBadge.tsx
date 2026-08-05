import React from 'react';
import { cn } from '@/lib/utils';
import { formatUnreadBadge } from '@/utils/notificationBadge';

export type NotificationBadgeVariant = 'overlay' | 'inline';

interface NotificationBadgeProps {
  /** Unread count. `null`/`undefined` means "not resolved yet" and renders nothing. */
  count: number | null | undefined;
  /**
   * Styling only — never count semantics. Both variants use the same cap.
   * `overlay` positions itself over an icon; `inline` sits in normal flow.
   */
  variant?: NotificationBadgeVariant;
  className?: string;
}

const VARIANT_CLASSES: Record<NotificationBadgeVariant, string> = {
  overlay: 'absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]',
  inline: 'h-5 min-w-5 px-1.5 text-xs',
};

/**
 * Single renderer for every compact unread badge in the app.
 *
 * The visual text is aria-hidden; the surrounding control owns the descriptive
 * label so screen readers announce the count once.
 */
export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  count,
  variant = 'overlay',
  className,
}) => {
  const label = formatUnreadBadge(count);
  if (!label) return null;

  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-destructive font-medium leading-none text-destructive-foreground',
        VARIANT_CLASSES[variant],
        className,
      )}
    >
      {label}
    </span>
  );
};

export default NotificationBadge;
