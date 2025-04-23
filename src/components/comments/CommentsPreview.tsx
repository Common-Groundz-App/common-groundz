
import React from 'react';

interface CommentsPreviewProps {
  topComment?: {
    username?: string;
    content?: string;
  } | null;
  commentCount: number;
  onClick: () => void;
}

const CommentsPreview: React.FC<CommentsPreviewProps> = ({ topComment, commentCount, onClick }) => {
  if (!topComment && commentCount === 0) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }}
        className="w-full text-left text-muted-foreground hover:underline bg-muted/30 rounded-lg px-3 py-2 mt-2"
        aria-label="Add a comment" 
        aria-haspopup="dialog"
      >
        No comments yet. Add one!
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className="w-full text-left bg-muted/30 rounded-lg px-3 py-2 mt-2 hover:bg-muted/60"
      aria-label="See all comments"
      aria-haspopup="dialog" 
    >
      {topComment ? (
        <span>
          <span className="font-semibold text-gray-800">{topComment.username ? topComment.username + ': ' : ''}</span>
          <span className="text-gray-600 line-clamp-1">{topComment.content}</span>
          {commentCount > 1 && (
            <span className="ml-2 text-sm text-muted-foreground underline">
              See all {commentCount} comments
            </span>
          )}
        </span>
      ) : (
        <span className="text-muted-foreground underline">
          See all comments ({commentCount})
        </span>
      )}
    </button>
  );
};

export default CommentsPreview;
