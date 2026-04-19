import React, { useState, useEffect, useRef } from 'react';
import { sharePost } from '@/utils/sharePost';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Heart, Tag, MessageCircle, MoreVertical, Pencil, Trash2, Bookmark, Share, Globe, Lock, Users, MapPin } from 'lucide-react';
import { formatDateLong } from '@/utils/dateUtils';
import { cn } from '@/lib/utils';
import { PostFeedItem as PostItem } from '@/hooks/feed/types';
import { Entity } from '@/services/recommendation/types';
import { PostMediaDisplay } from '@/components/feed/PostMediaDisplay';
import { RichTextDisplay } from '@/components/editor/RichTextEditor';
import { PostTextRenderer } from '@/components/text/PostTextRenderer';
import { fetchCommentCount } from '@/services/commentsService';
import { getInitialsFromName } from '@/utils/profileUtils';
import UsernameLink from '@/components/common/UsernameLink';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEmailVerification } from '@/hooks/useEmailVerification';
import { useAuthPrompt } from '@/hooks/useAuthPrompt';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { EnhancedCreatePostForm, type PostToEdit } from '@/components/feed/EnhancedCreatePostForm';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { canEditPost, hasBeenEdited } from '@/utils/postEditPolicy';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { formatDistanceToNow } from 'date-fns';
import { DeleteConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getPostTypeLabel, shouldShowTypeBadge } from './utils/postUtils';
import TagBadge from './TagBadge';
import { feedbackActions } from '@/services/feedbackService';
import { getEntityUrl } from '@/utils/entityUrlUtils';
import { EntityCategoryBadge } from '@/components/entity/EntityCategoryBadge';
import { shouldHideCategory } from '@/services/categoryService';

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
  isPreview?: boolean;
  isDetailView?: boolean;
}

