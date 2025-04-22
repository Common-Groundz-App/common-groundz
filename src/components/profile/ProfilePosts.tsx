
import React, { useEffect, useRef } from 'react';
import { ProfilePostItem } from './ProfilePostItem';
import { ProfilePostsEmpty } from './ProfilePostsEmpty';
import { ProfilePostsLoading } from './ProfilePostsLoading';
import { useProfileData } from '@/hooks/use-profile-data';
import { toast } from '@/hooks/use-toast';

interface ProfilePostsProps {
  profileUserId?: string;
  isOwnProfile: boolean;
  highlightPostId?: string | null;
  highlightCommentId?: string | null;
}

const ProfilePosts = ({ profileUserId, isOwnProfile, highlightPostId, highlightCommentId }: ProfilePostsProps) => {
  // Use refs to scroll to specific posts or comments
  const highlightedPostRef = useRef<HTMLDivElement>(null);
  const { posts, isLoading, error } = useProfileData(profileUserId).posts;

  // Effect to scroll to highlighted post when component loads
  useEffect(() => {
    if (highlightPostId && posts && posts.length > 0 && !isLoading) {
      // Find if the post exists in the loaded posts
      const postExists = posts.some(post => post.id === highlightPostId);
      
      if (postExists) {
        // Short delay to ensure DOM is updated
        setTimeout(() => {
          if (highlightedPostRef.current) {
            highlightedPostRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            // Add a highlight effect
            highlightedPostRef.current.classList.add('ring-2', 'ring-primary', 'ring-opacity-50');
            setTimeout(() => {
              highlightedPostRef.current?.classList.remove('ring-2', 'ring-primary', 'ring-opacity-50');
            }, 2000);
            
            // If there's a comment to highlight, we'll handle that in the PostItem component
            if (highlightCommentId) {
              toast({
                title: "Comment found",
                description: "Scrolling to the specific comment",
                duration: 2000
              });
            }
          }
        }, 100);
      } else {
        toast({
          title: "Post not found",
          description: "The post you're looking for might have been deleted or is not visible.",
          variant: "destructive",
          duration: 3000
        });
      }
    }
  }, [highlightPostId, posts, isLoading, highlightCommentId]);

  if (isLoading) {
    return <ProfilePostsLoading />;
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <p className="text-red-500">Error loading posts: {error.message}</p>
      </div>
    );
  }

  if (!posts || posts.length === 0) {
    return <ProfilePostsEmpty isOwnProfile={isOwnProfile} />;
  }

  return (
    <div className="space-y-6">
      {posts.map((post) => (
        <div 
          key={post.id} 
          ref={post.id === highlightPostId ? highlightedPostRef : null}
          className={`transition-all duration-300 rounded-lg ${post.id === highlightPostId ? 'bg-accent/30' : ''}`}
        >
          <ProfilePostItem 
            post={post} 
            isOwnPost={isOwnProfile}
            highlightCommentId={post.id === highlightPostId ? highlightCommentId : null} 
          />
        </div>
      ))}
    </div>
  );
};

export default ProfilePosts;
