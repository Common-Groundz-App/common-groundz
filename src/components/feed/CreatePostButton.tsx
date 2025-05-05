
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { EnhancedCreatePostForm } from './EnhancedCreatePostForm';
import { useAuth } from '@/contexts/AuthContext';
import { fetchUserProfile } from '@/services/profileService';
import { useToast } from '@/hooks/use-toast';

// Add custom styles for emoji picker to fix interaction issues
const emojiPickerStyles = `
  .emoji-mart {
    box-sizing: border-box;
    z-index: 100;
  }
  
  .emoji-mart * {
    box-sizing: border-box;
    cursor: pointer;
  }
  
  .emoji-mart-emoji {
    cursor: pointer !important;
  }
  
  .emoji-mart-scroll {
    overflow-y: auto;
    height: 270px;
    padding: 0 6px 6px 6px;
    will-change: transform;
  }
  
  .emoji-mart-search {
    margin-top: 6px;
    padding: 0 6px;
    position: relative;
  }
  
  .emoji-mart-category-label {
    position: sticky;
    top: 0;
    z-index: 2;
    padding: 0 6px;
    font-weight: 500;
    font-size: 14px;
    background: var(--background);
  }
`;

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
      {/* Add style element for emoji picker styles */}
      <style>{emojiPickerStyles}</style>
      
      <Button
        onClick={() => setIsDialogOpen(true)}
        className="bg-brand-orange hover:bg-brand-orange/90 gap-2"
      >
        <PlusCircle size={18} />
        Create Post
      </Button>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent 
          className="sm:max-w-xl max-h-[90vh] overflow-y-auto p-0"
          onOpenAutoFocus={(e) => {
            // Prevent auto-focus behavior that might interfere with emoji picking
            e.preventDefault();
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
