import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { Recommendation } from '../recommendation/types';

export const fetchUserRecommendations = async (userId: string): Promise<Recommendation[]> => {
  try {
    const { data: recommendations, error } = await supabase
      .from('recommendations')
      .select(`
        id,
        user_id,
        title,
        subtitle,
        description,
        image_url,
        category,
        rating,
        venue,
        entity_id,
        visibility,
        is_certified,
        view_count,
        created_at,
        updated_at,
        comment_count,
        likes: recommendation_likes(count),
        isLiked: recommendation_likes(
          exists(recommendation_id)
        ),
        isSaved: recommendation_saves(
          exists(recommendation_id)
        ),
        media,
        username: profiles (username),
        avatar_url: profiles (avatar_url)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching recommendations:', error);
      throw error;
    }

    // Type check to ensure recommendations is not null before mapping
    if (!recommendations) {
      console.warn('No recommendations found for user:', userId);
      return [];
    }

    // Map the Supabase data to the Recommendation type
    return recommendations.map(rec => ({
      id: rec.id,
      user_id: rec.user_id,
      title: rec.title,
      subtitle: rec.subtitle,
      description: rec.description,
      image_url: rec.image_url,
      category: rec.category,
      rating: rec.rating,
      venue: rec.venue,
      entity_id: rec.entity_id,
      visibility: rec.visibility,
      is_certified: rec.is_certified,
      view_count: rec.view_count,
      created_at: rec.created_at,
      updated_at: rec.updated_at,
      comment_count: rec.comment_count,
      likes: rec.likes ? rec.likes[0]?.count : 0,
      isLiked: rec.isLiked ? rec.isLiked[0]?.exists : false,
      isSaved: rec.isSaved ? rec.isSaved[0]?.exists : false,
      media: rec.media,
      username: rec.username?.username || null,
      avatar_url: rec.avatar_url?.avatar_url || null,
    }));
  } catch (error) {
    console.error('Error in fetchUserRecommendations:', error);
    return [];
  }
};
