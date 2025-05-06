
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { EnhancedCreatePostForm } from './EnhancedCreatePostForm';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserProfile } from '@/services/profileService';
import { useToast } from '@/hooks/use-toast';

// Enhanced emoji picker styles removed (now in index.css)

interface CreatePostButtonProps {
  onPostCreated?: () => void;
}

export function CreatePostButton({ onPostCreated }: CreatePostButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const [profileData, setProfileData] = React.useState<any>(null);

  // Fetch user profile data when needed
  React.useEffect(() => {
    const loadProfileData = async () => {
      if (user && isDialogOpen) {
        try {
          const profile = await fetchUserProfile(user.id);
          setProfileData(profile);
        } catch (err) {
          console.error('Error fetching profile data:', err);
          toast({
            title: 'Could not load profile data',
            description: 'Your post will use default profile information',
            variant: 'destructive',
          });
        }
      }
    };

    if (isDialogOpen) {
      loadProfileData();
    }
  }, [user, isDialogOpen, toast]);

  // Listen for the "open-create-post-dialog" event
  React.useEffect(() => {
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
      
      <Dialog 
        open={isDialogOpen} 
        onOpenChange={(open) => {
          // Only close if explicitly setting to false to prevent emoji clicks from closing
          if (open === false) {
            setIsDialogOpen(false);
          }
        }}
      >
        <DialogContent 
          className="sm:max-w-xl max-h-[90vh] overflow-y-auto overflow-visible"
          onOpenAutoFocus={(e) => {
            // Prevent auto-focus behavior that might interfere with emoji picking
            e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            // Prevent emoji picker clicks from closing the dialog
            const target = e.target as HTMLElement;
            if (target.closest('.emoji-mart') || 
                target.closest('.emoji-mart-emoji') || 
                target.closest('[data-emoji-set]') ||
                target.closest('.emoji-picker-wrapper')) {
              e.preventDefault();
            }
          }}
          onClick={(e) => {
            // Prevent event propagation from within emoji picker
            const target = e.target as HTMLElement;
            if (target.closest('.emoji-mart') || 
                target.closest('.emoji-mart-emoji') || 
                target.closest('[data-emoji-set]') ||
                target.closest('.emoji-picker-wrapper')) {
              e.stopPropagation();
            }
          }}
        >
          <EnhancedCreatePostForm 
            profileData={profileData}
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
