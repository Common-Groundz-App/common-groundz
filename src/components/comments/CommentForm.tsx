
import { useState, useRef, FormEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { debounce } from 'lodash';
import { Loader2 } from 'lucide-react';

interface CommentFormProps {
  onSubmit: (content: string) => Promise<boolean>;
  parentId?: string | null;
  placeholder?: string;
  buttonText?: string;
  initialContent?: string;
  isEdit?: boolean;
  onCancel?: () => void;
}

const CommentForm = ({
  onSubmit,
  parentId = null,
  placeholder = 'Add a comment...',
  buttonText = 'Post',
  initialContent = '',
  isEdit = false,
  onCancel
}: CommentFormProps) => {
  const { user } = useAuth();
  const [content, setContent] = useState(initialContent);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Debounced auto-save for drafts (future feature)
  const debouncedSave = useRef(
    debounce(() => {
      setIsSaving(true);
      // Here you could implement auto-save to local storage or API
      setTimeout(() => setIsSaving(false), 500);
    }, 1000)
  ).current;
  
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    debouncedSave();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!content.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const success = await onSubmit(content);
      if (success && !isEdit) {
        setContent('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="border p-4 rounded-md bg-muted/30 text-center text-sm text-muted-foreground">
        Please sign in to add comments.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          placeholder={placeholder}
          value={content}
          onChange={handleChange}
          className="min-h-[80px] resize-y"
          disabled={isSubmitting}
        />
        {isSaving && (
          <span className="absolute bottom-2 right-2 text-xs text-muted-foreground">
            Saving...
          </span>
        )}
      </div>
      
      <div className="flex justify-end space-x-2">
        {isEdit && onCancel && (
          <Button
            type="button"
            variant="ghost"
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
          disabled={!content.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isEdit ? 'Updating...' : 'Posting...'}
            </>
          ) : (
            buttonText
          )}
        </Button>
      </div>
    </form>
  );
};

export default CommentForm;
