
import { supabase } from '@/integrations/supabase/client';
import { FeedQueryParams } from '../../types';

export interface PostsQueryResult {
  posts: any[];
}

export const fetchPosts = async ({ userId, page, itemsPerPage }: FeedQueryParams): Promise<PostsQueryResult> => {
  try {
    const { data: posts, error } = await supabase
      .from('posts')
      .select(`
        id,
        title,
        content,
        post_type,
        visibility,
        view_count,
        comment_count,
        tags,
        media,
        status,
        user_id,
        created_at,
        updated_at
      `)
      .eq('visibility', 'public')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(page * itemsPerPage, (page + 1) * itemsPerPage - 1);

    if (error) throw error;

    return {
      posts: posts || []
    };
  } catch (error) {
    console.error('Error fetching posts:', error);
    throw error;
  }
};
