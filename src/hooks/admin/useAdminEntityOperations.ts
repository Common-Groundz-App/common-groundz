
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useAdminEntityOperations = () => {
  const [isProcessing, setIsProcessing] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const softDeleteEntity = async (entityId: string, entityName: string) => {
    setIsProcessing(prev => ({ ...prev, [entityId]: true }));
    
    try {
      console.log('Admin soft delete: Starting for entity', entityId);
      
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('No valid session found');
      }

      console.log('Admin soft delete: Session validated, calling edge function');

      // Call the edge function with proper authorization
      const { data, error } = await supabase.functions.invoke('admin-soft-delete-entity', {
        body: {
          entityId,
          action: 'delete'
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        }
      });

      if (error) {
        console.error('Admin soft delete: Edge function error:', error);
        throw error;
      }

      if (!data?.success) {
        console.error('Admin soft delete: Operation failed:', data);
        throw new Error(data?.error || 'Operation failed');
      }

      console.log('Admin soft delete: Success for entity', entityId);
      
      toast({
        title: 'Success',
        description: `Entity "${entityName}" has been soft deleted`,
      });

      return { success: true, data };

    } catch (error) {
      console.error('Admin soft delete: Error:', error);
      
      toast({
        title: 'Error',
        description: `Failed to delete entity: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive'
      });

      return { success: false, error };
    } finally {
      setIsProcessing(prev => ({ ...prev, [entityId]: false }));
    }
  };

  const restoreEntity = async (entityId: string, entityName: string) => {
    setIsProcessing(prev => ({ ...prev, [entityId]: true }));
    
    try {
      console.log('Admin restore: Starting for entity', entityId);
      
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('No valid session found');
      }

      console.log('Admin restore: Session validated, calling edge function');

      // Call the edge function with proper authorization
      const { data, error } = await supabase.functions.invoke('admin-soft-delete-entity', {
        body: {
          entityId,
          action: 'restore'
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        }
      });

      if (error) {
        console.error('Admin restore: Edge function error:', error);
        throw error;
      }

      if (!data?.success) {
        console.error('Admin restore: Operation failed:', data);
        throw new Error(data?.error || 'Operation failed');
      }

      console.log('Admin restore: Success for entity', entityId);
      
      toast({
        title: 'Success',
        description: `Entity "${entityName}" has been restored`,
      });

      return { success: true, data };

    } catch (error) {
      console.error('Admin restore: Error:', error);
      
      toast({
        title: 'Error',
        description: `Failed to restore entity: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive'
      });

      return { success: false, error };
    } finally {
      setIsProcessing(prev => ({ ...prev, [entityId]: false }));
    }
  };

  return {
    softDeleteEntity,
    restoreEntity,
    isProcessing
  };
};
