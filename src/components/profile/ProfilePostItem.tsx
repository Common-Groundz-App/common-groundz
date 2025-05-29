
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, MoreVertical, Pencil, Trash2, Bookmark, Share2, Globe, Lock, Users, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { RichTextDisplay } from '@/components/editor/RichTextEditor';
import { PostMediaDisplay } from '@/components/feed/PostMediaDisplay';
import { Entity } from '@/services/recommendation/types';
import { MediaItem } from '@/types/media';
import { useAuth } from '@/contexts/AuthContext';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CreatePostForm } from '@/components/feed/CreatePostForm';
import DeleteConfirmationDialog from '@/components/common/DeleteConfirmationDialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import TagBadge from '@/components/feed/TagBadge';
import CommentDialog from '@/components/comments/CommentDialog';
import { fetchCommentCount } from '@/services/commentsService';
import UsernameLink from '@/components/common/UsernameLink';

// Helper function to reset pointer-events on body if they're set to none
const resetBodyPointerEvents = () => {
  if (document.body.style.pointerEvents === 'none') {
    document.body.style.pointerEvents = '';
  }
};

interface Post {
  id: string;
  title: string;
  content: string;
  post_type: 'story' | 'routine' | 'project' | 'note';
  visibility: 'public' | 'circle_only' | 'private';
  created_at: string;
  updated_at: string;
  tagged_entities?: Entity[];
  media?: MediaItem[];
  user_id?: string;
  tags?: string[];
  username?: string;
  avatar_url?: string;
}

interface ProfilePostItemProps {
  post: Post;
  onDeleted?: (postId: string) => void;
}

