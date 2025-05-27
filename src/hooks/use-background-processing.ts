
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to trigger background processing periodically
 */
export const useBackgroundProcessing = () => {
  useEffect(() => {
    // Set up periodic background processing trigger
    const triggerBackgroundProcessing = async () => {
      try {
        console.log('🔄 Triggering periodic background processing...');
        
        const { error } = await supabase.functions.invoke('process-entity-background', {
          body: { trigger: 'periodic' }
        });

        if (error) {
          console.error('❌ Error triggering background processing:', error);
        } else {
          console.log('✅ Background processing triggered successfully');
        }
      } catch (error) {
        console.error('❌ Error in background processing trigger:', error);
      }
    };

    // Trigger immediately on mount
    triggerBackgroundProcessing();

    // Set up interval to trigger every 30 seconds
    const interval = setInterval(triggerBackgroundProcessing, 30000);

    return () => {
      clearInterval(interval);
    };
  }, []);
};
