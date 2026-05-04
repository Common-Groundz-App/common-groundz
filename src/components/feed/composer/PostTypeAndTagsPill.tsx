import React from 'react';
import { Plus } from 'lucide-react';
import { POST_TYPE_OPTIONS, type UIPostType } from '@/components/feed/utils/postUtils';

interface PostTypeAndTagsPillProps {
  postType: UIPostType;
  onOpen: () => void;
}

/**
 * Single pill showing the current post type.
 * Opens the PostType modal on click.
 */
export const PostTypeAndTagsPill: React.FC<PostTypeAndTagsPillProps> = ({
  postType,
  onOpen,
}) => {
  const typeLabel =
    postType === 'story'
      ? null
      : POST_TYPE_OPTIONS.find((o) => o.value === postType)?.label ?? null;

  const label = typeLabel || 'Post type';

  return (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background hover:bg-accent/40 px-3 py-1.5 text-xs text-foreground transition-colors"
    >
      <Plus className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
};
