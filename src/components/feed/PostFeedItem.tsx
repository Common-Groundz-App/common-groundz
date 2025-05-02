import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bookmark, Heart, Tag, MessageCircle, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { PostFeedItem as PostItem } from '@/hooks/feed/types';
import { Entity } from '@/services/recommendation/types';
import { PostMediaDisplay } from '@/components/feed/PostMediaDisplay';
import { RichTextDisplay } from '@/components/editor/RichTextEditor';
import { EntityBadge } from '@/components/feed/EntityBadge';
import CommentDialog from '@/components/comments/CommentDialog';
import { fetchCommentCount } from '@/services/commentsService';
import UsernameLink from '@/components/common/UsernameLink';
import { useAuth } from '@/contexts/AuthContext';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ModernCreatePostForm } from '@/components/feed/ModernCreatePostForm';
import DeleteConfirmationDialog from '@/components/common/DeleteConfirmationDialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getPostTypeLabel } from './utils/postUtils';

const resetBodyPointerEvents = () => {
  if (document.body.style.pointerEvents === 'none') {
    document.body.style.pointerEvents = '';
  }
};

interface PostFeedItemProps {
  post: PostItem;
  onLike?: (id: string) => void;
  onSave?: (id: string) => void;
  onComment?: (id: string) => void;
  onDelete?: (id: string) => void;
  refreshFeed?: () => void;
  highlightCommentId?: string | null;
}

