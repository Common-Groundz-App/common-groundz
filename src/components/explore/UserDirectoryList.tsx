
import React, { useState, useEffect } from 'react';
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

type User = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  recommendation_count: number;
  follower_count: number;
  is_following: boolean;
};

interface UserDirectoryListProps {
  sortOption: string;
}

export const UserDirectoryList = ({ sortOption }: UserDirectoryListProps) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  
  useEffect(() => {
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
          
        // Skip current user
        if (currentUser) {
          query = query.neq('id', currentUser.id);
        }
          
        // Apply sorting
        if (sortOption === 'recent') {
          query = query.order('created_at', { ascending: false });
        }
        
        // Limit results
        query = query.limit(24);
        
        const { data, error } = await query;
        
        if (error) {
          throw error;
        }
        
        if (!data) {
          return;
        }
        
        // Get recommendation counts - direct query instead of using non-existent RPC
        const userIds = data.map(user => user.id);
        let recommendationCountsMap = new Map();
        let followerCountsMap = new Map();
        let followingData: any[] = [];
        
        // Get recommendation counts
        const { data: recommendationData, error: recError } = await supabase
          .from('recommendations')
          .select('user_id, id')
          .in('user_id', userIds);
          
        if (recError) {
          console.error('Error fetching recommendations:', recError);
        } else if (recommendationData) {
          // Count recommendations by user
          recommendationData.forEach(item => {
            const count = recommendationCountsMap.get(item.user_id) || 0;
            recommendationCountsMap.set(item.user_id, count + 1);
          });
        }
        
        // Get follower counts directly - don't use the RPC that's causing issues
        const { data: followerData, error: followerError } = await supabase
          .from('follows')
          .select('following_id')
          .in('following_id', userIds);
          
        if (followerError) {
          console.error('Error fetching followers:', followerError);
        } else if (followerData) {
          // Count followers by user
          followerData.forEach(item => {
            const count = followerCountsMap.get(item.following_id) || 0;
            followerCountsMap.set(item.following_id, count + 1);
          });
        }
        
        // Check who current user is following
        if (currentUser) {
          const { data: following, error: followingError } = await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', currentUser.id)
            .in('following_id', userIds);
            
          if (followingError) {
            console.error('Error fetching following status:', followingError);
          } else {
            followingData = following || [];
          }
        }
        
        // Combine all data
        const enhancedUsers = data.map(user => {
          const recCount = recommendationCountsMap.get(user.id) || 0;
          const followers = followerCountsMap.get(user.id) || 0;
          const isFollowing = followingData.some(f => f.following_id === user.id);
          
          return {
            ...user,
            recommendation_count: recCount,
            follower_count: followers,
            is_following: isFollowing
          };
        });
        
        // Sort data if needed
        let sortedUsers = [...enhancedUsers];
        
        if (sortOption === 'popular') {
          sortedUsers.sort((a, b) => b.follower_count - a.follower_count);
        } else if (sortOption === 'active') {
          sortedUsers.sort((a, b) => b.recommendation_count - a.recommendation_count);
        }
        
        setUsers(sortedUsers);
      } catch (error) {
        console.error('Error fetching users:', error);
        toast({
          title: 'Error',
          description: 'Failed to load users. Please try again.',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchUsers();
  }, [currentUser, sortOption, toast]);
  
  const handleFollowToggle = async (userId: string, isFollowing: boolean) => {
    if (!currentUser) return;
    
    try {
      // Use the useFollow hook
      const followHook = useFollow(userId);
      await followHook.handleFollowToggle();
      
      // Update local state
      setUsers(prev => 
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
  
  if (users.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-muted-foreground">No users found. Try changing the filters.</p>
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {users.map(user => (
        <Card key={user.id}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={user.avatar_url || undefined} />
                <AvatarFallback>{getInitials(user.username)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <Link to={user.username ? `/u/${user.username}` : `/profile/${user.id}`} className="font-medium hover:underline truncate block">
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
  );
};
