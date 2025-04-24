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

  const handleSuccess = () => {
    setIsDialogOpen(false);
    
    // Update event names
    window.dispatchEvent(new CustomEvent('refresh-for-you-home'));
    window.dispatchEvent(new CustomEvent('refresh-following-home'));
    window.dispatchEvent(new CustomEvent('refresh-profile-posts'));
    
    if (onPostCreated) onPostCreated();
  };

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
            onSuccess={handleSuccess}
            onCancel={() => setIsDialogOpen(false)} 
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
