import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bookmark, MapPin, ShoppingBag, Book, Clapperboard, Coffee } from 'lucide-react';
import { format } from 'date-fns';
import { SavedItem } from '@/hooks/use-saved-items';
import { useNavigate } from 'react-router-dom';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';

interface SavedEntityCardProps {
  item: SavedItem;
  onUnsave: () => void;
}

const getEntityIcon = (type: string) => {
  switch (type) {
    case 'place':
      return MapPin;
    case 'product':
      return ShoppingBag;
    case 'book':
      return Book;
    case 'movie':
    case 'show':
      return Clapperboard;
    default:
      return Coffee;
  }
};

const SavedEntityCard = ({ item, onUnsave }: SavedEntityCardProps) => {
  const navigate = useNavigate();
  const entity = item.content;
  const Icon = getEntityIcon(entity.type);

  const handleCardClick = () => {
    if (entity.slug) {
      navigate(`/entity/${entity.slug}`);
    }
  };

  return (
    <Card className="overflow-hidden cursor-pointer hover:bg-accent/50 transition-colors" onClick={handleCardClick}>
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Entity Image */}
          <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
            {entity.image_url ? (
              <ImageWithFallback
                src={entity.image_url}
                alt={entity.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Icon className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Entity Info */}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0">
                <h4 className="font-medium text-sm truncate">{entity.name}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground capitalize">{entity.type}</span>
                  <span className="text-xs text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">
                    Saved {format(new Date(item.saved_at), 'MMM d, yyyy')}
                  </span>
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

            {entity.description && (
              <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                {entity.description.slice(0, 150)}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SavedEntityCard;
