
import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import NavBarComponent from '@/components/NavBarComponent';
import Footer from '@/components/Footer';
import PostContentViewer from '@/components/content/PostContentViewer';

const PostView = () => {
  const { postId } = useParams<{ postId: string }>();
  const [searchParams] = useSearchParams();
  const commentId = searchParams.get('commentId');
  
  return (
    <div className="min-h-screen flex flex-col">
      <NavBarComponent />
      <div className="flex-1 container max-w-3xl mx-auto py-6 px-4">
        {postId ? (
          <PostContentViewer postId={postId} highlightCommentId={commentId} />
        ) : (
          <div className="text-center py-12">
            <h2 className="text-xl font-medium mb-2">Post Not Found</h2>
            <p className="text-muted-foreground">The requested post could not be found.</p>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default PostView;
