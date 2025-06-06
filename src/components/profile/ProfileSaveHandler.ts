
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseProfileSaveHandlerProps {
  userId: string | undefined;
  tempProfileImage: string | null;
  setTempProfileImage: (url: string | null) => void;
  setLocalHasChanges: (hasChanges: boolean) => void;
  hasChanges: boolean;
  onSaveChanges?: () => void;
}

export const useProfileSaveHandler = ({
  userId,
  tempProfileImage,
  setTempProfileImage,
  setLocalHasChanges,
  hasChanges,
  onSaveChanges
}: UseProfileSaveHandlerProps) => {
  const { toast } = useToast();

  const handleSaveChanges = async () => {
    if (!userId) return;
    
    try {
      // If we have local profile image changes
      if (tempProfileImage) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ avatar_url: tempProfileImage })
          .eq('id', userId);
        
        if (updateError) {
          toast({
            title: 'Failed to update profile',
            description: updateError.message,
            variant: 'destructive'
          });
          return;
        }
        
        // Clear the temporary state
        setTempProfileImage(null);
        setLocalHasChanges(false);
        
        // Refresh the UserMenu component by triggering a global event
        window.dispatchEvent(new CustomEvent('profile-updated'));
      }
      
      // Forward to parent's save handler for any other changes (like cover image)
      if (hasChanges && onSaveChanges) {
        onSaveChanges();
      }
      
      toast({
        title: 'Profile saved',
        description: 'Your profile has been updated successfully.',
      });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: 'Something went wrong',
        description: 'Please try again later.',
        variant: 'destructive'
      });
    }
  };

  return { handleSaveChanges };
};
