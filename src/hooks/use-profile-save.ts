
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { updateUserProfile } from '@/services/profileService';

export const useProfileSave = (userId?: string) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Save all profile changes
  const handleSaveChanges = async (updates: any) => {
    if (!userId || Object.keys(updates).length === 0) return;
    
    try {
      setIsLoading(true);
      
      await updateUserProfile(userId, updates);
      
      // Clear temporary state
      setHasChanges(false);
      
      // Notify user
      toast({
        title: 'Profile updated',
        description: 'Your profile has been successfully updated.'
      });
      
      // Refresh the UserMenu
      window.dispatchEvent(new CustomEvent('profile-updated'));
      
      return true;
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast({
        title: 'Update failed',
        description: error.message || 'There was a problem updating your profile',
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    hasChanges,
    setHasChanges,
    handleSaveChanges
  };
};
