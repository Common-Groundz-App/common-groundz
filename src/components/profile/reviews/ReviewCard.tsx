
import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Heart, 
  Bookmark, 
  MessageCircle, 
  Share2, 
  MoreHorizontal,
  Edit,
  Trash2,
  Star,
  MapPin,
  Calendar,
  TrendingUp,
  Clock
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { Review } from '@/services/reviewService';
import ConnectedRingsRating from '@/components/recommendations/ConnectedRingsRating';
import ReviewForm from './ReviewForm';
import DeleteConfirmationDialog from '@/components/common/DeleteConfirmationDialog';
import { useToast } from '@/hooks/use-toast';
import { deleteReview } from '@/services/reviewService';

interface ReviewCardProps {
  review: Review;
  onLike: (id: string) => void;
  onSave: (id: string) => void;
  onDeleted?: () => void;
  showTimelineIndicator?: boolean;
}

const ReviewCard = ({ 
  review, 
  onLike, 
  onSave, 
  onDeleted,
  showTimelineIndicator = false
}: ReviewCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOwnReview = user?.id === review.user_id;
  const isLiked = review.isLiked || false;
  const isSaved = review.isSaved || false;
  const isRecommendation = review.is_recommended || false;

  const getCategoryEmoji = (category: string) => {
    switch(category) {
      case 'food': return '🍽️';
      case 'movie': return '🎬';
      case 'book': return '📚';
      case 'place': return '📍';
      case 'product': return '🛍️';
      default: return '✨';
    }
  };

  const handleDelete = async () => {
    if (!user || !isOwnReview) return;
    
    setIsDeleting(true);
    try {
      const success = await deleteReview(review.id);
      if (success) {
        toast({
          title: "Review deleted",
          description: "Your review has been deleted successfully"
        });
        onDeleted?.();
      } else {
        throw new Error('Failed to delete review');
      }
    } catch (error) {
      console.error('Error deleting review:', error);
      toast({
        title: "Error",
        description: "Failed to delete review. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleEditSubmit = async () => {
    setIsEditFormOpen(false);
    onDeleted?.(); // Refresh the reviews list
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: review.title,
        text: review.description,
        url: window.location.href
      });
    } catch (error) {
      // Fallback to copying to clipboard
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link copied",
        description: "Review link copied to clipboard"
      });
    }
  };

  return (
    <>
      <Card className="hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <Avatar className="h-10 w-10">
                <AvatarImage src={review.user?.avatar_url} />
                <AvatarFallback>
                  {review.user?.username?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm">{review.user?.username || 'Anonymous'}</p>
                  <span className="text-muted-foreground">•</span>
                  <p className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                  </p>
                  {review.updated_at !== review.created_at && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <p className="text-xs text-muted-foreground">edited</p>
                    </>
                  )}
                </div>
                
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs">
                    <span className="mr-1">{getCategoryEmoji(review.category)}</span>
                    {review.category}
                  </Badge>
                  {isRecommendation && (
                    <Badge className="text-xs bg-brand-orange/10 text-brand-orange border-brand-orange/30">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      Recommended
                    </Badge>
                  )}
                  {showTimelineIndicator && review.has_timeline && (
                    <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200">
                      <Clock className="h-3 w-3 mr-1" />
                      Timeline
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {isOwnReview && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditFormOpen(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setIsDeleteDialogOpen(true)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Rating */}
          <div className="flex items-center gap-2 mb-3">
            <ConnectedRingsRating 
              value={review.rating} 
              size="sm" 
              showValue={false}
              isInteractive={false}
            />
            <span className="text-sm font-medium">{review.rating}/5</span>
          </div>

          {/* Title and Venue */}
          <div className="space-y-2 mb-3">
            <h3 className="font-semibold text-lg leading-tight">{review.title}</h3>
            {review.subtitle && (
              <p className="text-sm font-medium text-muted-foreground">{review.subtitle}</p>
            )}
            {review.venue && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>{review.venue}</span>
              </div>
            )}
          </div>

          {/* Description */}
          {review.description && (
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              {review.description}
            </p>
          )}

          {/* Experience Date */}
          {review.experience_date && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
              <Calendar className="h-3 w-3" />
              <span>
                Experienced on {new Date(review.experience_date).toLocaleDateString()}
              </span>
            </div>
          )}

          {/* Image */}
          {review.image_url && (
            <div className="mb-4">
              <img
                src={review.image_url}
                alt={review.title}
                className="w-full h-48 object-cover rounded-lg"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onLike(review.id)}
                className={`text-xs ${isLiked ? 'text-red-500 hover:text-red-600' : 'text-muted-foreground hover:text-red-500'}`}
              >
                <Heart className={`h-4 w-4 mr-1 ${isLiked ? 'fill-current' : ''}`} />
                {review.likes || 0}
              </Button>

              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                <MessageCircle className="h-4 w-4 mr-1" />
                {review.comment_count || 0}
              </Button>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSave(review.id)}
                className={`text-xs ${isSaved ? 'text-brand-orange hover:text-brand-orange/80' : 'text-muted-foreground hover:text-brand-orange'}`}
              >
                <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleShare}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Form Modal */}
      <ReviewForm
        isOpen={isEditFormOpen}
        onClose={() => setIsEditFormOpen(false)}
        onSubmit={handleEditSubmit}
        review={review}
        isEditMode={true}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title="Delete this review?"
        description="This action cannot be undone. Your review will be permanently deleted."
        isLoading={isDeleting}
      />
    </>
  );
};

export default ReviewCard;
