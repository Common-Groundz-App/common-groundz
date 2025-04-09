
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';
import { useComments } from '@/hooks/comments/use-comments';
import CommentList from './CommentList';

interface CommentsProps {
  postId?: string;
  recommendationId?: string;
}

const Comments: React.FC<CommentsProps> = ({ postId, recommendationId }) => {
  const [showComments, setShowComments] = useState(false);
  
  const {
    comments,
    isLoading,
    hasMore,
    loadMore,
    addComment,
    editComment,
    removeComment,
    handleLike,
    viewReplies,
    viewMainComments,
    isViewingReplies,
    parentId
  } = useComments({ 
    postId, 
    recommendationId 
  });
  
  return (
    <div className="mt-2">
      {!showComments ? (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setShowComments(true)}
          className="flex items-center gap-1"
        >
          <MessageCircle size={18} />
          Show comments
        </Button>
      ) : (
        <div className="mt-4">
          <CommentList
            comments={comments}
            isLoading={isLoading}
            hasMore={hasMore}
            onLoadMore={loadMore}
            onLike={handleLike}
            onEdit={editComment}
            onDelete={removeComment}
            onReply={addComment}
            onViewReplies={viewReplies}
            isViewingReplies={isViewingReplies}
            onBackToMainComments={viewMainComments}
            parentId={parentId}
          />
        </div>
      )}
    </div>
  );
};

export default Comments;
