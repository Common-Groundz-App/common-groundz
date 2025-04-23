
import React from 'react';

interface CommentsPreviewProps {
  commentCount: number;
  onClick: () => void;
}

const CommentsPreview: React.FC<CommentsPreviewProps> = ({ commentCount, onClick }) => {
  if (commentCount === 0) {
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

  return null; // Remove the "See all comments" section
};

export default CommentsPreview;
