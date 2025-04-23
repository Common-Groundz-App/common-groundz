
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const usePostInteractions = (initialPost: any, userId: string | undefined) => {
  const [post, setPost] = useState<any>(initialPost);

  const handlePostLike = async () => {
    if (!userId || !post) return;
    
    try {
      if (post.is_liked) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', userId);
        
        setPost({
          ...post,
          is_liked: false,
          likes: post.likes - 1
        });
      } else {
        await supabase
          .from('post_likes')
          .insert({ post_id: post.id, user_id: userId });
        
        setPost({
          ...post,
          is_liked: true,
          likes: post.likes + 1
        });
      }
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };
  
  const handlePostSave = async () => {
    if (!userId || !post) return;
    
    try {
      if (post.is_saved) {
        await supabase
          .from('post_saves')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', userId);
        
        setPost({
          ...post,
          is_saved: false
        });
      } else {
        await supabase
          .from('post_saves')
          .insert({ post_id: post.id, user_id: userId });
        
        setPost({
          ...post,
          is_saved: true
        });
      }
    } catch (err) {
      console.error('Error toggling save:', err);
    }
  };
  
  const handleDelete = (deletedId: string) => {
    if (deletedId === post.id) {
      return true; // Indicates the post has been deleted
    }
    return false;
  };
  
  return { post, handlePostLike, handlePostSave, handleDelete };
};

export const useRecommendationInteractions = (initialRecommendation: any, userId: string | undefined) => {
  const [recommendation, setRecommendation] = useState<any>(initialRecommendation);

  const handleRecommendationLike = async () => {
    if (!userId || !recommendation) return;
    
    try {
      if (recommendation.isLiked) {
        await supabase
          .from('recommendation_likes')
          .delete()
          .eq('recommendation_id', recommendation.id)
          .eq('user_id', userId);
        
        setRecommendation({
          ...recommendation,
          isLiked: false,
          likes: recommendation.likes - 1
        });
      } else {
        await supabase
          .from('recommendation_likes')
          .insert({ recommendation_id: recommendation.id, user_id: userId });
        
        setRecommendation({
          ...recommendation,
          isLiked: true,
          likes: recommendation.likes + 1
        });
      }
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };
  
  const handleRecommendationSave = async () => {
    if (!userId || !recommendation) return;
    
    try {
      if (recommendation.isSaved) {
        await supabase
          .from('recommendation_saves')
          .delete()
          .eq('recommendation_id', recommendation.id)
          .eq('user_id', userId);
        
        setRecommendation({
          ...recommendation,
          isSaved: false
        });
      } else {
        await supabase
          .from('recommendation_saves')
          .insert({ recommendation_id: recommendation.id, user_id: userId });
        
        setRecommendation({
          ...recommendation,
          isSaved: true
        });
      }
    } catch (err) {
      console.error('Error toggling save:', err);
    }
  };
  
  return { recommendation, handleRecommendationLike, handleRecommendationSave };
};
