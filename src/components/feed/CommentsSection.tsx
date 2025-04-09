
import React from 'react';
import { useComments } from '@/hooks/use-comments';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';
import CommentsList from '@/components/comments/CommentsList';
import { useAuth } from '@/contexts/AuthContext';

interface CommentsSectionProps {
  post_id?: string;
  recommendation_id?: string;
  commentCount: number;
}

export const CommentsSection: React.FC<CommentsSectionProps> = ({
  post_id,
  recommendation_id,
  commentCount = 0
}) => {
  const [expanded, setExpanded] = React.useState(false);
  const { user } = useAuth();
  
  const {
    comments,
    loading,
    addComment,
    editComment,
    removeComment,
    likeComment,
    getReplies,
    loadingReplies,
    loadReplies,
    hasLoadedReplies,
  } = useComments({
    post_id,
    recommendation_id
  });
  
  // Only fetch comments when the section is expanded
  const handleExpand = () => {
    setExpanded(!expanded);
  };
  
  // Convert the Map and function-based APIs to Record objects for CommentsList
  const convertReplyMap = () => {
    const repliesRecord: Record<string, any> = {};
    
    comments.forEach(comment => {
      if (hasLoadedReplies(comment.id)) {
        repliesRecord[comment.id] = getReplies(comment.id);
      }
    });
    
    return repliesRecord;
  };
  
  const convertLoadingReplies = () => {
    const loadingRecord: Record<string, boolean> = {};
    
    loadingReplies.forEach(commentId => {
      loadingRecord[commentId] = true;
    });
    
    return loadingRecord;
  };
  
  const convertHasLoadedReplies = () => {
    const loadedRecord: Record<string, boolean> = {};
    
    comments.forEach(comment => {
      loadedRecord[comment.id] = hasLoadedReplies(comment.id);
    });
    
    return loadedRecord;
  };
  
  return (
    <div className="pt-2">
      <Button
        variant="ghost"
        size="sm"
        className="flex items-center gap-1"
        onClick={handleExpand}
      >
        <MessageCircle size={18} />
        {commentCount > 0 && (
          <span>{commentCount}</span>
        )}
        {expanded ? 'Hide Comments' : 'Show Comments'}
      </Button>
      
      {expanded && (
        <div className="mt-4">
          <CommentsList
            comments={comments}
            repliesMap={convertReplyMap()}
            loading={loading}
            loadingReplies={convertLoadingReplies()}
            hasLoadedReplies={convertHasLoadedReplies()}
            onAddComment={addComment}
            onEditComment={editComment}
            onDeleteComment={removeComment}
            onLikeComment={likeComment}
            onLoadReplies={loadReplies}
          />
        </div>
      )}
    </div>
  );
};

export default CommentsSection;
