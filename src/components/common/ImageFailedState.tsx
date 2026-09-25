import React from 'react';
import { ImageOff, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Local, request-free picture state panel ("Image failed to load" / "No image provided"). */
interface ImageFailedStateProps {
  name?: string;
  className?: string;
  iconClassName?: string;
  variant?: 'failed' | 'missing';
  testId?: string;
}

export const ImageFailedState: React.FC<ImageFailedStateProps> = ({
  name,
  className = 'h-full w-full',
  iconClassName = 'h-5 w-5',
  variant = 'failed',
  testId = 'image-failed-state',
}) => {
  const text = variant === 'failed' ? 'Image failed to load' : 'No image provided';
  const Icon = variant === 'failed' ? ImageOff : ImageIcon;
  return (
    <span
      role="img"
      aria-label={name ? `${text} for ${name}` : text}
      className={cn(className, 'flex items-center justify-center bg-muted text-muted-foreground')}
      data-testid={testId}
    >
      <Icon className={iconClassName} aria-hidden="true" />
      <span className="sr-only">{text}</span>
    </span>
  );
};
