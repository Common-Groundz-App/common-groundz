
import { supabase } from '@/integrations/supabase/client';
import { HomeQueryParams, FeedItem, RecommendationFeedItem } from '../types';

// Fetch recommendations with pagination
export const fetchRecommendations = async (
  { userId, page, itemsPerPage }: HomeQueryParams,
  followingIds?: string[] // Optional parameter to filter by following users
): Promise<{ recommendations: any[] }> => {
  try {
    const from = page * itemsPerPage;
    const to = from + itemsPerPage - 1;
    
    let query = supabase
      .from('recommendations')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to);
      
    // If followingIds are provided, filter recommendations by those users
    if (followingIds && followingIds.length > 0) {
      query = query.in('user_id', followingIds);
    } else {
      // If no followingIds are provided, fetch only public recommendations
      query = query.eq('visibility', 'public');
    }
    
    const { data: recommendations, error } = await query;

    if (error) {
      console.error("Error fetching recommendations:", error);
      throw error;
    }

    return { recommendations: recommendations || [] };
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    throw error;
  }
};

// Process recommendations to include like/save status, user info, etc.
export const processRecommendations = async (
  recommendations: any[], 
  userId: string
): Promise<RecommendationFeedItem[]> => {
  if (!recommendations || recommendations.length === 0) {
    return [];
  }

  try {
    // Fetch user profiles for the recommendations
    const userIds = recommendations.map(rec => rec.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    const profilesMap = new Map(profiles.map(profile => [profile.id, profile]));

    // Fetch like and save status for the current user
    const { data: likes, error: likesError } = await supabase
      .from('recommendation_likes')
      .select('recommendation_id')
      .in('recommendation_id', recommendations.map(rec => rec.id))
      .eq('user_id', userId);

    if (likesError) {
      console.error("Error fetching likes:", likesError);
      throw likesError;
    }

    const likedRecommendationIds = new Set(likes.map(like => like.recommendation_id));

    const { data: saves, error: savesError } = await supabase
      .from('recommendation_saves')
      .select('recommendation_id')
      .in('recommendation_id', recommendations.map(rec => rec.id))
      .eq('user_id', userId);

    if (savesError) {
      console.error("Error fetching saves:", savesError);
      throw savesError;
    }

    const savedRecommendationIds = new Set(saves.map(save => save.recommendation_id));
    
    // Use a raw SQL query to count comments since the group() method isn't available
    const { data: commentCounts, error: commentCountsError } = await supabase
      .from('recommendation_comments')
      .select('recommendation_id, count', { count: 'exact' })
      .in('recommendation_id', recommendations.map(rec => rec.id))
      .eq('is_deleted', false);
      
    if (commentCountsError) {
      console.error("Error fetching comment counts:", commentCountsError);
    }
    
    // Create a Map to store comment counts
    const commentCountsMap = new Map();
    
    // If using the SQL function doesn't work, we can count them manually
    if (!commentCounts) {
      // Fetch all comments for the recommendations
      const { data: allComments } = await supabase
        .from('recommendation_comments')
        .select('recommendation_id')
        .in('recommendation_id', recommendations.map(rec => rec.id))
        .eq('is_deleted', false);
        
      if (allComments) {
        // Count comments for each recommendation
        const countMap = new Map();
        allComments.forEach(comment => {
          const recId = comment.recommendation_id;
          countMap.set(recId, (countMap.get(recId) || 0) + 1);
        });
        
        // Set the comment counts
        recommendations.forEach(rec => {
          commentCountsMap.set(rec.id, countMap.get(rec.id) || 0);
        });
      }
    } else {
      // Use the comment counts from the SQL function
      commentCounts.forEach((item: any) => {
        commentCountsMap.set(item.recommendation_id, parseInt(item.count));
      });
    }

    // Combine all the data
    const processedRecommendations: RecommendationFeedItem[] = recommendations.map(rec => {
      const profile = profilesMap.get(rec.user_id);
      const commentCount = commentCountsMap.get(rec.id) || 0;

      return {
        ...rec,
        likes: rec.likes || 0,
        is_liked: likedRecommendationIds.has(rec.id),
        is_saved: savedRecommendationIds.has(rec.id),
        username: profile?.username || 'Unknown User',
        avatar_url: profile?.avatar_url || null,
        comment_count: commentCount
      };
    });

    return processedRecommendations;
  } catch (error) {
    console.error("Error processing recommendations:", error);
    return [];
  }
};
