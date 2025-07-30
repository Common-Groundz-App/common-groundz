import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';
import { MediaItem } from '@/types/media';
import { SimpleMediaGrid } from './SimpleMediaGrid';

export const TestMediaUploadForm: React.FC = () => {
  const [media, setMedia] = useState<MediaItem[]>([]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file, index) => {
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const url = URL.createObjectURL(file);
        const newMediaItem: MediaItem = {
          url,
          type: file.type.startsWith('image/') ? 'image' : 'video',
          alt: file.name,
          order: media.length + index,
          id: `test-${Date.now()}-${index}`
        };
        
        setMedia(prev => [...prev, newMediaItem]);
      }
    });

    // Reset the input
    event.target.value = '';
  };

  const removeMedia = (mediaToRemove: MediaItem) => {
    setMedia(prev => prev.filter(item => item.id !== mediaToRemove.id));
    // Clean up object URL
    if (mediaToRemove.url.startsWith('blob:')) {
      URL.revokeObjectURL(mediaToRemove.url);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Test Media Upload Form</h2>
        
        {/* File Upload */}
        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center mb-6">
          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-4">
            Click to upload images and videos
          </p>
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            id="test-file-upload"
          />
          <Button asChild>
            <label htmlFor="test-file-upload" className="cursor-pointer">
              Choose Files
            </label>
          </Button>
        </div>

        {/* Media Grid */}
        {media.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2">Uploaded Media ({media.length})</h3>
            <SimpleMediaGrid media={media} onRemove={removeMedia} />
          </div>
        )}

        {media.length === 0 && (
          <p className="text-center text-muted-foreground text-sm">
            No media uploaded yet
          </p>
        )}
      </div>
    </div>
  );
};