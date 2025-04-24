
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CreatePostForm } from './CreatePostForm';

interface CreatePostButtonProps {
  onPostCreated?: () => void;
}

export function CreatePostButton({ onPostCreated }: CreatePostButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Listen for the "open-create-post-dialog" event
  useEffect(() => {
    const handleOpenDialog = () => setIsDialogOpen(true);
    window.addEventListener('open-create-post-dialog', handleOpenDialog);
    
    return () => {
      window.removeEventListener('open-create-post-dialog', handleOpenDialog);
    };
  }, []);

  return (
    <>
      <Button
        onClick={() => setIsDialogOpen(true)}
        className="bg-brand-orange hover:bg-brand-orange/90 gap-2"
      >
        <PlusCircle size={18} />
        Create Post
      </Button>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Post</DialogTitle>
            <DialogDescription>
              Share your thoughts, stories, or recommendations with your community.
            </DialogDescription>
          </DialogHeader>
          
          <CreatePostForm 
            onSuccess={() => {
              setIsDialogOpen(false);
              
              // Dispatch events to refresh both feeds and profile posts
              window.dispatchEvent(new CustomEvent('refresh-for-you-feed'));
              window.dispatchEvent(new CustomEvent('refresh-following-feed'));
              window.dispatchEvent(new CustomEvent('refresh-profile-posts'));
              
              if (onPostCreated) onPostCreated();
            }}
            onCancel={() => setIsDialogOpen(false)} 
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
