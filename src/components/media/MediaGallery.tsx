
import React from 'react';
import { X, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MediaItem } from '@/types/media';
import { cn } from '@/lib/utils';

interface MediaGalleryProps {
  media: MediaItem[];
  editable?: boolean;
  onRemove?: (index: number) => void;
  onCaptionChange?: (index: number, caption: string) => void;
  onAltChange?: (index: number, alt: string) => void;
  className?: string;
}

export function MediaGallery({ 
  media,
  editable = false,
  onRemove,
  onCaptionChange,
  onAltChange,
  className
}: MediaGalleryProps) {
  const [editingCaption, setEditingCaption] = React.useState<number | null>(null);
  const [editingAlt, setEditingAlt] = React.useState<number | null>(null);
  
  if (!media || media.length === 0) {
    return null;
  }
  
  const handleCaptionEdit = (index: number) => {
    if (editable) {
      setEditingCaption(index);
      setEditingAlt(null); // Close any open alt editing
    }
  };

  const handleAltEdit = (index: number) => {
    if (editable) {
      setEditingAlt(index);
      setEditingCaption(null); // Close any open caption editing
    }
  };
  
  const handleCaptionSave = (index: number, caption: string) => {
    if (onCaptionChange) {
      onCaptionChange(index, caption);
    }
    setEditingCaption(null);
  };

  const handleAltSave = (index: number, alt: string) => {
    if (onAltChange) {
      onAltChange(index, alt);
    }
    setEditingAlt(null);
  };
  
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-4", className)}>
      {media
        .filter(item => !item.is_deleted)
        .sort((a, b) => a.order - b.order)
        .map((item, index) => (
          <div 
            key={item.id || index} 
            className="relative border rounded-md overflow-hidden group"
          >
            {item.type === 'image' ? (
              <img 
                src={item.url} 
                alt={item.alt || item.caption || `Media ${index + 1}`}
                className="w-full h-48 object-cover"
              />
            ) : (
              <video 
                src={item.url}
                poster={item.thumbnail_url}
                controls
                className="w-full h-48 object-cover"
                aria-label={item.alt || item.caption || `Video ${index + 1}`}
              >
                Your browser does not support the video tag.
              </video>
            )}
            
            {editable && onRemove && (
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onRemove(index)}
              >
                <X size={16} />
              </Button>
            )}
            
            <div className="p-2 bg-muted/50">
              {editingCaption === index ? (
                <form 
                  className="flex space-x-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const input = e.currentTarget.elements.namedItem('caption') as HTMLInputElement;
                    handleCaptionSave(index, input.value);
                  }}
                >
                  <Input 
                    id="caption"
                    name="caption"
                    defaultValue={item.caption || ''}
                    placeholder="Add a caption..."
                    autoFocus
                    className="flex-1"
                  />
                  <Button type="submit" size="sm">Save</Button>
                </form>
              ) : editingAlt === index ? (
                <form 
                  className="flex space-x-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const input = e.currentTarget.elements.namedItem('alt') as HTMLInputElement;
                    handleAltSave(index, input.value);
                  }}
                >
                  <Input 
                    id="alt"
                    name="alt"
                    defaultValue={item.alt || ''}
                    placeholder="Add alt text for accessibility..."
                    autoFocus
                    className="flex-1"
                  />
                  <Button type="submit" size="sm">Save</Button>
                </form>
              ) : (
                <div className="flex justify-between items-center">
                  <p className="text-sm truncate">
                    {item.caption || (editable ? 'No caption' : '')}
                  </p>
                  {editable && onCaptionChange && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="p-1"
                        onClick={() => handleCaptionEdit(index)}
                      >
                        <Edit2 size={14} />
                      </Button>
                      {onAltChange && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="p-1 text-xs"
                          onClick={() => handleAltEdit(index)}
                        >
                          Alt
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
    </div>
  );
}
