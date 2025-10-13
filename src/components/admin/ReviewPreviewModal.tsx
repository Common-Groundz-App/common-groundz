
import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AdminReview, ReviewUpdate } from '@/hooks/admin/useAdminReviews';
import { formatDistanceToNow } from 'date-fns';
import { Star, Clock, User } from 'lucide-react';
import { getEntityTypeLabel } from '@/services/entityTypeHelpers';

interface ReviewPreviewModalProps {
  review: AdminReview | null;
  updates: ReviewUpdate[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ReviewPreviewModal: React.FC<ReviewPreviewModalProps> = ({
  review,
  updates,
  isOpen,
  onOpenChange
}) => {
  if (!review) return null;

  const formatDate = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Review Details
            {review.ai_summary && (
              <Badge variant="default" className="bg-green-100 text-green-800">
                ✅ AI Summary Generated
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Review Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {review.title}
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                      }`}
                    />
                  ))}
                  <span className="ml-2 text-sm text-muted-foreground">
                    {review.rating}/5
                  </span>
                </div>
              </CardTitle>
              <CardDescription className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {review.user?.username || 'Unknown User'}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {formatDate(review.created_at)}
                </span>
                {review.entity && (
                  <span>
                    {review.entity.name} ({getEntityTypeLabel(review.entity.type)})
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            {review.description && (
              <CardContent>
                <p className="text-sm leading-relaxed">{review.description}</p>
              </CardContent>
            )}
          </Card>

          {/* Timeline Updates */}
          {updates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Timeline Updates ({updates.length})</CardTitle>
                <CardDescription>
                  Updates to this review over time
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {updates.map((update, index) => (
                  <div key={update.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          Update {index + 1}
                        </span>
                        {update.rating && (
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3 w-3 ${
                                  i < update.rating! ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                                }`}
                              />
                            ))}
                            <span className="text-xs text-muted-foreground">
                              {update.rating}/5
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(update.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground pl-4 border-l-2 border-muted">
                      {update.comment}
                    </p>
                    {index < updates.length - 1 && <Separator className="my-2" />}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* AI Summary */}
          {review.ai_summary && (
            <Card>
              <CardHeader>
                <CardTitle>AI Summary</CardTitle>
                <CardDescription>
                  Generated {review.ai_summary_last_generated_at && 
                    formatDate(review.ai_summary_last_generated_at)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed bg-muted p-4 rounded-lg">
                  {review.ai_summary}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
