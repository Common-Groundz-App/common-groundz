import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { POST_TYPE_OPTIONS, type UIPostType } from '@/components/feed/utils/postUtils';

interface PostTypeAndTagsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postType: UIPostType;
  setPostType: (next: UIPostType) => void;
  detectedHashtags: string[];
  suggestedHashtags: string[];
  onSuggestedHashtagClick: (tag: string) => void;
}

/**
 * Two-section modal:
 *  1. Post Type — same 6 chips, same toggle behavior
 *  2. Tags — read-only detected + clickable suggested
 *
 * Note: tags also remain visible inline on the page surface; the modal
 * is an additional editing affordance, not the only entry point.
 */
export const PostTypeAndTagsModal: React.FC<PostTypeAndTagsModalProps> = ({
  open,
  onOpenChange,
  postType,
  setPostType,
  detectedHashtags,
  suggestedHashtags,
  onSuggestedHashtagClick,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Post type & tags</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Post type */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Post type</p>
            <div className="flex flex-wrap gap-1.5">
              {POST_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setPostType(postType === option.value ? 'story' : option.value);
                  }}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs border transition-colors',
                    postType === option.value
                      ? 'bg-brand-orange text-white border-brand-orange'
                      : 'border-input text-muted-foreground hover:text-foreground hover:border-foreground/30'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Tags</p>

            {detectedHashtags.length === 0 && suggestedHashtags.length === 0 ? (
              <p className="text-xs text-muted-foreground/70">
                Add hashtags by typing #tag in your title or body.
              </p>
            ) : (
              <div className="space-y-3">
                {detectedHashtags.length > 0 && (
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70 mb-1.5">
                      In your post
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {detectedHashtags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="font-normal">
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {suggestedHashtags.length > 0 && (
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70 mb-1.5">
                      Suggested
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestedHashtags.map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          onClick={() => onSuggestedHashtagClick(tag)}
                          className="cursor-pointer hover:bg-accent gap-1 font-normal"
                        >
                          <Plus className="h-3 w-3" />
                          #{tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
