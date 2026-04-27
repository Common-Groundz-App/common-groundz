import React from 'react';
import { Image, Smile, Globe, Lock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MediaUploader } from '@/components/media/MediaUploader';
import { MoreToolsPopover } from './MoreToolsPopover';
import { cn } from '@/lib/utils';
import type { MediaItem } from '@/types/media';

export type VisibilityOption = 'public' | 'private' | 'circle';

interface ComposerBottomBarProps {
  sessionId: string;
  media: MediaItem[];
  maxMediaCount: number;
  onMediaUploaded: (item: MediaItem) => void;

  emojiPickerVisible: boolean;
  onToggleEmojiPicker: (e: React.MouseEvent) => void;

  visibility: VisibilityOption;
  onVisibilityChange: (next: VisibilityOption) => void;

  onOpenLocation: () => void;
  locationActive: boolean;

  disabled?: boolean;

  /** Slot for the emoji picker rendered by parent (keeps cursor logic owned upstream). */
  emojiPickerSlot?: React.ReactNode;
}

const getVisibilityIcon = (v: VisibilityOption) => {
  switch (v) {
    case 'private': return <Lock className="h-4 w-4" />;
    case 'circle': return <Users className="h-4 w-4" />;
    default: return <Globe className="h-4 w-4" />;
  }
};

const getVisibilityLabel = (v: VisibilityOption) =>
  v === 'public' ? 'Public' : v === 'private' ? 'Only Me' : 'Circle Only';

/**
 * Sticky bottom toolbar.
 * Left (Level 1): Media · Emoji · More (Level 2 popover w/ Location)
 * Right: labeled visibility pill
 *
 * Post button lives in the top bar (not duplicated here).
 */
export const ComposerBottomBar: React.FC<ComposerBottomBarProps> = ({
  sessionId,
  media,
  maxMediaCount,
  onMediaUploaded,
  emojiPickerVisible,
  onToggleEmojiPicker,
  visibility,
  onVisibilityChange,
  onOpenLocation,
  locationActive,
  disabled,
  emojiPickerSlot,
}) => {
  return (
    <div
      role="toolbar"
      aria-label="Composer tools"
      className={cn(
        'sticky bottom-0 z-30 flex items-center justify-between gap-2 bg-background/95 backdrop-blur-md border-t border-border px-3 py-2',
        'pb-[calc(0.5rem+env(safe-area-inset-bottom))]',
        disabled && 'opacity-50 pointer-events-none'
      )}
    >
      {/* Level 1 tools */}
      <div className="flex items-center gap-1">
        <MediaUploader
          sessionId={sessionId}
          onMediaUploaded={onMediaUploaded}
          initialMedia={media}
          maxMediaCount={maxMediaCount}
          customButton={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                'rounded-full p-2 hover:bg-accent hover:text-accent-foreground',
                media.length >= maxMediaCount && 'opacity-50 cursor-not-allowed'
              )}
              disabled={media.length >= maxMediaCount}
              aria-label="Add media"
            >
              <Image className="h-5 w-5" />
              {media.length > 0 && (
                <span className="ml-1 text-xs font-medium">
                  {media.length}/{maxMediaCount}
                </span>
              )}
            </Button>
          }
        />

        {/* Emoji button + parent-owned picker slot */}
        <div className="relative">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              'rounded-full p-2 hover:bg-accent hover:text-accent-foreground',
              emojiPickerVisible && 'bg-accent/50 text-accent-foreground'
            )}
            onClick={onToggleEmojiPicker}
            aria-label="Insert emoji"
          >
            <Smile className="h-5 w-5" />
          </Button>
          {emojiPickerSlot}
        </div>

        <MoreToolsPopover
          onOpenLocation={onOpenLocation}
          locationActive={locationActive}
        />
      </div>

      {/* Visibility pill */}
      <Select value={visibility} onValueChange={(v: VisibilityOption) => onVisibilityChange(v)}>
        <SelectTrigger
          className="h-9 w-auto gap-1.5 rounded-full border border-border bg-background px-3 text-xs"
          aria-label="Change visibility"
        >
          <SelectValue>
            <div className="flex items-center gap-1.5">
              {getVisibilityIcon(visibility)}
              <span>{getVisibilityLabel(visibility)}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="public">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              <span>Public</span>
            </div>
          </SelectItem>
          <SelectItem value="private">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              <span>Only Me</span>
            </div>
          </SelectItem>
          <SelectItem value="circle">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>Circle Only</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
