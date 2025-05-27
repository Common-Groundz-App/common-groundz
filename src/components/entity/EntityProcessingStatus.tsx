
import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface EntityProcessingStatusProps {
  entityId: string;
  onProcessingComplete?: () => void;
}

export const EntityProcessingStatus: React.FC<EntityProcessingStatusProps> = ({ 
  entityId, 
  onProcessingComplete 
}) => {
  const [status, setStatus] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const checkProcessingStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('entity_enrichment_queue')
          .select('status, error_message')
          .eq('entity_id', entityId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Error checking processing status:', error);
          return;
        }

        if (data) {
          setStatus(data.status);
          
          // Hide status after completion
          if (data.status === 'completed') {
            setTimeout(() => {
              setIsVisible(false);
              onProcessingComplete?.();
            }, 3000);
          }
        } else {
          // No processing task found, entity might be already complete
          setIsVisible(false);
        }
      } catch (error) {
        console.error('Error in checkProcessingStatus:', error);
      }
    };

    // Check immediately
    checkProcessingStatus();

    // Set up realtime subscription for status updates
    const channel = supabase
      .channel('entity-processing-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'entity_enrichment_queue',
          filter: `entity_id=eq.${entityId}`
        },
        (payload) => {
          console.log('Processing status updated:', payload);
          setStatus(payload.new.status);
          
          if (payload.new.status === 'completed') {
            setTimeout(() => {
              setIsVisible(false);
              onProcessingComplete?.();
            }, 3000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [entityId, onProcessingComplete]);

  if (!isVisible || !status) {
    return null;
  }

  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return {
          icon: <Clock className="w-4 h-4" />,
          label: 'Queued for processing',
          variant: 'secondary' as const,
          showSpinner: false
        };
      case 'processing':
        return {
          icon: <LoadingSpinner size="sm" />,
          label: 'Processing details...',
          variant: 'default' as const,
          showSpinner: true
        };
      case 'completed':
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          label: 'Processing complete!',
          variant: 'default' as const,
          showSpinner: false
        };
      case 'failed':
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          label: 'Processing failed',
          variant: 'destructive' as const,
          showSpinner: false
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  return (
    <div className="mb-4">
      <Badge variant={config.variant} className="gap-2">
        {config.icon}
        {config.label}
      </Badge>
    </div>
  );
};
