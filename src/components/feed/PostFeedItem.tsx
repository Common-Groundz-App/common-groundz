
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Bookmark, 
  Heart, 
  MessageCircle, 
  MoreVertical, 
  Pencil, 
  Trash2,
  MapPin,
  Eye,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CombinedFeedItem } from '@/hooks/feed/types';
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
import DeleteConfirmationDialog from '@/components/common/DeleteConfirmationDialog';
import { useToast } from '@/components/ui/use-toast';
import { deletePost } from '@/services/postService';
import { useNavigate } from 'react-router-dom';
import { PostMediaDisplay } from './PostMediaDisplay';
import { TagBadge } from './TagBadge';
import { EntityBadge } from './EntityBadge';
import { formatRelativeDate } from '@/utils/dateUtils';
import { feedbackActions } from '@/services/feedbackService';

interface PostFeedItemProps {
  post: CombinedFeedItem;
  onLike?: (id: string) => void;
  onSave?: (id: string) => void;
  onComment?: (id: string) => void;
  onDelete?: (id: string) => void;
  refreshFeed?: () => void;
  highlightCommentId?: string | null;
}

const PostFeedItem: React.FC<PostFeedItemProps> = ({ 
  post, 
  onLike, 
  onSave,
  onComment,
  onDelete,
  refreshFeed,
  highlightCommentId
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [localCommentCount, setLocalCommentCount] = useState<number | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const isOwner = user?.id === post.user_id;

  // Type guard to check if this is actually a post (not a recommendation)
  const isPost = 'title' in post && 'content' in post;

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

  const handleLikeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Trigger feedback for like action
    feedbackActions.like();
    
    if (onLike) onLike(post.id);
  };

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Trigger feedback for save action
    feedbackActions.save();
    
    if (onSave) onSave(post.id);
  };

  const handleCommentClick = () => {
    setIsCommentDialogOpen(true);
    if (onComment) onComment(post.id);
  };

  const handleCommentAdded = () => {
    // Trigger feedback for comment creation
    feedbackActions.comment();
    setLocalCommentCount(prev => (prev !== null ? prev + 1 : 1));
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };

  const handleEdit = () => {
    navigate(`/posts/edit/${post.id}`);
  };

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!user) return;
    
    setIsDeleting(true);
    try {
      await deletePost(post.id);
      
      toast({
        title: "Post deleted",
        description: "Your post has been deleted successfully"
      });
      
      setIsDeleteDialogOpen(false);
      setIsDeleting(false);
      
      if (onDelete) {
        onDelete(post.id);
      }
      
      window.dispatchEvent(new CustomEvent('refresh-feed'));
    } catch (error) {
      console.error("Error deleting post:", error);
      toast({
        title: "Error",
        description: "Failed to delete post",
        variant: "destructive"
      });
      setIsDeleting(false);
    }
  };

  const handleLocationClick = () => {
    if (isPost && 'location' in post && post.location) {
      const location = String(post.location);
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`, '_blank');
    }
  };

  const handleExternalLinkClick = () => {
    if (isPost && 'content' in post && post.content) {
      const content = String(post.content);
      if (content.startsWith('http://') || content.startsWith('https://')) {
        window.open(content, '_blank');
      }
    }
  };

  const displayCommentCount = localCommentCount !== null ? localCommentCount : post.comment_count;

  // If this is not a post, don't render anything
  if (!isPost) {
    return null;
  }

  const postLocation = 'location' in post ? String(post.location || '') : '';
  const postContent = 'content' in post ? String(post.content || '') : '';
  const postTitle = 'title' in post ? String(post.title || '') : '';
  const postType = 'post_type' in post ? String(post.post_type || '') : '';
  const taggedEntities = 'tagged_entities' in post ? (post.tagged_entities as any[]) || [] : [];
  const media = 'media' in post ? (post.media as any[]) || [] : [];

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
            <div className="text-sm text-muted-foreground">{formatRelativeDate(post.created_at)}</div>
          </div>
          
          <div className="flex items-center gap-2">
            {postType && (
              <Badge>{postType}</Badge>
            )}
            
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
        
        {postTitle && (
          <h3 className="text-xl font-semibold mb-2">{postTitle}</h3>
        )}
        
        {postLocation && (
          <div className="mb-2 text-sm text-muted-foreground flex items-center gap-1 hover:underline cursor-pointer" onClick={handleLocationClick}>
            <MapPin size={16} className="inline-block mr-1" />
            {postLocation}
          </div>
        )}
        
        {postContent && (
          <div className="text-muted-foreground mb-4">
            {postContent.startsWith('http://') || postContent.startsWith('https://') ? (
              <div className="flex items-center gap-1 hover:underline cursor-pointer" onClick={handleExternalLinkClick}>
                <ExternalLink size={16} className="inline-block mr-1" />
                <a href={postContent} target="_blank" rel="noopener noreferrer">
                  {postContent}
                </a>
              </div>
            ) : (
              <p>{postContent}</p>
            )}
          </div>
        )}
        
        {media && media.length > 0 && (
          <PostMediaDisplay media={media} />
        )}
        
        {taggedEntities && taggedEntities.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {taggedEntities.map((entity: any) => (
              <EntityBadge key={entity.id} entity={entity} />
            ))}
          </div>
        )}
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
            onClick={handleLikeClick}
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
          onClick={handleSaveClick}
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
      
      <DeleteConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Post"
        description="Are you sure you want to delete this post? This action cannot be undone."
        isLoading={isDeleting}
      />
    </Card>
  );
};

export default PostFeedItem;
