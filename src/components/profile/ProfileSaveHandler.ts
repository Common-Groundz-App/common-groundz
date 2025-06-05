
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
      // Avatar changes are now handled immediately in ProfileAvatar component
      // This handler only processes other profile changes (like cover image)
      
      // Forward to parent's save handler for non-avatar changes
      if (hasChanges && onSaveChanges) {
        onSaveChanges();
      }
      
      // Clear any temporary avatar state (shouldn't be needed anymore)
      if (tempProfileImage) {
        setTempProfileImage(null);
        setLocalHasChanges(false);
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
