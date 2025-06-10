
import { supabase } from '@/integrations/supabase/client';

export interface AdminReview {
  id: string;
  title: string;
  user_id: string;
  timeline_count: number;
  has_timeline: boolean;
  ai_summary: string | null;
  ai_summary_last_generated_at: string | null;
  ai_summary_model_used: string | null;
  created_at: string;
  user?: {
    username: string;
    avatar_url: string;
  };
}

export interface AdminEntity {
  id: string;
  name: string;
  type: string;
  review_count: number;
  has_entity_summary: boolean;
  last_summary_generated: string | null;
  summary_model_used: string | null;
}

export interface AdminAnalytics {
  total_reviews: number;
  total_entities: number;
  reviews_with_ai_summary: number;
  entities_with_dynamic_reviews: number;
  recent_ai_generations: number;
}

export const checkAdminAccess = async (): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return false;
    
    const { data, error } = await supabase.rpc('is_admin_user', {
      user_email: user.email
    });
    
    if (error) {
      console.error('Error checking admin access:', error);
      return false;
    }
    
    return data || false;
  } catch (error) {
    console.error('Error in checkAdminAccess:', error);
    return false;
  }
};

export const fetchAdminReviews = async (): Promise<AdminReview[]> => {
  try {
    const { data: reviews, error: reviewsError } = await supabase
      .from('reviews')
      .select('*')
      .eq('has_timeline', true)
      .order('created_at', { ascending: false });

    if (reviewsError) {
      console.error('Error fetching admin reviews:', reviewsError);
      return [];
    }

    if (!reviews?.length) return [];

    const userIds = [...new Set(reviews.map(r => r.user_id))];
    
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', userIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    }

    return reviews.map(review => ({
      ...review,
      user: profiles?.find(p => p.id === review.user_id) ? {
        username: profiles.find(p => p.id === review.user_id)?.username || 'Unknown',
        avatar_url: profiles.find(p => p.id === review.user_id)?.avatar_url || ''
      } : undefined
    }));
  } catch (error) {
    console.error('Error in fetchAdminReviews:', error);
    return [];
  }
};

export const fetchAdminEntities = async (): Promise<AdminEntity[]> => {
  try {
    const { data, error } = await supabase
      .from('entities')
      .select(`
        id,
        name,
        type,
        reviews!inner(id)
      `)
      .eq('reviews.has_timeline', true)
      .eq('is_deleted', false);

    if (error) {
      console.error('Error fetching admin entities:', error);
      return [];
    }

    // Process the data to get entity info with review counts
    const entityMap = new Map();
    
    data?.forEach(item => {
      if (!entityMap.has(item.id)) {
        entityMap.set(item.id, {
          id: item.id,
          name: item.name,
          type: item.type,
          review_count: 0,
          has_entity_summary: false,
          last_summary_generated: null,
          summary_model_used: null
        });
      }
      entityMap.get(item.id).review_count++;
    });

    return Array.from(entityMap.values());
  } catch (error) {
    console.error('Error in fetchAdminEntities:', error);
    return [];
  }
};

export const fetchAdminAnalytics = async (): Promise<AdminAnalytics | null> => {
  try {
    const { data, error } = await supabase.rpc('get_admin_analytics');
    
    if (error) {
      console.error('Error fetching admin analytics:', error);
      return null;
    }
    
    return data?.[0] || null;
  } catch (error) {
    console.error('Error in fetchAdminAnalytics:', error);
    return null;
  }
};

export const generateReviewAISummary = async (reviewId: string): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Log admin action
    await supabase.from('admin_actions').insert({
      admin_user_id: user.id,
      action_type: 'generate_ai_summary',
      target_type: 'review',
      target_id: reviewId,
      details: { timestamp: new Date().toISOString() }
    });

    // Call the existing AI summary generation edge function
    const response = await fetch('https://uyjtgybbktgapspodajy.supabase.co/functions/v1/generate-ai-summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ reviewId })
    });

    return response.ok;
  } catch (error) {
    console.error('Error generating AI summary:', error);
    return false;
  }
};

export const generateEntityAISummary = async (entityId: string): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Log admin action
    await supabase.from('admin_actions').insert({
      admin_user_id: user.id,
      action_type: 'generate_entity_summary',
      target_type: 'entity',
      target_id: entityId,
      details: { timestamp: new Date().toISOString() }
    });

    // For now, this is a placeholder - we'll implement entity summary generation later
    console.log('Entity AI summary generation requested for:', entityId);
    return true;
  } catch (error) {
    console.error('Error generating entity AI summary:', error);
    return false;
  }
};
