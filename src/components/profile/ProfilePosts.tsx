
import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Filter, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ProfilePostItem from './ProfilePostItem';
import ProfilePostsEmpty from './ProfilePostsEmpty';
import ProfilePostsLoading from './ProfilePostsLoading';
import { fetchUserPosts, Post } from './services/profilePostsService';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProfilePostsProps {
  profileUserId: string;
  isOwnProfile: boolean;
}

const ProfilePosts = ({ profileUserId, isOwnProfile }: ProfilePostsProps) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadPosts = async () => {
    try {
      setLoading(true);
      const postsData = await fetchUserPosts(profileUserId, isOwnProfile);
      setPosts(postsData);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast({
        title: 'Error',
        description: 'Could not load posts. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [profileUserId, isOwnProfile]);

  // Refresh posts when a new post is created or posts are updated or deleted
  useEffect(() => {
    const handleRefreshPosts = () => loadPosts();
    
    // Listen for both the current event and the new event name for better compatibility
    window.addEventListener('refresh-profile-posts', handleRefreshPosts);
    window.addEventListener('refresh-posts', handleRefreshPosts);
    
    return () => {
      window.removeEventListener('refresh-profile-posts', handleRefreshPosts);
      window.removeEventListener('refresh-posts', handleRefreshPosts);
    };
  }, []);

  const handlePostDeleted = (deletedPostId: string) => {
    // Immediately update the local state by filtering out the deleted post
    setPosts(currentPosts => currentPosts.filter(post => post.id !== deletedPostId));
    
    // Also refresh from the server to ensure data consistency
    loadPosts();
  };

  const handleCreatePost = () => {
    // Dispatch custom event with contentType to directly open post modal
    window.dispatchEvent(new CustomEvent('open-create-post-dialog', {
      detail: { contentType: 'post' }
    }));
  };

  if (loading) {
    return <ProfilePostsLoading />;
  }

  if (posts.length === 0) {
    return <ProfilePostsEmpty isOwnProfile={isOwnProfile} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base sm:text-lg lg:text-xl font-semibold">
          {isOwnProfile ? 'My Posts' : 'Posts'}
        </h2>
        
        <div className="flex items-center gap-2">
          {/* Filter Button - Always on the left */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-1">
                <Filter size={14} />
                <span className="max-[500px]:hidden">Filter</span>
                <ChevronDown size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuItem className="text-sm font-medium text-gray-500 py-1.5" disabled>
                  Sort By
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  Latest
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  Most Liked
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">
                  Most Commented
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Create Post Button - Always on the right */}
          {isOwnProfile && (
            <Button 
              onClick={handleCreatePost}
              variant="gradient"
              size="sm"
              className="flex items-center gap-2 shadow-md hover:shadow-lg transition-all duration-300 max-[500px]:text-sm max-[500px]:px-2"
            >
              <PlusCircle className="h-4 w-4" />
              Create Post
            </Button>
          )}
        </div>
      </div>

      {/* Posts List */}
      {posts.map(post => (
        <ProfilePostItem key={post.id} post={post} onDeleted={() => handlePostDeleted(post.id)} />
      ))}
    </div>
  );
};

export default ProfilePosts;
