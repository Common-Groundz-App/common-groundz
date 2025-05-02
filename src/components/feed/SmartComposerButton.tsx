
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, Star, Book, Tag, Video } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CreatePostForm } from './CreatePostForm';
import ReviewForm from '@/components/profile/reviews/ReviewForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface SmartComposerButtonProps {
  onContentCreated?: () => void;
  onPostCreated?: () => void; // Add compatibility with old prop name
}

type ContentType = 'post' | 'review' | 'journal' | 'recommendation' | 'watching';

export function SmartComposerButton({ onContentCreated, onPostCreated }: SmartComposerButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedContentType, setSelectedContentType] = useState<ContentType>('post');
  const { user } = useAuth();

  // Listen for the "open-create-post-dialog" event
  useEffect(() => {
    const handleOpenDialog = (event: Event) => {
      // Check if the event has a detail property with a contentType
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.contentType) {
        setSelectedContentType(customEvent.detail.contentType as ContentType);
      } else {
        setSelectedContentType('post');
      }
      setIsDialogOpen(true);
    };
    
    window.addEventListener('open-create-post-dialog', handleOpenDialog);
    window.addEventListener('open-recommendation-form', () => {
      setSelectedContentType('recommendation');
      setIsDialogOpen(true);
    });
    
    return () => {
      window.removeEventListener('open-create-post-dialog', handleOpenDialog);
      window.removeEventListener('open-recommendation-form', () => {});
    };
  }, []);

  const handleContentCreated = () => {
    setIsDialogOpen(false);
    
    // Dispatch events to refresh both feeds and profile posts
    window.dispatchEvent(new CustomEvent('refresh-for-you-feed'));
    window.dispatchEvent(new CustomEvent('refresh-following-feed'));
    window.dispatchEvent(new CustomEvent('refresh-profile-posts'));
    
    // Call both callback props for compatibility
    if (onContentCreated) onContentCreated();
    if (onPostCreated) onPostCreated();
  };
  
  const getDialogTitle = () => {
    switch (selectedContentType) {
      case 'post': return 'Create New Post';
      case 'review': return 'Add New Review';
      case 'journal': return 'Create Journal Entry';
      case 'recommendation': return 'Add Recommendation';
      case 'watching': return 'Share What You\'re Watching/Doing';
      default: return 'Create New Content';
    }
  };
  
  const getDialogDescription = () => {
    switch (selectedContentType) {
      case 'post': return 'Share your thoughts, stories, or recommendations with your community.';
      case 'review': return 'Share your detailed review and rating of a place, product, or experience.';
      case 'journal': return 'Document your journey, progress, or experiences.';
      case 'recommendation': return 'Recommend something you think others would enjoy or find valuable.';
      case 'watching': return 'Let others know what you\'re currently watching, reading, or doing.';
      default: return 'Create and share with your community.';
    }
  };

  return (
    <>
      <div className="relative">
        <Button
          onClick={() => setIsDialogOpen(true)}
          className="bg-brand-orange hover:bg-brand-orange/90 gap-2"
        >
          <PlusCircle size={18} />
          Create
        </Button>
      </div>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{getDialogTitle()}</DialogTitle>
            <DialogDescription>
              {getDialogDescription()}
            </DialogDescription>
          </DialogHeader>
          
          <Tabs 
            defaultValue="post" 
            value={selectedContentType}
            onValueChange={(value) => setSelectedContentType(value as ContentType)}
            className="w-full"
          >
            <TabsList className="grid grid-cols-5 mb-4">
              <TabsTrigger value="post" className="flex flex-col items-center gap-1">
                <PlusCircle size={16} />
                <span className="text-xs">Post</span>
              </TabsTrigger>
              <TabsTrigger value="review" className="flex flex-col items-center gap-1">
                <Star size={16} />
                <span className="text-xs">Review</span>
              </TabsTrigger>
              <TabsTrigger value="journal" className="flex flex-col items-center gap-1">
                <Book size={16} />
                <span className="text-xs">Journal</span>
              </TabsTrigger>
              <TabsTrigger value="recommendation" className="flex flex-col items-center gap-1">
                <Tag size={16} />
                <span className="text-xs">Rec</span>
              </TabsTrigger>
              <TabsTrigger value="watching" className="flex flex-col items-center gap-1">
                <Video size={16} />
                <span className="text-xs">Watching</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="post" className={cn(selectedContentType !== 'post' && 'hidden')}>
              <CreatePostForm 
                onSuccess={handleContentCreated}
                onCancel={() => setIsDialogOpen(false)} 
              />
            </TabsContent>
            
            <TabsContent value="review" className={cn(selectedContentType !== 'review' && 'hidden')}>
              <ReviewForm
                isOpen={selectedContentType === 'review'} 
                onClose={() => setIsDialogOpen(false)}
                onSubmit={async () => {
                  handleContentCreated();
                  return Promise.resolve();
                }}
              />
            </TabsContent>
            
            <TabsContent value="journal" className={cn(selectedContentType !== 'journal' && 'hidden')}>
              {/* For now, we'll reuse the CreatePostForm but with journal type */}
              <CreatePostForm 
                onSuccess={handleContentCreated}
                onCancel={() => setIsDialogOpen(false)}
                defaultPostType="note"
              />
            </TabsContent>
            
            <TabsContent value="recommendation" className={cn(selectedContentType !== 'recommendation' && 'hidden')}>
              {/* Use the existing recommendation form */}
              <div className="p-4 text-center text-muted-foreground">
                <p>Recommendation form is typically loaded in a separate dialog.</p>
                <Button 
                  onClick={() => {
                    // Dispatch the open recommendation form event
                    window.dispatchEvent(new CustomEvent('open-recommendation-form'));
                  }}
                  className="mt-2"
                >
                  Open Recommendation Form
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="watching" className={cn(selectedContentType !== 'watching' && 'hidden')}>
              {/* For now, we'll reuse the CreatePostForm but with note type */}
              <CreatePostForm 
                onSuccess={handleContentCreated}
                onCancel={() => setIsDialogOpen(false)}
                defaultPostType="note"
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}

