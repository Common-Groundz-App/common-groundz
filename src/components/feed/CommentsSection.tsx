
import React from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';

interface CommentsSectionProps {
  post_id?: string;
  recommendation_id?: string;
  commentCount?: number;
}

export const CommentsSection: React.FC<CommentsSectionProps> = () => {
  return (
    <div className="pt-2">
      <Button
        variant="ghost"
        size="sm"
        className="flex items-center gap-1"
        disabled={true}
      >
        <MessageCircle size={18} />
        Comments
      </Button>
    </div>
  );
};

export default CommentsSection;
