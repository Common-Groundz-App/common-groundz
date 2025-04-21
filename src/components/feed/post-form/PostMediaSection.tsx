
import React from 'react';
import { MediaUploader } from '@/components/media/MediaUploader';
import { MediaItem } from '@/types/media';

interface PostMediaSectionProps {
  isEditMode: boolean;
  mediaItems: MediaItem[];
  sessionId: string;
  onMediaUploaded: (media: MediaItem) => void;
}

export function PostMediaSection({
  isEditMode,
  mediaItems,
  sessionId,
  onMediaUploaded
}: PostMediaSectionProps) {
  return (
    <div>
      {isEditMode && mediaItems.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium mb-2">Current Media</p>
          <div className="grid grid-cols-2 gap-2">
            {mediaItems.map((item, index) => (
              <div key={index} className="relative border rounded overflow-hidden">
                {item.type === 'image' ? (
                  <img src={item.url} alt={item.alt || `Image ${index + 1}`} className="w-full h-40 object-cover" />
                ) : (
                  <video src={item.url} className="w-full h-40 object-cover" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <MediaUploader
        sessionId={sessionId}
        onMediaUploaded={onMediaUploaded}
      />
    </div>
  );
}
