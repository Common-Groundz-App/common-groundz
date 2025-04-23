
import React, { useState } from 'react';
import CommentsPreview from '@/components/comments/CommentsPreview';
import CommentDialog from '@/components/comments/CommentDialog';

interface ContentCommentsProps {
  itemId: string;
  itemType: 'post' | 'recommendation';
  topComment: any;
  commentCount: number;
  highlightCommentId: string | null;
}

const ContentComments = ({ 
  itemId, 
  itemType, 
  topComment, 
  commentCount, 
  highlightCommentId 
}: ContentCommentsProps) => {
  const [showComments, setShowComments] = useState(!!highlightCommentId);

  return (
    <>
      <CommentsPreview
        topComment={topComment}
        commentCount={commentCount}
        onClick={() => setShowComments(true)}
      />

      {showComments && (
        <CommentDialog
          isOpen={showComments}
          onClose={() => setShowComments(false)}
          itemId={itemId}
          itemType={itemType}
          highlightCommentId={highlightCommentId}
        />
      )}
    </>
  );
};

export default ContentComments;
