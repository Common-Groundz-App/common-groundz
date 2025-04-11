
import React, { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import ProfilePostItem from './ProfilePostItem';
import ProfilePostsEmpty from './ProfilePostsEmpty';
import ProfilePostsLoading from './ProfilePostsLoading';
import { fetchUserPosts, Post } from './services/profilePostsService';

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
    window.addEventListener('refresh-profile-posts', handleRefreshPosts);
    
    return () => {
      window.removeEventListener('refresh-profile-posts', handleRefreshPosts);
    };
  }, []);

  const handlePostDeleted = (deletedPostId: string) => {
    // Immediately update the local state by filtering out the deleted post
    setPosts(currentPosts => currentPosts.filter(post => post.id !== deletedPostId));
    
    // Also refresh from the server to ensure data consistency
    loadPosts();
  };

  if (loading) {
    return <ProfilePostsLoading />;
  }

  if (posts.length === 0) {
    return <ProfilePostsEmpty isOwnProfile={isOwnProfile} />;
  }

  return (
    <div className="space-y-6">
      {posts.map(post => (
        <ProfilePostItem key={post.id} post={post} onDeleted={() => handlePostDeleted(post.id)} />
      ))}
    </div>
  );
};

export default ProfilePosts;