const ProfilePostItem = ({ post, onDeleted }: ProfilePostItemProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [localLikes, setLocalLikes] = useState(0);
  const [localIsLiked, setLocalIsLiked] = useState(false);
  const [localIsSaved, setLocalIsSaved] = useState(false);
  const [localCommentCount, setLocalCommentCount] = useState<number | null>(null);
  
  const isOwner = user?.id === post.user_id;
  const CONTENT_LIMIT = 280;

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      if (!user) return;

      try {
        // Get like count
        const { count: likeCount } = await supabase
          .from('post_likes')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', post.id);

        setLocalLikes(likeCount || 0);

        // Check if user liked this post
        const { data: likeData } = await supabase
          .from('post_likes')
          .select('*')
          .eq('post_id', post.id)
          .eq('user_id', user.id)
          .single();

        setLocalIsLiked(!!likeData);

        // Check if user saved this post
        const { data: saveData } = await supabase
          .from('post_saves')
          .select('*')
          .eq('post_id', post.id)
          .eq('user_id', user.id)
          .single();

        setLocalIsSaved(!!saveData);

        // Get comment count
        const count = await fetchCommentCount(post.id, 'post');
        setLocalCommentCount(count);
      } catch (error) {
        console.error('Error loading post data:', error);
      }
    };

    loadInitialData();
  }, [post.id, user?.id]);

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

  const handleLikeClick = async () => {
    if (!user || !post) return;
    
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
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };
  
  const handleSaveClick = async () => {
    if (!user || !post) return;
    
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
    } catch (err) {
      console.error('Error toggling save:', err);
    }
  };

  const handleCommentClick = () => {
    setIsCommentDialogOpen(true);
  };
  
  const handleCommentAdded = () => {
    setLocalCommentCount(prev => (prev !== null ? prev + 1 : 1));
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: post.title || 'Check out this post!',
        text: post.content ? post.content.substring(0, 50) + (post.content.length > 50 ? '...' : '') : 'Read more...',
        url: `${window.location.origin}/post/${post.id}`,
      }).then(() => {
        console.log('Successful share');
      })
      .catch((error) => console.error('Error sharing:', error));
    } else {
      toast({
        title: 'Web Share API not supported',
        description: 'Please copy the link manually.',
      });
    }
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
    
    // Add a slight delay before dispatching the global refresh event
    setTimeout(() => {
      resetBodyPointerEvents();
      window.dispatchEvent(new CustomEvent('refresh-profile-posts'));
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
      
      // First close the dialog to prevent UI lock
      setIsDeleteDialogOpen(false);
      setIsDeleting(false);
      
      // Explicitly reset pointer-events
      resetBodyPointerEvents();
      
      // Then update local state
      if (onDeleted) {
        onDeleted(post.id);
      }
      
      // Add a slight delay before dispatching the global refresh event
      setTimeout(() => {
        // Explicitly reset pointer-events again after the timeout
        resetBodyPointerEvents();
        
        window.dispatchEvent(new CustomEvent('refresh-profile-posts'));
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

  const renderTaggedEntities = (entities: Entity[]) => {
    if (!entities || entities.length === 0) return null;
    
    return (
      <div className="mt-4">
        <div className="flex flex-wrap gap-2">
          {entities.map(entity => (
            <TagBadge
              key={entity.id}
              type="entity"
              label={entity.name}
              entityType={entity.type as any}
            />
          ))}
        </div>
      </div>
    );
  };

  const renderLocationTags = (tags: string[] | null) => {
    if (!tags || tags.length === 0) return null;
    
    return (
      <div className="mt-4">
        <div className="flex flex-wrap gap-2">
          {tags.map((tag, index) => (
            <TagBadge
              key={index}
              type="location"
              label={tag}
            />
          ))}
        </div>
      </div>
    );
  };

  const displayCommentCount = localCommentCount !== null ? localCommentCount : 0;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        {/* User Info and Post Meta */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border">
              <AvatarImage src={post.avatar_url || undefined} alt={post.username || 'User'} />
              <AvatarFallback>{(post.username || 'U')[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <UsernameLink 
                userId={post.user_id || ''} 
                username={post.username || 'User'}
                className="hover:underline"
              />
              <div className="flex items-center text-muted-foreground text-xs gap-1">
                <span>{format(new Date(post.created_at), 'MMM d, yyyy')}</span>
                <span>·</span>
                <div className="flex items-center gap-1">
                  {getVisibilityIcon()}
                  <span>{getVisibilityLabel()}</span>
                </div>
              </div>
            </div>
          </div>

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
        
        {/* Post Content */}
        <div className="mt-4">
          <div className={cn("text-sm relative", isExpanded ? "" : "max-h-[120px] overflow-hidden")}>
            <RichTextDisplay content={post.content} />
            {(!isExpanded && post.content && post.content.length > CONTENT_LIMIT) && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background to-transparent h-8" />
            )}
          </div>
          
          {post.content && post.content.length > CONTENT_LIMIT && (
            <Button
              variant="link"
              size="sm"
              className="p-0 h-auto font-normal text-muted-foreground"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? "Show less" : "Show more"}
              <ChevronDown className={cn("h-4 w-4 ml-1 transition-transform", isExpanded && "rotate-180")} />
            </Button>
          )}
        </div>

        {/* Media Content */}
        {post.media && post.media.length > 0 && (
          <PostMediaDisplay 
            media={post.media} 
            className="mt-3 mb-4"
            maxHeight="h-80"
            aspectRatio="maintain"
            objectFit="contain"
          />
        )}
        
        {/* Tag Groups */}
        <div className="space-y-3 mt-4">
          {/* Render location tags */}
          {post.tags && renderLocationTags(post.tags)}
          
          {/* Render entity tags */}
          {post.tagged_entities && renderTaggedEntities(post.tagged_entities)}
        </div>

        {/* Social Actions */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t">
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
            <Share2 className="h-5 w-5" />
          </Button>
        </div>
      </CardContent>
      
      {/* Comments Dialog */}
      {isCommentDialogOpen && (
        <CommentDialog
          isOpen={isCommentDialogOpen}
          onClose={() => setIsCommentDialogOpen(false)}
          itemId={post.id}
          itemType="post"
          onCommentAdded={handleCommentAdded}
        />
      )}
      
      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Post</DialogTitle>
          </DialogHeader>
          <CreatePostForm 
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

export default ProfilePostItem;
