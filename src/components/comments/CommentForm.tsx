
import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from '@/contexts/AuthContext';

interface CommentFormProps {
  onSubmit: (content: string) => void;
  onCancel?: () => void;
  placeholder?: string;
  buttonText?: string;
  initialValue?: string;
  showCancel?: boolean;
  replyingTo?: string;
  autoFocus?: boolean;
  className?: string;
}

export const CommentForm = ({ 
  onSubmit, 
  onCancel,
  placeholder = "Add a comment...", 
  buttonText = "Post",
  initialValue = "",
  showCancel = false,
  replyingTo,
  autoFocus = false,
  className = "" 
}: CommentFormProps) => {
  const [content, setContent] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { user, userProfile } = useAuth();
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim()) {
      onSubmit(content);
      setContent('');
    }
  };
  
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);
  
  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };

  return (
    <form onSubmit={handleSubmit} className={`flex space-x-3 ${className}`}>
      <Avatar className="h-8 w-8 mt-1">
        <AvatarImage src={userProfile?.avatar_url || undefined} />
        <AvatarFallback>{getInitials(userProfile?.username)}</AvatarFallback>
      </Avatar>
      
      <div className="flex-1">
        {replyingTo && (
          <div className="text-xs text-muted-foreground mb-1 ml-1">
            Replying to <span className="font-medium">{replyingTo}</span>
          </div>
        )}
        
        <Textarea
          ref={textareaRef}
          placeholder={placeholder}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[60px] resize-none"
          disabled={!user}
        />
        
        <div className="flex justify-end space-x-2 mt-2">
          {showCancel && onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button 
            type="submit" 
            size="sm" 
            disabled={!content.trim() || !user}
          >
            {buttonText}
          </Button>
        </div>
      </div>
    </form>
  );
};