export const PostFeedItem: React.FC<PostFeedItemProps> = ({ 
  post, 
  onLike, 
  onSave,
  onComment,
  onDelete,
  refreshFeed,
  highlightCommentId = null,
  isPreview = false,
  isDetailView = false
}) => {
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { toast } = useToast();
  const { canPerformAction, showVerificationRequired } = useEmailVerification();
  const { requireAuth } = useAuthPrompt();
  const navigate = useNavigate();
  const [localLikes, setLocalLikes] = useState(post.likes || 0);
  const [localIsLiked, setLocalIsLiked] = useState(post.is_liked || false);
  const [localIsSaved, setLocalIsSaved] = useState(post.is_saved || false);
  const [localCommentCount, setLocalCommentCount] = useState<number | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // New post highlight animation — triggers once for optimistic posts owned by current user
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const hasAnimatedRef = useRef(false);
  const [showHighlight, setShowHighlight] = useState(() => {
    if ((post as any).is_optimistic && post.user_id === user?.id && !hasAnimatedRef.current) {
      hasAnimatedRef.current = true;
      if (prefersReducedMotion) return false;
      return true;
    }
    return false;
  });
  
  const isOwner = user?.id === post.user_id;
  
  React.useEffect(() => {
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

  const handleLikeClick = async () => {
    if (!requireAuth({ action: 'like', surface: 'post_feed_item', postId: post?.id })) return;
    if (!post) return;
    
    if (!canPerformAction('canLikeContent')) {
      showVerificationRequired('canLikeContent');
      return;
    }
    
    try {
      if (localIsLiked) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);
        
        setLocalIsLiked(false);
        setLocalLikes(prev => prev > 0 ? prev - 1 : 0);
      } else {
        await supabase
          .from('post_likes')
          .insert({ post_id: post.id, user_id: user.id });
        
        setLocalIsLiked(true);
        setLocalLikes(prev => prev + 1);
      }
      
      try {
        feedbackActions.like();
      } catch (error) {
        console.error('Feedback error:', error);
      }
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };
  
  const handleSaveClick = async () => {
    if (!requireAuth({ action: 'save', surface: 'post_feed_item', postId: post?.id })) return;
    if (!post) return;
    
    try {
      if (localIsSaved) {
        await supabase
          .from('post_saves')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);
        
        setLocalIsSaved(false);
      } else {
        await supabase
          .from('post_saves')
          .insert({ post_id: post.id, user_id: user.id });
        
        setLocalIsSaved(true);
      }
      
      try {
        feedbackActions.save();
      } catch (error) {
        console.error('Feedback error:', error);
      }
    } catch (err) {
      console.error('Error toggling save:', err);
    }
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

  const handleShare = () => sharePost(post.id, post.title);

  const getVisibilityIcon = () => {
    switch(post.visibility) {
      case 'private': return <Lock className="h-4 w-4" />;
      case 'circle_only': return <Users className="h-4 w-4" />;
      default: return <Globe className="h-4 w-4" />;
    }
  };

  const getVisibilityLabel = () => {
    switch(post.visibility) {
      case 'private': return 'Only Me';
      case 'circle_only': return 'Circle Only';
      default: return 'Public';
    }
  };

  const getEntityTypeColor = (type: string): string => {
    switch(type) {
      case 'book': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'movie': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'place': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'product': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'food': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return '';
    }
  };

  const handleEntityClick = (entity: Entity) => {
    navigate(getEntityUrl(entity));
  };

  const renderTaggedEntities = (entities: Entity[]) => {
    if (!entities || entities.length === 0) return null;
    
    return (
      <div className="flex flex-wrap gap-2">
        {entities.map(entity => (
          <div key={entity.id} className="flex flex-col gap-1">
            <TagBadge
              type="entity"
              label={entity.name}
              entityType={entity.type as any}
              onClick={() => handleEntityClick(entity)}
            />
            {entity.category_id && !shouldHideCategory(entity.category_id) && (
              <EntityCategoryBadge 
                categoryId={entity.category_id} 
                showFullPath={false}
                variant="outline"
                className="text-xs"
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderLocationTags = (tags: string[] | null) => {
    if (!tags || tags.length === 0) return null;
    
    return (
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, index) => (
          <TagBadge
            key={index}
            type="location"
            label={tag}
            onClick={() => {}}
          />
        ))}
      </div>
    );
  };

  const handleCommentClick = () => {
    navigate(`/post/${post.id}?focus=comment`);
    if (onComment) onComment(post.id);
  };
  
  const handleCommentAdded = () => {
    setLocalCommentCount(prev => (prev !== null ? prev + 1 : 1));
  };

  const editAllowed = canEditPost(post as any, user?.id, isAdmin);
  const wasEdited = hasBeenEdited(post as any);

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editAllowed) return;
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

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleteDialogOpen(true);
  };

  const displayCommentCount = localCommentCount !== null ? localCommentCount : post.comment_count;

  const handleContentAreaClick = () => {
    navigate(`/post/${post.id}`);
  };

  const handleContentAreaKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigate(`/post/${post.id}`);
    }
  };

  return (
    <Card 
      className={cn(
        "overflow-hidden transition-colors",
        !isDetailView && "cursor-pointer hover:bg-muted/30 shadow-sm",
        isDetailView && "shadow-none",
        showHighlight && "animate-highlight-fade"
      )}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && e.animationName === 'highlight-fade') {
          setShowHighlight(false);
        }
      }}
      onClick={!isDetailView ? handleContentAreaClick : undefined}
      onKeyDown={!isDetailView ? handleContentAreaKeyDown : undefined}
      role={!isDetailView ? "link" : undefined}
      tabIndex={!isDetailView ? 0 : undefined}
    >
      <CardContent className="p-6">
        {/* User Info and Post Meta */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
            <Avatar className="h-10 w-10 border">
              <AvatarImage src={post.avatar_url || undefined} alt={post.displayName || post.username || 'User'} />
              <AvatarFallback className="bg-brand-orange text-white">{getInitialsFromName(post.displayName || post.username)}</AvatarFallback>
            </Avatar>
            <div>
              <UsernameLink 
                userId={post.user_id} 
                username={post.username}
                displayName={post.displayName}
                showHandle={true}
              />
              <div className="flex items-center text-muted-foreground text-xs gap-1">
                <span>{formatDateLong(post.created_at)}</span>
                {wasEdited && post.last_edited_at && (
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground/70 cursor-default">· edited</span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        Edited {formatDistanceToNow(new Date(post.last_edited_at), { addSuffix: true })}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {shouldShowTypeBadge(post.post_type ?? 'story') && (
                  <>
                    <span>·</span>
                    <span className="text-muted-foreground/70">{getPostTypeLabel(post.post_type ?? 'story')}</span>
                  </>
                )}
                {post.visibility !== 'public' && (
                  <>
                    <span>·</span>
                    <div className="flex items-center gap-1">
                      {getVisibilityIcon()}
                      <span>{getVisibilityLabel()}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {isOwner && (
            <div onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">More options</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {editAllowed ? (
                    <DropdownMenuItem onClick={handleEdit} className="flex items-center gap-2">
                      <Pencil className="h-4 w-4" /> Edit
                    </DropdownMenuItem>
                  ) : (
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuItem
                            onClick={(e) => e.preventDefault()}
                            onSelect={(e) => e.preventDefault()}
                            className="flex items-center gap-2 opacity-50 cursor-not-allowed"
                          >
                            <Pencil className="h-4 w-4" /> Edit
                          </DropdownMenuItem>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          Edit window closed (1 hour limit)
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <DropdownMenuItem 
                    onClick={handleDeleteClick} 
                    className="text-destructive focus:text-destructive flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
        
        {/* Content Area */}
        <div className="mt-4">
          {/* Post Title */}
          {post.title && (
            <h3 className="font-semibold text-base mb-1">{post.title}</h3>
          )}

          {/* Post Content */}
          <div className="text-sm">
            <div className={cn("min-w-0", !isDetailView && "line-clamp-3")}>
              {post.content ? (
                <PostTextRenderer content={post.content} />
              ) : (
                <RichTextDisplay content={post.content} />
              )}
            </div>
          </div>

          {/* Media Content */}
          {post.media && post.media.length > 0 && (
            <div onClick={e => e.stopPropagation()}>
              <PostMediaDisplay 
                media={post.media} 
                className="mt-3"
                maxHeight="h-80"
                aspectRatio="maintain"
                objectFit="contain"
              />
            </div>
          )}

          {/* Entity Tags - Below content */}
          {post.tagged_entities && post.tagged_entities.length > 0 && (
            <div className="mt-3" onClick={e => e.stopPropagation()}>
              {renderTaggedEntities(post.tagged_entities)}
            </div>
          )}

          {/* Location Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="mt-2" onClick={e => e.stopPropagation()}>
              {renderLocationTags(post.tags)}
            </div>
          )}
        </div>

        {/* Social Actions - Isolated from click area */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-3 sm:gap-6">
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn(
                "flex items-center gap-1 py-0 px-2 sm:px-4", 
                localIsLiked && "text-red-500 hover:text-red-600"
              )}
              onClick={handleLikeClick}
            >
              <Heart className={cn("h-5 w-5", localIsLiked && "fill-current")} />
              <span>{localLikes || 0}</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm" 
              className="flex items-center gap-1 py-0 px-2 sm:px-4"
              onClick={handleCommentClick}
            >
              <MessageCircle className="h-5 w-5" />
              <span>{displayCommentCount || 0}</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm" 
              className={cn(
                "flex items-center gap-1 py-0 px-2 sm:px-4",
                localIsSaved && "text-primary"
              )}
              onClick={handleSaveClick}
            >
              <Bookmark className={cn("h-5 w-5", localIsSaved && "fill-current")} />
            </Button>
          </div>
          
          {/* Share button */}
          <Button
            variant="ghost"
            size="sm" 
            className="flex items-center gap-1 py-0 px-2 sm:px-4"
            onClick={handleShare}
          >
            <Share className="h-5 w-5" />
          </Button>
        </div>
      </CardContent>
      
      {/* Edit + Delete dialogs — wrapped to stop the card-click navigation
          handler from firing while the user interacts with the modal. */}
      <div onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <EnhancedCreatePostForm
              postToEdit={post as unknown as PostToEdit}
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
          }}
          onConfirm={handleDeleteConfirm}
          title="Delete Post"
          description="Are you sure you want to delete this post? This action cannot be undone."
          isLoading={isDeleting}
        />
      </div>
  );
};

export default PostFeedItem;
