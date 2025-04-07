
import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FormItem, FormLabel } from '@/components/ui/form';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { MediaUploader } from '@/components/media/MediaUploader';
import { MediaGallery } from '@/components/media/MediaGallery';
import { MediaItem } from '@/types/media';

interface PostContentTabsProps {
  sessionId: string;
  media: MediaItem[];
  onMediaUpdate: (media: MediaItem[]) => void;
  onContentChange: (json: object, html: string) => void;
}

export function PostContentTabs({
  sessionId,
  media,
  onMediaUpdate,
  onContentChange,
}: PostContentTabsProps) {
  const [currentTab, setCurrentTab] = useState<string>('content');

  const handleMediaUploaded = (uploadedItem: MediaItem) => {
    onMediaUpdate([
      ...media,
      {
        ...uploadedItem,
        order: media.length
      }
    ]);
  };
  
  const handleMediaRemove = (index: number) => {
    const updatedMedia = [...media];
    updatedMedia[index] = { 
      ...updatedMedia[index], 
      is_deleted: true 
    };
    onMediaUpdate(updatedMedia);
  };
  
  const handleMediaCaptionChange = (index: number, caption: string) => {
    const updatedMedia = [...media];
    updatedMedia[index] = { 
      ...updatedMedia[index], 
      caption 
    };
    onMediaUpdate(updatedMedia);
  };

  const handleMediaAltChange = (index: number, alt: string) => {
    const updatedMedia = [...media];
    updatedMedia[index] = { 
      ...updatedMedia[index], 
      alt 
    };
    onMediaUpdate(updatedMedia);
  };

  return (
    <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
      <TabsList className="grid grid-cols-2">
        <TabsTrigger value="content">Content</TabsTrigger>
        <TabsTrigger value="media">Media</TabsTrigger>
      </TabsList>
      
      <TabsContent value="content" className="pt-2">
        <FormItem>
          <FormLabel>Content</FormLabel>
          <RichTextEditor
            onChange={onContentChange}
            placeholder="Write your post content here..."
            className="min-h-[150px]"
          />
        </FormItem>
      </TabsContent>
      
      <TabsContent value="media" className="pt-2">
        <div className="space-y-4">
          <MediaUploader
            sessionId={sessionId}
            onMediaUploaded={handleMediaUploaded}
          />
          
          {media.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-medium mb-2">Media Preview</h3>
              <MediaGallery
                media={media}
                editable={true}
                onRemove={handleMediaRemove}
                onCaptionChange={handleMediaCaptionChange}
                onAltChange={handleMediaAltChange}
              />
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
