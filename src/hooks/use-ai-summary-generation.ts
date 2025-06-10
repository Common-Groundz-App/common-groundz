
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useAISummaryGeneration = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const generateReviewSummary = async (reviewId: string) => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-ai-summary', {
        body: { reviewId }
      });

      if (error) {
        console.error('Error generating AI summary:', error);
        throw error;
      }

      if (data?.success) {
        toast({
          title: 'AI Summary Generated',
          description: 'The timeline summary has been generated successfully.',
        });
        return true;
      } else {
        throw new Error(data?.error || 'Failed to generate summary');
      }
    } catch (error) {
      console.error('Error generating AI summary:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate AI summary. Please try again.',
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generateReviewSummary,
    isGenerating
  };
};
