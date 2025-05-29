
import { useState } from 'react';
import { CirclePicksFilters } from '@/types/circle-picks';
import { useFollowedUsers } from './use-followed-users';
import { useCirclePicksContent } from './use-circle-picks-content';

export const useCirclePicks = () => {
  const [filters, setFilters] = useState<CirclePicksFilters>({
    category: 'all',
    sortBy: 'newest'
  });

  const { 
    followedUsers, 
    loading: followedUsersLoading, 
    error: followedUsersError 
  } = useFollowedUsers();

  const followedUserIds = followedUsers.map(user => user.id);

  const { 
    items, 
    loading: contentLoading, 
    error: contentError 
  } = useCirclePicksContent({ followedUserIds, filters });

  const updateFilters = (newFilters: Partial<CirclePicksFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  return {
    items,
    followedUsers,
    filters,
    loading: followedUsersLoading || contentLoading,
    error: followedUsersError || contentError,
    updateFilters,
    followedCount: followedUsers.length
  };
};
