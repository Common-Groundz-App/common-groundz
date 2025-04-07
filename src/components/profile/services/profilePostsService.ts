
import { supabase } from '@/integrations/supabase/client';
import { Entity } from '@/services/recommendation/types';
import { MediaItem } from '@/types/media';

export interface Post {
  id: string;
  title: string;
  content: string;
  post_type: 'story' | 'routine' | 'project' | 'note';
  visibility: 'public' | 'circle_only' | 'private';
  created_at: string;
  updated_at: string;
  tagged_entities?: Entity[];
  media?: MediaItem[];
}

export const fetchUserPosts = async (profileUserId: string, isOwnProfile: boolean) => {
  try {
    let query = supabase
      .from('posts')
      .select('*')
      .eq('user_id', profileUserId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    // If not own profile, only show public posts
    if (!isOwnProfile) {
      query = query.eq('visibility', 'public');
    }

    const { data: postsData, error } = await query;

    if (error) throw error;
    
    // Fetch entities for all posts using our custom function
    const postIds = (postsData || []).map(post => post.id);
    
    if (postIds.length > 0) {
      const entitiesByPostId: Record<string, Entity[]> = {};
      
      // Cast supabase to any to bypass TypeScript's type checking
      const supabaseAny = supabase as any;
      
      const { data: entityData } = await supabaseAny
        .rpc('get_post_entities', {
          post_ids: postIds
        });
      
      if (entityData) {
        // Process the relationships
        entityData.forEach((item: any) => {
          if (!entitiesByPostId[item.post_id]) {
            entitiesByPostId[item.post_id] = [];
          }
          entitiesByPostId[item.post_id].push(item.entity);
        });
      }
      
      // Add entities to posts
      const enrichedPosts = (postsData || []).map(post => {
        // Process media properly with type safety
        let mediaItems: MediaItem[] | undefined;
        
        if (post.media && Array.isArray(post.media)) {
          // Map each item in the media array to ensure it conforms to MediaItem structure
          mediaItems = post.media.map((item: any): MediaItem => ({
            url: item.url || '',
            type: item.type || 'image',
            caption: item.caption,
            alt: item.alt,
            order: item.order || 0,
            thumbnail_url: item.thumbnail_url,
            is_deleted: item.is_deleted,
            session_id: item.session_id,
            id: item.id
          }));
        }

        return {
          ...post,
          tagged_entities: entitiesByPostId[post.id] || [],
          media: mediaItems
        };
      });
      
      return enrichedPosts as Post[];
    } else {
      return (postsData || []).map(post => {
        // Process media properly for posts without entities
        let mediaItems: MediaItem[] | undefined;
        
        if (post.media && Array.isArray(post.media)) {
          // Map each item in the media array to ensure it conforms to MediaItem structure
          mediaItems = post.media.map((item: any): MediaItem => ({
            url: item.url || '',
            type: item.type || 'image',
            caption: item.caption,
            alt: item.alt,
            order: item.order || 0,
            thumbnail_url: item.thumbnail_url,
            is_deleted: item.is_deleted,
            session_id: item.session_id,
            id: item.id
          }));
        }

        return {
          ...post,
          media: mediaItems
        };
      }) as Post[];
    }
  } catch (error) {
    console.error('Error in fetchUserPosts:', error);
    throw error;
  }
};
