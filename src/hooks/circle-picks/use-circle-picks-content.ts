
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CirclePicksItem, CirclePicksFilters } from '@/types/circle-picks';

interface UseCirclePicksContentProps {
  followedUserIds: string[];
  filters: CirclePicksFilters;
}

export const useCirclePicksContent = ({ followedUserIds, filters }: UseCirclePicksContentProps) => {
  const { user } = useAuth();
  const [items, setItems] = useState<CirclePicksItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchContent = async () => {
      if (!user || followedUserIds.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const allItems: CirclePicksItem[] = [];

        // Fetch recommendations with better error handling
        try {
          const { data: recommendations, error: recError } = await supabase
            .from('recommendations')
            .select('*')
            .in('user_id', followedUserIds)
            .eq('visibility', 'public');

          if (recError) {
            console.warn('Error fetching recommendations:', recError);
          } else if (recommendations) {
            // Get user profiles for recommendations
            const recUserIds = recommendations.map(r => r.user_id);
            const uniqueRecUserIds = [...new Set(recUserIds)];

            const { data: recProfiles } = await supabase
              .from('profiles')
              .select('id, username, avatar_url')
              .in('id', uniqueRecUserIds);

            // Transform recommendations
            recommendations.forEach(rec => {
              const profile = recProfiles?.find(p => p.id === rec.user_id);
              if (profile) {
                allItems.push({
                  id: rec.id,
                  type: 'recommendation',
                  title: rec.title,
                  content: rec.description,
                  rating: Number(rec.rating),
                  category: rec.category.toLowerCase(),
                  imageUrl: rec.image_url,
                  entityName: rec.title,
                  entityType: rec.category.toLowerCase(),
                  createdAt: rec.created_at,
                  updatedAt: rec.updated_at,
                  likesCount: 0,
                  commentsCount: rec.comment_count || 0,
                  isLiked: false,
                  isSaved: false,
                  author: {
                    id: profile.id,
                    username: profile.username || 'Unknown User',
                    fullName: profile.username || 'Unknown User',
                    avatarUrl: profile.avatar_url
                  }
                });
              }
            });
          }
        } catch (recErr) {
          console.warn('Failed to fetch recommendations:', recErr);
        }

        // Fetch reviews with better error handling
        try {
          const { data: reviews, error: reviewError } = await supabase
            .from('reviews')
            .select('*')
            .in('user_id', followedUserIds)
            .eq('visibility', 'public');

          if (reviewError) {
            console.warn('Error fetching reviews:', reviewError);
          } else if (reviews) {
            // Get user profiles for reviews
            const reviewUserIds = reviews.map(r => r.user_id);
            const uniqueReviewUserIds = [...new Set(reviewUserIds)];

            const { data: reviewProfiles } = await supabase
              .from('profiles')
              .select('id, username, avatar_url')
              .in('id', uniqueReviewUserIds);

            // Transform reviews
            reviews.forEach(review => {
              const profile = reviewProfiles?.find(p => p.id === review.user_id);
              if (profile) {
                allItems.push({
                  id: review.id,
                  type: 'review',
                  title: review.title,
                  content: review.description,
                  rating: review.rating,
                  category: review.category.toLowerCase(),
                  imageUrl: review.image_url,
                  entityName: review.title,
                  entityType: review.category.toLowerCase(),
                  createdAt: review.created_at,
                  updatedAt: review.updated_at,
                  likesCount: 0,
                  commentsCount: 0,
                  isLiked: false,
                  isSaved: false,
                  author: {
                    id: profile.id,
                    username: profile.username || 'Unknown User',
                    fullName: profile.username || 'Unknown User',
                    avatarUrl: profile.avatar_url
                  }
                });
              }
            });
          }
        } catch (reviewErr) {
          console.warn('Failed to fetch reviews:', reviewErr);
        }

        // Apply filters
        let filteredItems = allItems;

        // Category filter
        if (filters.category !== 'all') {
          filteredItems = filteredItems.filter(item => item.category === filters.category);
        }

        // Sort items
        filteredItems.sort((a, b) => {
          switch (filters.sortBy) {
            case 'newest':
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            case 'oldest':
              return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            case 'highest-rated':
              return (b.rating || 0) - (a.rating || 0);
            case 'most-liked':
              return b.likesCount - a.likesCount;
            default:
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          }
        });

        setItems(filteredItems);
      } catch (err) {
        console.error('Error fetching circle picks content:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch content');
        setItems([]); // Set empty array on error
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [user, followedUserIds, filters]);

  return {
    items,
    loading,
    error,
    refetch: () => {
      if (user && followedUserIds.length > 0) {
        setLoading(true);
        setError(null);
        // The useEffect will handle the refetch
      }
    }
  };
};
