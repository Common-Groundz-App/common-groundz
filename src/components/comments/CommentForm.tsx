
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface CommentFormProps {
  parentId?: string | null;
  initialContent?: string;
  placeholder?: string;
  onSubmit: (content: string) => Promise<void>;
  onCancel?: () => void;
  isEditing?: boolean;
}

export const CommentForm: React.FC<CommentFormProps> = ({
  parentId,
  initialContent = '',
  placeholder = 'Add a comment...',
  onSubmit,
  onCancel,
  isEditing = false
}) => {
  const { user } = useAuth();
  const [content, setContent] = useState(initialContent);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) return;
    
    try {
      setIsSubmitting(true);
      await onSubmit(content);
      if (!isEditing) {
        setContent(''); // Clear form only for new comments
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-3">
        {user && (
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.avatar_url || undefined} alt={user.username || 'User'} />
            <AvatarFallback>{getInitials(user.username)}</AvatarFallback>
          </Avatar>
        )}
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholder}
          className="min-h-[80px] flex-1"
          disabled={!user || isSubmitting}
        />
      </div>
      
      <div className="flex justify-end gap-2">
        {(isEditing || content.trim()) && onCancel && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        )}
        
        <Button 
          type="submit" 
          size="sm" 
          disabled={!user || !content.trim() || isSubmitting}
        >
          {isSubmitting ? 'Posting...' : isEditing ? 'Save Changes' : 'Post Comment'}
        </Button>
      </div>
    </form>
  );
};

export default CommentForm;
