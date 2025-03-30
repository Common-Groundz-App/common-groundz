
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Save, UserPlus, UserMinus, MessageSquare } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface ProfileActionsProps {
  hasChanges: boolean;
  isLoading: boolean;
  uploading?: boolean;
  onSaveChanges: () => void;
  profileUserId?: string;
  isOwnProfile: boolean;
}

const ProfileActions = ({ 
  hasChanges, 
  isLoading, 
  uploading = false, 
  onSaveChanges,
  profileUserId,
  isOwnProfile
}: ProfileActionsProps) => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [followLoading, setFollowLoading] = useState<boolean>(false);

  // Check if the current user is following the profile user
  useEffect(() => {
    const checkFollowStatus = async () => {
      if (!user || !profileUserId || isOwnProfile) return;
      
      try {
        const { data, error } = await supabase
          .from('follows')
          .select('*')
          .eq('follower_id', user.id)
          .eq('following_id', profileUserId)
          .maybeSingle();
        
        if (error) throw error;
        setIsFollowing(!!data);
      } catch (error) {
        console.error('Error checking follow status:', error);
      }
    };
    
    checkFollowStatus();
  }, [user, profileUserId, isOwnProfile]);

  const handleFollowToggle = async () => {
    if (!user || !profileUserId) return;
    
    setFollowLoading(true);
    
    try {
      if (isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', profileUserId);
        
        if (error) throw error;
        
        setIsFollowing(false);
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
            following_id: profileUserId
          });
        
        if (error) throw error;
        
        setIsFollowing(true);
        toast({
          title: 'Following',
          description: 'You are now following this user.',
        });
      }
    } catch (error: any) {
      console.error('Error toggling follow:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update follow status',
        variant: 'destructive',
      });
    } finally {
      setFollowLoading(false);
    }
  };

  if (isOwnProfile) {
    return (
      <div className="flex space-x-3 mb-6">
        {hasChanges ? (
          <Button 
            size={isMobile ? "sm" : "default"} 
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={onSaveChanges}
            disabled={isLoading || uploading}
          >
            <Save size={16} className="mr-1" /> Save Changes
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex space-x-3 mb-6">
      <Button 
        size={isMobile ? "sm" : "default"} 
        className={isFollowing ? "bg-gray-600 hover:bg-gray-700" : "bg-brand-orange hover:bg-brand-orange/90"}
        onClick={handleFollowToggle}
        disabled={followLoading}
      >
        {isFollowing ? (
          <>
            <UserMinus size={16} className="mr-1" /> Unfollow
          </>
        ) : (
          <>
            <UserPlus size={16} className="mr-1" /> Follow
          </>
        )}
      </Button>
      <Button size={isMobile ? "sm" : "default"} variant="outline">
        <MessageSquare size={16} className="mr-1" /> Message
      </Button>
    </div>
  );
};

export default ProfileActions;
