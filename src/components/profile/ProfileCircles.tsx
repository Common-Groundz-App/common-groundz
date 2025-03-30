
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserPlus, UserMinus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from "@/components/ui/skeleton";

type UserProfile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  isFollowing?: boolean;
};

interface ProfileCirclesProps {
  profileUserId: string;
  isOwnProfile: boolean;
}

const ProfileCircles = ({ profileUserId, isOwnProfile }: ProfileCirclesProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>('followers');
  const [followers, setFollowers] = useState<UserProfile[]>([]);
  const [following, setFollowing] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const fetchCircles = async () => {
      if (!profileUserId) return;
      
      setIsLoading(true);
      
      try {
        // Fetch followers (people who follow the profile user)
        const { data: followersData, error: followersError } = await supabase
          .from('follows')
          .select(`
            follower_id,
            profiles!follows_follower_id_fkey (
              id,
              username,
              avatar_url
            )
          `)
          .eq('following_id', profileUserId);
        
        if (followersError) throw followersError;
        
        // Fetch following (people the profile user follows)
        const { data: followingData, error: followingError } = await supabase
          .from('follows')
          .select(`
            following_id,
            profiles!follows_following_id_fkey (
              id,
              username,
              avatar_url
            )
          `)
          .eq('follower_id', profileUserId);
        
        if (followingError) throw followingError;
        
        // If the current user is viewing the profile, check which users they follow
        let userFollowingIds: string[] = [];
        if (user && !isOwnProfile) {
          const { data: userFollowing, error: userFollowingError } = await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', user.id);
          
          if (!userFollowingError && userFollowing) {
            userFollowingIds = userFollowing.map(f => f.following_id);
          }
        }
        
        // Process followers
        const processedFollowers: UserProfile[] = followersData
          .filter(item => item.profiles) // Filter out any null profiles
          .map(item => ({
            id: item.profiles.id,
            username: item.profiles.username || 'User',
            avatar_url: item.profiles.avatar_url,
            isFollowing: userFollowingIds.includes(item.profiles.id)
          }));
        
        // Process following
        const processedFollowing: UserProfile[] = followingData
          .filter(item => item.profiles) // Filter out any null profiles
          .map(item => ({
            id: item.profiles.id,
            username: item.profiles.username || 'User',
            avatar_url: item.profiles.avatar_url,
            isFollowing: userFollowingIds.includes(item.profiles.id)
          }));
        
        setFollowers(processedFollowers);
        setFollowing(processedFollowing);
      } catch (error) {
        console.error('Error fetching circles:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchCircles();
  }, [profileUserId, user, isOwnProfile]);

  const handleFollowToggle = async (targetUserId: string, currentlyFollowing: boolean) => {
    if (!user) return;
    
    setActionLoading(targetUserId);
    
    try {
      if (currentlyFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId);
        
        if (error) throw error;
        
        toast({
          title: 'Unfollowed',
          description: 'You are no longer following this user.',
        });
      } else {
        // Follow
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: targetUserId
          });
        
        if (error) throw error;
        
        toast({
          title: 'Following',
          description: 'You are now following this user.',
        });
      }
      
      // Update the UI
      if (activeTab === 'followers') {
        setFollowers(prev => 
          prev.map(follower => 
            follower.id === targetUserId 
              ? {...follower, isFollowing: !currentlyFollowing} 
              : follower
          )
        );
      } else {
        setFollowing(prev => 
          prev.map(follow => 
            follow.id === targetUserId 
              ? {...follow, isFollowing: !currentlyFollowing} 
              : follow
          )
        );
      }
      
    } catch (error: any) {
      console.error('Error toggling follow:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update follow status',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const getUserInitials = (username: string) => {
    if (!username) return 'U';
    
    const words = username.trim().split(' ');
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }
    
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="followers" onValueChange={(value) => setActiveTab(value as 'followers' | 'following')}>
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="followers">Followers</TabsTrigger>
          <TabsTrigger value="following">Following</TabsTrigger>
        </TabsList>
        
        <TabsContent value="followers" className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="ml-4 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                    <Skeleton className="h-9 w-24 rounded-md" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : followers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No followers yet
            </div>
          ) : (
            followers.map(follower => (
              <Card key={follower.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <Avatar>
                      {follower.avatar_url ? (
                        <AvatarImage src={follower.avatar_url} alt={follower.username || 'User'} />
                      ) : (
                        <AvatarFallback className="bg-brand-orange text-white">
                          {getUserInitials(follower.username || 'User')}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="ml-4">
                      <div className="font-medium">{follower.username || 'User'}</div>
                      <div className="text-sm text-gray-500">Follower</div>
                    </div>
                  </div>
                  
                  {user && user.id !== follower.id && !isOwnProfile && (
                    <Button 
                      variant={follower.isFollowing ? "outline" : "default"}
                      size="sm"
                      onClick={() => handleFollowToggle(follower.id, !!follower.isFollowing)}
                      disabled={actionLoading === follower.id}
                    >
                      {follower.isFollowing ? (
                        <>
                          <UserMinus size={14} className="mr-1" /> Unfollow
                        </>
                      ) : (
                        <>
                          <UserPlus size={14} className="mr-1" /> Follow
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
        
        <TabsContent value="following" className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="ml-4 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                    <Skeleton className="h-9 w-24 rounded-md" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : following.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Not following anyone yet
            </div>
          ) : (
            following.map(follow => (
              <Card key={follow.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <Avatar>
                      {follow.avatar_url ? (
                        <AvatarImage src={follow.avatar_url} alt={follow.username || 'User'} />
                      ) : (
                        <AvatarFallback className="bg-brand-orange text-white">
                          {getUserInitials(follow.username || 'User')}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="ml-4">
                      <div className="font-medium">{follow.username || 'User'}</div>
                      <div className="text-sm text-gray-500">Following</div>
                    </div>
                  </div>
                  
                  {user && user.id !== follow.id && !isOwnProfile && (
                    <Button 
                      variant={follow.isFollowing ? "outline" : "default"}
                      size="sm"
                      onClick={() => handleFollowToggle(follow.id, !!follow.isFollowing)}
                      disabled={actionLoading === follow.id}
                    >
                      {follow.isFollowing ? (
                        <>
                          <UserMinus size={14} className="mr-1" /> Unfollow
                        </>
                      ) : (
                        <>
                          <UserPlus size={14} className="mr-1" /> Follow
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProfileCircles;