export const PostFeedItem: React.FC<PostFeedItemProps> = ({ 
  post, 
  onLike, 
  onSave,
  onComment,
  onDelete,
  refreshFeed,
  highlightCommentId = null
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [localCommentCount, setLocalCommentCount] = useState<number | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const isOwner = user?.id === post.user_id;
  
  useEffect(() => {
    const getInitialCommentCount = async () => {
      try {
        const count = await fetchCommentCount(post.id, 'post');
        setLocalCommentCount(count);
      } catch (error) {
        console.error("Error fetching comment count:", error);
        setLocalCommentCount(post.comment_count || 0);
      }
    };
    
    getInitialCommentCount();
  }, [post.id, post.comment_count]);
  
  useEffect(() => {
    const handleCommentCountUpdate = async (event: CustomEvent) => {
      if (event.detail.itemId === post.id) {
        const updatedCount = await fetchCommentCount(post.id, 'post');
        setLocalCommentCount(updatedCount);
      }
    };
    
    window.addEventListener('refresh-post-comment-count', handleCommentCountUpdate as EventListener);
    
    return () => {
      window.removeEventListener('refresh-post-comment-count', handleCommentCountUpdate as EventListener);
    };
  }, [post.id]);
  
  useEffect(() => {
    if (highlightCommentId) {
      setIsCommentDialogOpen(true);
    }
  }, [highlightCommentId]);
  
  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return 'Today';
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return format(date, 'MMM d, yyyy');
    }
  };

  const renderTaggedEntities = (entities: Entity[]) => {
    if (!entities || entities.length === 0) return null;
    
    return (
      <div className="mt-3">
        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
          <Tag size={14} />
          <span>Tagged:</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {entities.map(entity => (
            <EntityBadge key={entity.id} entity={entity} />
          ))}
        </div>
      </div>
    );
  };
  
  const handleCommentClick = () => {
    setIsCommentDialogOpen(true);
    if (onComment) onComment(post.id);
  };
  
  const handleCommentAdded = () => {
    setLocalCommentCount(prev => (prev !== null ? prev + 1 : 1));
  };

  const handleEdit = () => {
    setIsEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    setIsEditDialogOpen(false);
    toast({
      title: "Post updated",
      description: "Your post has been updated successfully"
    });
    
    setTimeout(() => {
      resetBodyPointerEvents();
      
      window.dispatchEvent(new CustomEvent('refresh-feed'));
      window.dispatchEvent(new CustomEvent('refresh-profile-posts'));
      
      if (refreshFeed) {
        refreshFeed();
      }
    }, 100);
  };

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!user) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('posts')
        .update({ is_deleted: true })
        .eq('id', post.id)
        .eq('user_id', user.id);
        
      if (error) throw error;
      
      toast({
        title: "Post deleted",
        description: "Your post has been deleted successfully"
      });
      
      setIsDeleteDialogOpen(false);
      setIsDeleting(false);
      
      resetBodyPointerEvents();
      
      if (onDelete) {
        onDelete(post.id);
      }
      
      setTimeout(() => {
        resetBodyPointerEvents();
        
        window.dispatchEvent(new CustomEvent('refresh-feed'));
        
        if (refreshFeed) {
          refreshFeed();
        }
      }, 100);
    } catch (error) {
      console.error("Error deleting post:", error);
      toast({
        title: "Error",
        description: "Failed to delete post",
        variant: "destructive"
      });
      setIsDeleting(false);
      resetBodyPointerEvents();
    }
  };

  const displayCommentCount = localCommentCount !== null ? localCommentCount : post.comment_count;

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6">
        <div className="flex items-center space-x-4 mb-4">
          <Avatar className="h-10 w-10 border">
            <AvatarImage src={post.avatar_url || undefined} alt={post.username || 'User'} />
            <AvatarFallback>{getInitials(post.username)}</AvatarFallback>
          </Avatar>
          <div className="flex-grow">
            <UsernameLink 
              username={post.username} 
              userId={post.user_id}
              className="font-medium"
              isCurrentUser={isOwner}
            />
            <div className="text-sm text-muted-foreground">{formatDate(post.created_at)}</div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline">{getPostTypeLabel(post.post_type)}</Badge>
            
            {isOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">More options</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleEdit} className="flex items-center gap-2">
                    <Pencil className="h-4 w-4" /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={handleDeleteClick} 
                    className="text-destructive focus:text-destructive flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        
        <h3 className="text-xl font-semibold mb-2">{post.title}</h3>
        
        <div className="mb-4">
          <RichTextDisplay content={post.content} />
        </div>
        
        {post.media && post.media.length > 0 && (
          <div className="mt-4 mb-4">
            <PostMediaDisplay 
              media={post.media} 
              displayType={post.media.length > 1 ? 'carousel' : 'grid'} 
            />
          </div>
        )}
        
        {post.tagged_entities && renderTaggedEntities(post.tagged_entities)}
      </CardContent>
      
      <CardFooter className="flex justify-between pt-2 pb-4">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "flex items-center gap-1",
              post.is_liked && "text-red-500"
            )}
            onClick={() => onLike && onLike(post.id)}
          >
            <Heart 
              size={18} 
              className={cn(post.is_liked && "fill-red-500")} 
            />
            {post.likes > 0 && (
              <span>{post.likes}</span>
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-1"
            onClick={handleCommentClick}
          >
            <MessageCircle size={18} />
            {displayCommentCount > 0 && (
              <span>{displayCommentCount}</span>
            )}
          </Button>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "flex items-center gap-1",
            post.is_saved && "text-brand-orange"
          )}
          onClick={() => onSave && onSave(post.id)}
        >
          <Bookmark 
            size={18} 
            className={cn(post.is_saved && "fill-brand-orange")} 
          />
          Save
        </Button>
      </CardFooter>
      
      <CommentDialog 
        isOpen={isCommentDialogOpen} 
        onClose={() => setIsCommentDialogOpen(false)} 
        itemId={post.id}
        itemType="post" 
        onCommentAdded={handleCommentAdded}
        highlightCommentId={highlightCommentId}
      />
      
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <ModernCreatePostForm 
            postToEdit={post}
            onSuccess={handleEditSuccess}
            onCancel={() => setIsEditDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
      
      <DeleteConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setIsDeleting(false);
          resetBodyPointerEvents();
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Post"
        description="Are you sure you want to delete this post? This action cannot be undone."
        isLoading={isDeleting}
      />
    </Card>
  );
};

export default PostFeedItem;
