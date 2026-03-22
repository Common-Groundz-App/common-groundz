import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Bookmark } from 'lucide-react';
import { format } from 'date-fns';
import { SavedItem } from '@/hooks/use-saved-items';
import UsernameLink from '@/components/common/UsernameLink';
import { getInitialsFromName } from '@/utils/profileUtils';
import { RichTextDisplay } from '@/components/editor/RichTextEditor';
import { useNavigate } from 'react-router-dom';

interface SavedPostCardProps {
  item: SavedItem;
  onUnsave: () => void;
}

const SavedPostCard = ({ item, onUnsave }: SavedPostCardProps) => {
  const navigate = useNavigate();
  const post = item.content;
  const CONTENT_LIMIT = 200;

  const handleCardClick = () => {
    navigate(`/post/${post.id}`);
  };

  return (
    <Card className="overflow-hidden cursor-pointer hover:bg-accent/50 transition-colors" onClick={handleCardClick}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-10 w-10 border flex-shrink-0">
              <AvatarImage src={post.avatar_url || undefined} alt={post.username || 'User'} />
              <AvatarFallback className="bg-brand-orange text-white">{getInitialsFromName(post.displayName || post.username)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <UsernameLink 
                userId={post.user_id || ''} 
                username={post.username || 'User'}
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

        {post.content && (
          <div className="mt-3 text-sm text-muted-foreground line-clamp-3">
            <RichTextDisplay content={post.content.slice(0, CONTENT_LIMIT)} />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SavedPostCard;
