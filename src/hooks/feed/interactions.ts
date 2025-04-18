
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export const useInteractions = () => {
  const { user } = useAuth();

  const handleLike = async (id: string, userId: string, itemType: 'post' | 'recommendation' = 'post') => {
    try {
      if (itemType === 'post') {
        const { data, error } = await supabase
          .rpc('toggle_post_like', {
            p_post_id: id,
            p_user_id: userId
          });

        if (error) throw error;
        return data;
      } else {
        // Handle recommendation likes
        const { data, error } = await supabase
          .from('recommendation_likes')
          .select('id')
          .eq('recommendation_id', id)
          .eq('user_id', userId)
          .single();

        if (error && error.code !== 'PGSQL_ERROR') {
          console.error('Error checking recommendation like:', error);
          throw error;
        }

        if (data) {
          // Like exists, remove it
          const { error: deleteError } = await supabase
            .from('recommendation_likes')
            .delete()
            .eq('recommendation_id', id)
            .eq('user_id', userId);
          
          if (deleteError) throw deleteError;
          return false;
        } else {
          // Like doesn't exist, add it
          const { error: insertError } = await supabase
            .from('recommendation_likes')
            .insert({
              recommendation_id: id,
              user_id: userId
            });
          
          if (insertError) throw insertError;
          return true;
        }
      }
    } catch (err) {
      console.error('Error toggling like:', err);
      throw err;
    }
  };

  const handleSave = async (id: string, userId: string, itemType: 'post' | 'recommendation' = 'post') => {
    try {
      if (itemType === 'post') {
        const { data, error } = await supabase
          .rpc('toggle_post_save', {
            p_post_id: id,
            p_user_id: userId
          });

        if (error) throw error;
        return data;
      } else {
        // Handle recommendation saves
        const { data, error } = await supabase
          .from('recommendation_saves')
          .select('id')
          .eq('recommendation_id', id)
          .eq('user_id', userId)
          .single();
        
        if (error && error.code !== 'PGSQL_ERROR') {
          console.error('Error checking recommendation save:', error);
          throw error;
        }

        if (data) {
          // Save exists, remove it
          const { error: deleteError } = await supabase
            .from('recommendation_saves')
            .delete()
            .eq('recommendation_id', id)
            .eq('user_id', userId);
          
          if (deleteError) throw deleteError;
          return false;
        } else {
          // Save doesn't exist, add it
          const { error: insertError } = await supabase
            .from('recommendation_saves')
            .insert({
              recommendation_id: id,
              user_id: userId
            });
          
          if (insertError) throw insertError;
          return true;
        }
      }
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
