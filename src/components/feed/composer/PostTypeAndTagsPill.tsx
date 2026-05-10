import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { POST_TYPE_OPTIONS, getPostTypeColors, type DatabasePostType } from '@/components/feed/utils/postUtils';

interface PostTypeAndTagsPillProps {
  postType: DatabasePostType;
  onOpen: () => void;
}

/**
 * "Mode pill" showing the current post type, color-coded by type.
 * Soft tinted background — visually lighter than EntityHeroPill,
 * color signals identity while size keeps hierarchy.
 */
export const PostTypeAndTagsPill: React.FC<PostTypeAndTagsPillProps> = ({
  postType,
  onOpen,
}) => {
  const label =
    POST_TYPE_OPTIONS.find((o) => o.value === postType)?.label ?? 'Experience';
  const colors = getPostTypeColors(postType);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Post type: ${label}. Click to change.`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border h-8 px-3 text-sm font-medium transition-colors',
        colors.pill
      )}
    >
      <span>{label}</span>
      <ChevronDown className="h-3.5 w-3.5 opacity-70" />
    </button>
  );
};
