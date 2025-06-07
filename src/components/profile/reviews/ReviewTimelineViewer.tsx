
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar, User } from 'lucide-react';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { fetchReviewUpdates, addReviewUpdate, type ReviewUpdate } from '@/services/reviewService';
import { formatRelativeDate } from '@/utils/dateUtils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface ReviewTimelineViewerProps {
  isOpen: boolean;
  onClose: () => void;
  reviewId: string;
  reviewOwnerId: string;
  reviewTitle: string;
  initialRating: number;
  onTimelineUpdate?: () => void;
}

export const ReviewTimelineViewer = ({
  isOpen,
  onClose,
  reviewId,
  reviewOwnerId,
  reviewTitle,
  initialRating,
  onTimelineUpdate
}: ReviewTimelineViewerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [timelineUpdates, setTimelineUpdates] = useState<ReviewUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingUpdate, setIsAddingUpdate] = useState(false);
  const [newRating, setNewRating] = useState<number | null>(null);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOwner = user?.id === reviewOwnerId;

  useEffect(() => {
    if (isOpen) {
      loadTimelineUpdates();
    }
  }, [isOpen, reviewId]);

  const loadTimelineUpdates = async () => {
    setIsLoading(true);
    try {
      const updates = await fetchReviewUpdates(reviewId);
      setTimelineUpdates(updates);
    } catch (error) {
      console.error('Error loading timeline updates:', error);
      toast({
        title: 'Error',
        description: 'Failed to load timeline updates',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUpdate = async () => {
    if (!user || !newComment.trim()) {
      toast({
        title: 'Error',
        description: 'Please add a comment for your update',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await addReviewUpdate(reviewId, user.id, newRating, newComment.trim());
      
      if (success) {
        toast({
          title: 'Update added',
          description: 'Your timeline update has been added successfully'
        });
        
        // Reset form
        setNewRating(null);
        setNewComment('');
        setIsAddingUpdate(false);
        
        // Reload timeline updates
        await loadTimelineUpdates();
        
        // Notify parent component to refresh data
        if (onTimelineUpdate) {
          onTimelineUpdate();
        }
      } else {
        throw new Error('Failed to add update');
      }
    } catch (error) {
      console.error('Error adding timeline update:', error);
      toast({
        title: 'Error',
        description: 'Failed to add timeline update',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Timeline for "{reviewTitle}"
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse">
                  <div className="flex items-start gap-3 p-4 border rounded-lg">
                    <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Initial Review Entry */}
              <div className="p-4 border-2 border-primary/20 rounded-lg bg-primary/5">
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="bg-primary/10 text-primary">
                    Initial Review
                  </Badge>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <ConnectedRingsRating
                    value={initialRating}
                    variant="badge"
                    showValue={false}
                    size="sm"
                    minimal={true}
                  />
                  <span className="font-medium">{initialRating.toFixed(1)}</span>
                </div>
              </div>

              {/* Timeline Updates */}
              {timelineUpdates.map((update, index) => (
                <div key={update.id} className="p-4 border rounded-lg bg-card">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={update.profiles?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(update.profiles?.username || null)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-sm">
                          {update.profiles?.username || 'User'}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          Update #{timelineUpdates.length - index}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatRelativeDate(update.created_at)}
                        </div>
                      </div>
                      
                      {update.rating && (
                        <div className="flex items-center gap-2 mb-2">
                          <ConnectedRingsRating
                            value={update.rating}
                            variant="badge"
                            showValue={false}
                            size="sm"
                            minimal={true}
                          />
                          <span className="font-medium">{update.rating.toFixed(1)}</span>
                        </div>
                      )}
                      
                      <p className="text-sm text-muted-foreground">
                        {update.comment}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {timelineUpdates.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No timeline updates yet.</p>
                  {isOwner && (
                    <p className="text-sm mt-1">Be the first to add an update!</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Add Update Section for Review Owner */}
        {isOwner && (
          <div className="border-t pt-4 mt-4">
            {!isAddingUpdate ? (
              <Button
                onClick={() => setIsAddingUpdate(true)}
                className="w-full gap-2"
                variant="outline"
              >
                <Plus className="h-4 w-4" />
                Add Timeline Update
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">New Rating (optional)</label>
                  <div className="flex items-center gap-3">
                    <ConnectedRingsRating
                      value={newRating || 0}
                      onChange={setNewRating}
                      variant="default"
                      size="md"
                      showValue={false}
                      isInteractive={true}
                    />
                    {newRating && (
                      <span className="font-medium">{newRating.toFixed(1)}</span>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Update Comment *</label>
                  <Textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Share what's changed in your experience..."
                    rows={3}
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button
                    onClick={handleAddUpdate}
                    disabled={isSubmitting || !newComment.trim()}
                    className="flex-1"
                  >
                    {isSubmitting ? 'Adding...' : 'Add Update'}
                  </Button>
                  <Button
                    onClick={() => {
                      setIsAddingUpdate(false);
                      setNewRating(null);
                      setNewComment('');
                    }}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
