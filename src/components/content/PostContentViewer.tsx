
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import PostFeedItem from '@/components/feed/PostFeedItem';
import ContentLoading from './ContentLoading';
import ContentError from './ContentError';
import ContentComments from './ContentComments';
import { usePostContent } from '@/hooks/content/usePostContent';
import { usePostInteractions } from '@/hooks/content/useContentInteractions';

interface PostContentViewerProps {
  postId: string;
  highlightCommentId: string | null;
}

const PostContentViewer = ({ postId, highlightCommentId }: PostContentViewerProps) => {
  const { user } = useAuth();
  const { post: initialPost, loading, error, topComment } = usePostContent(postId, user?.id);
  const { post, handlePostLike, handlePostSave, handleDelete } = 
    usePostInteractions(initialPost, user?.id);

  if (loading) {
    return <ContentLoading />;
  }

  if (error || !post) {
    return <ContentError message={error} />;
  }

  return (
    <div className="p-4 sm:p-6 overflow-y-auto max-h-full">
      <PostFeedItem 
        post={post} 
        onLike={() => handlePostLike()} 
        onSave={() => handlePostSave()}
        onDelete={(deletedId) => handleDelete(deletedId)}
        highlightCommentId={highlightCommentId}
      />

      <ContentComments
        itemId={postId}
        itemType="post"
        topComment={topComment}
        commentCount={post.comment_count}
        highlightCommentId={highlightCommentId}
      />
    </div>
  );
};

export default PostContentViewer;
