import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Bookmark, Star } from 'lucide-react';
import { format } from 'date-fns';
import { SavedItem } from '@/hooks/use-saved-items';
import UsernameLink from '@/components/common/UsernameLink';
import { useNavigate } from 'react-router-dom';

interface SavedReviewCardProps {
  item: SavedItem;
  onUnsave: () => void;
}

const SavedReviewCard = ({ item, onUnsave }: SavedReviewCardProps) => {
  const navigate = useNavigate();
  const review = item.content;
  const entity = review.entity;
  const CONTENT_LIMIT = 200;

  const handleCardClick = () => {
    if (entity?.slug) {
      navigate(`/entity/${entity.slug}`);
    }
  };

  return (
    <Card className="overflow-hidden cursor-pointer hover:bg-accent/50 transition-colors" onClick={handleCardClick}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-10 w-10 border flex-shrink-0">
              <AvatarImage src={review.avatar_url || undefined} alt={review.username || 'User'} />
              <AvatarFallback>{(review.username || 'U')[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <UsernameLink 
                userId={review.user_id || ''} 
                username={review.username || 'User'}
                className="hover:underline font-medium"
              />
              <p className="text-xs text-muted-foreground">
                Saved {format(new Date(item.saved_at), 'MMM d, yyyy')}
              </p>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0 text-primary"
            onClick={(e) => {
              e.stopPropagation();
              onUnsave();
            }}
          >
            <Bookmark className="h-5 w-5 fill-current" />
          </Button>
        </div>

        {/* Entity info */}
        {entity && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm font-medium">{entity.name}</span>
            {review.rating && (
              <div className="flex items-center gap-1 text-primary">
                <Star className="h-4 w-4 fill-current" />
                <span className="text-sm">{review.rating}</span>
              </div>
            )}
          </div>
        )}

        {review.review_text && (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
            {review.review_text.slice(0, CONTENT_LIMIT)}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default SavedReviewCard;
