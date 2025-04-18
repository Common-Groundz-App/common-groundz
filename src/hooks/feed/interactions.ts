
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export const useInteractions = () => {
  const { user } = useAuth();

  const handleLike = async (id: string, userId: string) => {
    try {
      const { data, error } = await supabase
        .rpc('toggle_post_like', {
          p_post_id: id,
          p_user_id: userId
        });

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error toggling like:', err);
      throw err;
    }
  };

  const handleSave = async (id: string, userId: string) => {
    try {
      const { data, error } = await supabase
        .rpc('toggle_post_save', {
          p_post_id: id,
          p_user_id: userId
        });

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error toggling save:', err);
      throw err;
    }
  };

  return {
    handleLike,
    handleSave
  };
};
