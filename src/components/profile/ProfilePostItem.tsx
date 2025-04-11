
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Tag, MoreVertical, Pencil, Trash2 } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import DeleteConfirmationDialog from '@/components/common/DeleteConfirmationDialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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
}

interface ProfilePostItemProps {
  post: Post;
  onDeleted?: () => void;
}

const ProfilePostItem = ({ post, onDeleted }: ProfilePostItemProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const isOwner = user?.id === post.user_id;

  const getPostTypeLabel = (type: string) => {
    switch(type) {
      case 'story': return 'Story';
      case 'routine': return 'Routine';
      case 'project': return 'Project';
      case 'note': return 'Note';
      default: return type;
    }
  };

  const getVisibilityLabel = (visibility: string) => {
    switch(visibility) {
      case 'public': return 'Public';
      case 'circle_only': return 'Circle Only';
      case 'private': return 'Private';
      default: return visibility;
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

  const handleEdit = () => {
    // Navigate to edit page
    navigate(`/posts/edit/${post.id}`);
  };

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!user) return;
    
    setIsDeleting(true);
    try {
      // Soft delete the post
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
      
      // Call onDeleted callback if provided
      if (onDeleted) {
        onDeleted();
      }
      
      // Force a refresh of the profile posts
      window.dispatchEvent(new CustomEvent('refresh-profile-posts'));
    } catch (error) {
      console.error("Error deleting post:", error);
      toast({
        title: "Error",
        description: "Failed to delete post",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold">{post.title}</h3>
            <div className="flex gap-2 mt-1">
              <Badge variant="outline">{getPostTypeLabel(post.post_type)}</Badge>
              <Badge variant="outline" className={post.visibility !== 'public' ? 'bg-muted' : ''}>
                {getVisibilityLabel(post.visibility)}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center text-muted-foreground text-sm">
              <Clock size={14} className="mr-1" />
              <span>{format(new Date(post.created_at), 'MMM d, yyyy')}</span>
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
        </div>
        
        <div className="text-muted-foreground">
          <RichTextDisplay content={post.content} />
        </div>
        
        {/* Display media items if available */}
        {post.media && post.media.length > 0 && (
          <div className="mt-4">
            <PostMediaDisplay 
              media={post.media}
              displayType={post.media.length > 1 ? 'carousel' : 'grid'} 
            />
          </div>
        )}
        
        {/* Display tagged entities */}
        {post.tagged_entities && post.tagged_entities.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
              <Tag size={14} />
              <span>Tagged:</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {post.tagged_entities.map(entity => (
                <Badge
                  key={entity.id}
                  className={cn("font-normal", getEntityTypeColor(entity.type))}
                  variant="outline"
                >
                  {entity.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      
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

export default ProfilePostItem;
