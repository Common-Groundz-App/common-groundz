
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

interface CommentInputProps {
  onSubmit: (content: string) => Promise<any>;
  placeholder?: string;
  autoFocus?: boolean;
}

const CommentInput: React.FC<CommentInputProps> = ({ 
  onSubmit, 
  placeholder = "Add a comment...",
  autoFocus = false
}) => {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);
  
  const handleSubmit = async () => {
    if (!content.trim()) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(content.trim());
      setContent('');
      setIsFocused(false);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSubmit();
    }
  };
  
  if (!user) {
    return (
      <div className="text-center text-sm text-muted-foreground py-2 bg-muted/50 rounded-md px-4">
        Sign in to join the conversation
      </div>
    );
  }
  
  return (
    <div className="space-y-2 relative">
      <Textarea 
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          "min-h-[60px] transition-all resize-none",
          isFocused || content ? "min-h-[80px]" : "min-h-[40px]"
        )}
      />
      
      <AnimatePresence>
        {(isFocused || content) && (
          <motion.div 
            className="flex justify-between items-center"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <span className="text-xs text-muted-foreground">
              Tip: Press Ctrl+Enter to post
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setContent('');
                  setIsFocused(false);
                  if (textareaRef.current) {
                    textareaRef.current.blur();
                  }
                }}
                disabled={isSubmitting || !content}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={isSubmitting || !content.trim()}
              >
                {isSubmitting ? 'Posting...' : 'Post'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Import cn utility
import { cn } from '@/lib/utils';

export default CommentInput;
