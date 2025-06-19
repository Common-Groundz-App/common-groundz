
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { useFollow } from '@/hooks/use-follow';
import { useToast } from '@/hooks/use-toast';
import { UserCheck, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useVirtualScroll } from '@/hooks/useVirtualScroll';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';

type User = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  recommendation_count: number;
  follower_count: number;
  is_following: boolean;
};

interface VirtualUserDirectoryListProps {
  sortOption: string;
}

const ITEM_HEIGHT = 140; // Approximate height of each user card
const CONTAINER_HEIGHT = 600; // Height of the scrollable container

export const VirtualUserDirectoryList = ({ sortOption }: VirtualUserDirectoryListProps) => {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const { startRender, endRender } = usePerformanceMonitor('VirtualUserDirectoryList');
  
  const { scrollElementRef, visibleItems, totalHeight, offsetY } = useVirtualScroll(
    allUsers,
    {
      itemHeight: ITEM_HEIGHT,
      containerHeight: CONTAINER_HEIGHT,
      overscan: 5
    }
  );

  useEffect(() => {
    startRender();
    const fetchUsers = async () => {
      try {
        setLoading(true);
        
        let query = supabase
          .from('profiles')
          .select(`
            id, 
            username, 
            avatar_url, 
            bio
          `);
          
        if (currentUser) {
          query = query.neq('id', currentUser.id);
        }
          
        if (sortOption === 'recent') {
          query = query.order('created_at', { ascending: false });
        }
        
        query = query.limit(100); // Increased for virtual scrolling
        
        const { data, error } = await query;
        
        if (error) throw error;
        if (!data) return;
        
        const userIds = data.map(user => user.id);
        let recommendationCountsMap = new Map();
        let followerCountsMap = new Map();
        let followingData: any[] = [];
        
        // Get recommendation counts
        const { data: recommendationData } = await supabase
          .from('recommendations')
          .select('user_id, id')
          .in('user_id', userIds);
          
        if (recommendationData) {
          recommendationData.forEach(item => {
            const count = recommendationCountsMap.get(item.user_id) || 0;
            recommendationCountsMap.set(item.user_id, count + 1);
          });
        }
        
        // Get follower counts
        const { data: followerData } = await supabase
          .from('follows')
          .select('following_id')
          .in('following_id', userIds);
          
        if (followerData) {
          followerData.forEach(item => {
            const count = followerCountsMap.get(item.following_id) || 0;
            followerCountsMap.set(item.following_id, count + 1);
          });
        }
        
        // Check following status
        if (currentUser) {
          const { data: following } = await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', currentUser.id)
            .in('following_id', userIds);
            
          followingData = following || [];
        }
        
        const enhancedUsers = data.map(user => ({
          ...user,
          recommendation_count: recommendationCountsMap.get(user.id) || 0,
          follower_count: followerCountsMap.get(user.id) || 0,
          is_following: followingData.some(f => f.following_id === user.id)
        }));
        
        let sortedUsers = [...enhancedUsers];
        
        if (sortOption === 'popular') {
          sortedUsers.sort((a, b) => b.follower_count - a.follower_count);
        } else if (sortOption === 'active') {
          sortedUsers.sort((a, b) => b.recommendation_count - a.recommendation_count);
        }
        
        setAllUsers(sortedUsers);
      } catch (error) {
        console.error('Error fetching users:', error);
        toast({
          title: 'Error',
          description: 'Failed to load users. Please try again.',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
        endRender();
      }
    };
    
    fetchUsers();
  }, [currentUser, sortOption, toast, startRender, endRender]);
  
  const handleFollowToggle = async (userId: string, isFollowing: boolean) => {
    if (!currentUser) return;
    
    try {
      const followHook = useFollow(userId);
      await followHook.handleFollowToggle();
      
      setAllUsers(prev => 
        prev.map(user => {
          if (user.id === userId) {
            return {
              ...user,
              is_following: !isFollowing,
              follower_count: isFollowing 
                ? user.follower_count - 1 
                : user.follower_count + 1
            };
          }
          return user;
        })
      );
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast({
        title: 'Error',
        description: 'Failed to update follow status. Please try again.',
        variant: 'destructive'
      });
    }
  };
  
  const getInitials = (username: string | null) => {
    if (!username) return 'U';
    return username.charAt(0).toUpperCase();
  };
  
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array(6).fill(0).map((_, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-24 mb-1" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
              <Skeleton className="h-4 w-full mt-3" />
              <div className="flex justify-between items-center mt-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-9 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  if (allUsers.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-muted-foreground">No users found. Try changing the filters.</p>
      </div>
    );
  }
  
  return (
    <div 
      ref={scrollElementRef}
      className="overflow-auto"
      style={{ height: CONTAINER_HEIGHT }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleItems.map(({ item: user, index }) => (
              <Card key={user.id} style={{ height: ITEM_HEIGHT }}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback>{getInitials(user.username)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <Link to={`/profile/${user.id}`} className="font-medium hover:underline truncate block">
                        {user.username || 'Anonymous'}
                      </Link>
                      <p className="text-sm text-muted-foreground truncate">
                        {user.recommendation_count} recommendations
                      </p>
                    </div>
                  </div>
                  
                  <p className="text-sm mt-3 line-clamp-2 min-h-[2.5rem]">
                    {user.bio || 'No bio provided.'}
                  </p>
                  
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-sm text-muted-foreground">
                      {user.follower_count} follower{user.follower_count !== 1 ? 's' : ''}
                    </span>
                    
                    <Button
                      variant={user.is_following ? "secondary" : "default"}
                      size="sm"
                      onClick={() => handleFollowToggle(user.id, user.is_following)}
                    >
                      {user.is_following ? (
                        <>
                          <UserCheck className="h-4 w-4 mr-1" />
                          Following
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4 mr-1" />
                          Follow
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
