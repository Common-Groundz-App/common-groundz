
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseEntitySaveProps {
  entityId: string;
  enabled?: boolean;
}

export const useEntitySave = ({ entityId, enabled = true }: UseEntitySaveProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSaved, setIsSaved] = useState(false);
  const [saveCount, setSaveCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch initial save status and count
  useEffect(() => {
    if (!enabled || !entityId) return;

    const fetchSaveData = async () => {
      try {
        // Get save count
        const { data: countData, error: countError } = await supabase
          .rpc('get_entity_saves_count', { p_entity_id: entityId });

        if (countError) throw countError;
        setSaveCount(countData || 0);

        // Check if current user has saved this entity
        if (user) {
          const { data: savedData, error: savedError } = await supabase
            .rpc('check_entity_save', { 
              p_entity_id: entityId, 
              p_user_id: user.id 
            });

          if (savedError) throw savedError;
          setIsSaved(savedData || false);
        }
      } catch (error) {
        console.error('Error fetching save data:', error);
      }
    };

    fetchSaveData();
  }, [entityId, user?.id, enabled]);

  // Listen for real-time save events
  useEffect(() => {
    if (!enabled || !entityId) return;

    const handleEntitySaveChange = (event: CustomEvent) => {
      const { entityId: eventEntityId, userId, action } = event.detail;
      
      if (eventEntityId === entityId) {
        console.log(`Entity save event received: ${action} by user ${userId} for entity ${entityId}`);
        
        // Update save count
        if (action === 'save') {
          setSaveCount(prev => prev + 1);
        } else if (action === 'unsave') {
          setSaveCount(prev => Math.max(0, prev - 1));
        }

        // Update current user's save status
        if (user && userId === user.id) {
          setIsSaved(action === 'save');
        }
      }
    };

    window.addEventListener('entity-save-status-changed', handleEntitySaveChange as EventListener);
    
    return () => {
      window.removeEventListener('entity-save-status-changed', handleEntitySaveChange as EventListener);
    };
  }, [entityId, user?.id, enabled]);

  const toggleSave = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save entities",
      });
      return;
    }

    if (isLoading) return;

    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .rpc('toggle_entity_save', {
          p_entity_id: entityId,
          p_user_id: user.id
        });

      if (error) throw error;

      const newSavedState = data; // true if saved, false if unsaved
      
      // Dispatch custom event for real-time updates
      const event = new CustomEvent('entity-save-status-changed', {
        detail: {
          entityId,
          userId: user.id,
          action: newSavedState ? 'save' : 'unsave'
        }
      });
      window.dispatchEvent(event);

      // Show success message
      toast({
        title: newSavedState ? "Entity saved" : "Entity unsaved",
        description: newSavedState 
          ? "Added to your saved entities" 
          : "Removed from your saved entities"
      });

    } catch (error) {
      console.error('Error toggling entity save:', error);
      toast({
        title: "Error",
        description: "Failed to update save status",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isSaved,
    saveCount,
    toggleSave,
    isLoading
  };
};
