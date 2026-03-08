import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Bookmark } from 'lucide-react';
import { format } from 'date-fns';
import { SavedItem } from '@/hooks/use-saved-items';
import UsernameLink from '@/components/common/UsernameLink';
import { useNavigate } from 'react-router-dom';

interface SavedRecommendationCardProps {
  item: SavedItem;
  onUnsave: () => void;
}

const SavedRecommendationCard = ({ item, onUnsave }: SavedRecommendationCardProps) => {
  const navigate = useNavigate();
  const rec = item.content;
  const entity = rec.entity;
  const CONTENT_LIMIT = 200;

  const handleCardClick = () => {
    navigate(`/recommendation/${rec.id}`);
  };

  return (
    <Card className="overflow-hidden cursor-pointer hover:bg-accent/50 transition-colors" onClick={handleCardClick}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-10 w-10 border flex-shrink-0">
              <AvatarImage src={rec.avatar_url || undefined} alt={rec.username || 'User'} />
              <AvatarFallback>{(rec.username || 'U')[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <UsernameLink 
                userId={rec.user_id || ''} 
                username={rec.username || 'User'}
                className="hover:underline font-medium"
                onClick={(e) => e.stopPropagation()}
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

        {/* Title and entity */}
        <div className="mt-3">
          {rec.title && (
            <h4 className="font-medium text-sm">{rec.title}</h4>
          )}
          {entity && (
            <p className="text-xs text-muted-foreground mt-1">{entity.name}</p>
          )}
        </div>

        {rec.description && (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
            {rec.description.slice(0, CONTENT_LIMIT)}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default SavedRecommendationCard;
