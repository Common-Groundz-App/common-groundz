
import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import NavBarComponent from '@/components/NavBarComponent';
import ProfileContent from '@/components/profile/ProfileContent';
import Footer from '@/components/Footer';
import { toast } from '@/hooks/use-toast';

const Profile = () => {
  const { user } = useAuth();
  const { userId } = useParams();
  const [searchParams] = useSearchParams();
  
  // Extract content parameters
  const postId = searchParams.get('post');
  const recId = searchParams.get('rec');
  const reviewId = searchParams.get('review');
  const commentId = searchParams.get('comment');
  
  useEffect(() => {
    // Log the parameters for debugging
    if (postId || recId || reviewId) {
      console.log("Content params:", { postId, recId, reviewId, commentId });
      
      // Show toast about the specific content being viewed
      let contentType = postId ? "post" : recId ? "recommendation" : "review";
      
      toast({
        title: `Viewing specific ${contentType}`,
        description: commentId ? `Scrolling to comment #${commentId}` : `Showing ${contentType} content`,
        duration: 3000
      });
      
      // TODO: In the future, we could scroll to the specific content
      // using the DOM API or a ref
    }
  }, [postId, recId, reviewId, commentId]);
  
  if (!user) {
    return <Navigate to="/auth" />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NavBarComponent />
      <div className="flex-1">
        <ProfileContent />
      </div>
      <Footer />
    </div>
  );
};

export default Profile;
