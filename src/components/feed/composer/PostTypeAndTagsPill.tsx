import React from 'react';
import { Plus, Hash } from 'lucide-react';
import { POST_TYPE_OPTIONS, type UIPostType } from '@/components/feed/utils/postUtils';

interface PostTypeAndTagsPillProps {
  postType: UIPostType;
  tagCount: number;
  onOpen: () => void;
}

/**
 * Single pill replacing the always-visible 6-chip post-type row.
 * Label reflects current state so users know what's selected without opening.
 */
export const PostTypeAndTagsPill: React.FC<PostTypeAndTagsPillProps> = ({
  postType,
  tagCount,
  onOpen,
}) => {
  const typeLabel =
    postType === 'story'
      ? null
      : POST_TYPE_OPTIONS.find((o) => o.value === postType)?.label ?? null;

  const parts: string[] = [];
  if (typeLabel) parts.push(typeLabel);
  if (tagCount > 0) parts.push(`${tagCount} ${tagCount === 1 ? 'tag' : 'tags'}`);

  const label = parts.length > 0 ? parts.join(' · ') : 'Post type & tags';

  return (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background hover:bg-accent/40 px-3 py-1.5 text-xs text-foreground transition-colors"
    >
      {parts.length > 0 ? <Hash className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
      <span>{label}</span>
    </button>
  );
};
