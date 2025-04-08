
import { useState, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AddCommentData } from '@/hooks/feed/types';

interface CommentFormProps {
  onSubmit: (data: AddCommentData) => Promise<any>;
  postId?: string;
  recommendationId?: string;
  parentId?: string;
  placeholder?: string;
  submitLabel?: string;
  initialContent?: string;
  isEditing?: boolean;
  onCancel?: () => void;
  className?: string;
}

const CommentForm: React.FC<CommentFormProps> = ({
  onSubmit,
  postId,
  recommendationId,
  parentId,
  placeholder = 'Add a comment...',
  submitLabel = 'Post',
  initialContent = '',
  isEditing = false,
  onCancel,
  className = '',
}) => {
  const [content, setContent] = useState(initialContent);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    
    try {
      setIsSubmitting(true);
      
      await onSubmit({
        content,
        post_id: postId,
        recommendation_id: recommendationId,
        parent_id: parentId
      });
      
      // Clear form if not editing
      if (!isEditing) {
        setContent('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-3 ${className}`}>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        className="min-h-[80px] resize-none"
      />
      
      <div className="flex justify-end space-x-2">
        {isEditing && onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        )}
        
        <Button 
          type="submit" 
          disabled={!content.trim() || isSubmitting}
          size="sm"
        >
          {isSubmitting ? 'Submitting...' : submitLabel}
        </Button>
      </div>
    </form>
  );
};

export default CommentForm;
