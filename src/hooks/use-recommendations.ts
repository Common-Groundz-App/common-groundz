
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  Recommendation,
  fetchRecommendationWithLikesAndSaves,
  createRecommendation,
  updateRecommendation,
  deleteRecommendation,
  toggleLike,
  toggleSave,
  uploadRecommendationImage
} from '@/services/recommendationService';

interface UseRecommendationsProps {
  profileUserId: string;
}

export const useRecommendations = ({ profileUserId }: UseRecommendationsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'latest' | 'highestRated' | 'mostLiked'>('latest');
  
  // Fetch recommendations
  const fetchRecommendations = async () => {
    try {
      setIsLoading(true);
      const data = await fetchRecommendationWithLikesAndSaves(
        user?.id || '', 
        profileUserId
      );
      setRecommendations(data as Recommendation[]);
      setError(null);
    } catch (err) {
      console.error('Error in useRecommendations:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch recommendations'));
      toast({
        title: 'Error',
        description: 'Failed to load recommendations. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (profileUserId) {
      fetchRecommendations();
    }
  }, [profileUserId, user?.id]);

  // Filter and sort recommendations
  const filteredRecommendations = recommendations
    .filter(item => !activeFilter || item.category === activeFilter)
    .sort((a, b) => {
      if (sortBy === 'latest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else if (sortBy === 'highestRated') {
        return b.rating - a.rating;
      } else if (sortBy === 'mostLiked') {
        return (b.likes || 0) - (a.likes || 0);
      }
      return 0;
    });

  // Handle like action
  const handleLike = async (id: string) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to like recommendations',
        variant: 'destructive'
      });
      return;
    }

    try {
      const item = recommendations.find(r => r.id === id);
      if (!item) return;

      // Optimistic update
      setRecommendations(prev => 
        prev.map(item => {
          if (item.id === id) {
            const isLiked = !item.isLiked;
            return {
              ...item,
              isLiked,
              likes: (item.likes || 0) + (isLiked ? 1 : -1)
            };
          }
          return item;
        })
      );

      // Server update
      await toggleLike(id, user.id, !!item.isLiked);
    } catch (err) {
      console.error('Error toggling like:', err);
      // Revert on failure
      fetchRecommendations();
      toast({
        title: 'Error',
        description: 'Failed to update like status. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Handle save action
  const handleSave = async (id: string) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to save recommendations',
        variant: 'destructive'
      });
      return;
    }

    try {
      const item = recommendations.find(r => r.id === id);
      if (!item) return;

      // Optimistic update
      setRecommendations(prev => 
        prev.map(item => {
          if (item.id === id) {
            return {
              ...item,
              isSaved: !item.isSaved
            };
          }
          return item;
        })
      );

      // Server update
      await toggleSave(id, user.id, !!item.isSaved);
    } catch (err) {
      console.error('Error toggling save:', err);
      // Revert on failure
      fetchRecommendations();
      toast({
        title: 'Error',
        description: 'Failed to update save status. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Handle image upload
  const handleImageUpload = async (file: File) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to upload images',
        variant: 'destructive'
      });
      return null;
    }

    try {
      // Check file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload an image file',
          variant: 'destructive'
        });
        return null;
      }

      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Image size should be less than 5MB',
          variant: 'destructive'
        });
        return null;
      }

      // Upload image
      const imageUrl = await uploadRecommendationImage(user.id, file);
      
      toast({
        title: 'Image uploaded',
        description: 'Image has been uploaded successfully'
      });
      
      return imageUrl;
    } catch (err) {
      console.error('Error uploading image:', err);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload image. Please try again.',
        variant: 'destructive'
      });
      return null;
    }
  };

  // Add recommendation
  const addRecommendation = async (recommendation: Omit<Recommendation, 'id' | 'created_at' | 'updated_at' | 'user_id' | 'likes' | 'isLiked' | 'isSaved'>) => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to add recommendations',
        variant: 'destructive'
      });
      return null;
    }

    try {
      const newRecommendation = await createRecommendation({
        ...recommendation,
        user_id: user.id,
      });
      
      // Refresh the list
      fetchRecommendations();
      
      toast({
        title: 'Success',
        description: 'Recommendation has been added successfully'
      });
      
      return newRecommendation;
    } catch (err) {
      console.error('Error adding recommendation:', err);
      toast({
        title: 'Error',
        description: 'Failed to add recommendation. Please try again.',
        variant: 'destructive'
      });
      return null;
    }
  };

  return {
    recommendations: filteredRecommendations,
    isLoading,
    error,
    activeFilter,
    setActiveFilter,
    sortBy,
    setSortBy,
    handleLike,
    handleSave,
    handleImageUpload,
    addRecommendation,
    refreshRecommendations: fetchRecommendations,
    clearFilters: () => {
      setActiveFilter(null);
      setSortBy('latest');
    }
  };
};
