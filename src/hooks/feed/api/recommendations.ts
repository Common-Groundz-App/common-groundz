
import { supabase } from '@/integrations/supabase/client';
import { FeedQueryParams, RecommendationFeedItem } from '../types';
import { fetchMultipleProfiles } from '@/services/enhancedProfileService';
import { RecommendationCategory } from '@/services/recommendation/types';

// Helper function to map database category strings to RecommendationCategory enum
const mapDatabaseCategoryToEnum = (dbCategory: string): RecommendationCategory => {
  switch (dbCategory.toLowerCase()) {
    case 'food': return RecommendationCategory.Food;
    case 'drink': return RecommendationCategory.Drink;
    case 'movie': return RecommendationCategory.Movie;
    case 'book': return RecommendationCategory.Book;
    case 'place': return RecommendationCategory.Place;
    case 'product': return RecommendationCategory.Product;
    case 'activity': return RecommendationCategory.Activity;
    case 'music': return RecommendationCategory.Music;
    case 'art': return RecommendationCategory.Art;
    case 'tv': return RecommendationCategory.TV;
    case 'travel': return RecommendationCategory.Travel;
    default: return RecommendationCategory.Place; // fallback
  }
};

export const fetchRecommendations = async (params: FeedQueryParams): Promise<RecommendationFeedItem[]> => {
  try {
    const { data: recommendations, error } = await supabase
      .from('recommendations')
      .select(`
        id,
        title,
        description,
        entity_id,
        rating,
        user_id,
        created_at,
        updated_at,
        visibility,
        category,
        is_certified,
        view_count,
        venue,
        image_url,
        entities:entity_id(*)
      `)
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .range(params.page * params.itemsPerPage, (params.page + 1) * params.itemsPerPage - 1);

    if (error) throw error;
    if (!recommendations?.length) return [];

    // Get unique user IDs
    const userIds = [...new Set(recommendations.map(rec => rec.user_id))];
    
    // Fetch all profiles at once using enhanced service
    const profilesMap = await fetchMultipleProfiles(userIds);

    // Get recommendation IDs for fetching interactions
    const recommendationIds = recommendations.map(rec => rec.id);

    // Fetch likes count
    const { data: likesData } = await supabase
      .from('recommendation_likes')
      .select('recommendation_id')
      .in('recommendation_id', recommendationIds);

    const likesCount = new Map<string, number>();
    likesData?.forEach(like => {
      const current = likesCount.get(like.recommendation_id) || 0;
      likesCount.set(like.recommendation_id, current + 1);
    });

    // Fetch user's likes and saves if user is provided
    let userLikes = new Set<string>();
    let userSaves = new Set<string>();
    
    if (params.userId) {
      const [likesResult, savesResult] = await Promise.all([
        supabase
          .from('recommendation_likes')
          .select('recommendation_id')
          .eq('user_id', params.userId)
          .in('recommendation_id', recommendationIds),
        supabase
          .from('recommendation_saves')
          .select('recommendation_id')
          .eq('user_id', params.userId)
          .in('recommendation_id', recommendationIds)
      ]);

      userLikes = new Set(likesResult.data?.map(l => l.recommendation_id) || []);
      userSaves = new Set(savesResult.data?.map(s => s.recommendation_id) || []);
    }

    // Fetch comments count
    const { data: commentsData } = await supabase
      .from('recommendation_comments')
      .select('recommendation_id')
      .in('recommendation_id', recommendationIds)
      .eq('is_deleted', false);

    const commentsCount = new Map<string, number>();
    commentsData?.forEach(comment => {
      const current = commentsCount.get(comment.recommendation_id) || 0;
      commentsCount.set(comment.recommendation_id, current + 1);
    });

    // Process recommendations with profile data
    const processedRecommendations: RecommendationFeedItem[] = recommendations.map(rec => {
      const profile = profilesMap[rec.user_id];
      
      return {
        ...rec,
        category: mapDatabaseCategoryToEnum(rec.category), // Convert database category to enum
        is_post: false,
        username: profile?.displayName || profile?.username || null,
        avatar_url: profile?.avatar_url || null,
        likes: likesCount.get(rec.id) || 0,
        comment_count: commentsCount.get(rec.id) || 0,
        is_liked: userLikes.has(rec.id),
        is_saved: userSaves.has(rec.id),
        entity: rec.entities || null
      };
    });

    return processedRecommendations;
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    throw error;
  }
};

// Export the processing function for use by feed.ts
export const processRecommendations = async (
  recsData: any[], 
  userId: string
): Promise<RecommendationFeedItem[]> => {
  if (!recsData.length) return [];
  
  try {
    // Get unique user IDs
    const userIds = [...new Set(recsData.map(rec => rec.user_id))];
    
    // Fetch all profiles at once using enhanced service
    const profilesMap = await fetchMultipleProfiles(userIds);

    // Get recommendation IDs for fetching interactions
    const recommendationIds = recsData.map(rec => rec.id);

    // Fetch likes count
    const { data: likesData } = await supabase
      .from('recommendation_likes')
      .select('recommendation_id')
      .in('recommendation_id', recommendationIds);

    const likesCount = new Map<string, number>();
    likesData?.forEach(like => {
      const current = likesCount.get(like.recommendation_id) || 0;
      likesCount.set(like.recommendation_id, current + 1);
    });

    // Fetch user's likes and saves if user is provided
    let userLikes = new Set<string>();
    let userSaves = new Set<string>();
    
    if (userId) {
      const [likesResult, savesResult] = await Promise.all([
        supabase
          .from('recommendation_likes')
          .select('recommendation_id')
          .eq('user_id', userId)
          .in('recommendation_id', recommendationIds),
        supabase
          .from('recommendation_saves')
          .select('recommendation_id')
          .eq('user_id', userId)
          .in('recommendation_id', recommendationIds)
      ]);

      userLikes = new Set(likesResult.data?.map(l => l.recommendation_id) || []);
      userSaves = new Set(savesResult.data?.map(s => s.recommendation_id) || []);
    }

    // Fetch comments count
    const { data: commentsData } = await supabase
      .from('recommendation_comments')
      .select('recommendation_id')
      .in('recommendation_id', recommendationIds)
      .eq('is_deleted', false);

    const commentsCount = new Map<string, number>();
    commentsData?.forEach(comment => {
      const current = commentsCount.get(comment.recommendation_id) || 0;
      commentsCount.set(comment.recommendation_id, current + 1);
    });

    // Process recommendations with profile data - ensure all required FeedItem properties are included
    const processedRecommendations: RecommendationFeedItem[] = recsData.map(rec => {
      const profile = profilesMap[rec.user_id];
      
      return {
        ...rec, // This spreads all original recommendation properties including category, is_certified, view_count
        category: mapDatabaseCategoryToEnum(rec.category), // Convert database category to enum
        is_post: false,
        username: profile?.displayName || profile?.username || null,
        avatar_url: profile?.avatar_url || null,
        likes: likesCount.get(rec.id) || 0,
        comment_count: commentsCount.get(rec.id) || 0,
        is_liked: userLikes.has(rec.id),
        is_saved: userSaves.has(rec.id),
        entity: rec.entities || null
      };
    });

    return processedRecommendations;
  } catch (error) {
    console.error('Error processing recommendations:', error);
    throw error;
  }
};
