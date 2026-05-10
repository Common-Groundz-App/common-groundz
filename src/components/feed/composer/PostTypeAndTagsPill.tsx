import React from 'react';
import { ChevronDown } from 'lucide-react';
import { POST_TYPE_OPTIONS, type DatabasePostType } from '@/components/feed/utils/postUtils';

interface PostTypeAndTagsPillProps {
  postType: DatabasePostType;
  onOpen: () => void;
}

/**
 * Quiet "mode pill" showing the current post type.
 * Always shows the selected type label with a trailing chevron.
 * Visually lighter than EntityHeroPill — neutral, no orange tint.
 */
export const PostTypeAndTagsPill: React.FC<PostTypeAndTagsPillProps> = ({
  postType,
  onOpen,
}) => {
  const label =
    POST_TYPE_OPTIONS.find((o) => o.value === postType)?.label ?? 'Experience';

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Post type: ${label}. Click to change.`}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background hover:bg-accent/40 h-8 px-3 text-sm font-medium text-foreground transition-colors"
    >
      <span>{label}</span>
      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  );
};
