
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';

interface CommentInputProps {
  onSubmit: (content: string) => Promise<any>;
  placeholder?: string;
}

const CommentInput: React.FC<CommentInputProps> = ({ 
  onSubmit, 
  placeholder = "Add a comment..." 
}) => {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = async () => {
    if (!content.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(content.trim());
      setContent('');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (!user) {
    return (
      <div className="text-center text-sm text-muted-foreground py-2">
        Please sign in to post comments.
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      <Textarea 
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        className="min-h-[80px]"
      />
      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !content.trim()}
        >
          {isSubmitting ? 'Posting...' : 'Post'}
        </Button>
      </div>
    </div>
  );
};

export default CommentInput;
