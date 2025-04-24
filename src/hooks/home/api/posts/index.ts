
import { HomeQueryParams } from '../../types';
import { fetchPosts } from './fetch-posts';
import { processPosts } from './processor';

// Re-export main functions for external use
export {
  fetchPosts,
  processPosts
};

// Convenience function to fetch and process posts in one call
export const fetchAndProcessPosts = async (params: HomeQueryParams, followingIds?: string[]) => {
  const { posts } = await fetchPosts(params, followingIds);
  return await processPosts(posts, params.userId);
};
