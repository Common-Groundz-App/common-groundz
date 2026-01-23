import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreVertical, Edit, Trash2, Bell, BellOff, Repeat } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link } from 'react-router-dom';
import EditMyStuffModal from './EditMyStuffModal';
import AlternativesDrawer from './AlternativesDrawer';
import { cn } from '@/lib/utils';
import { getOptimalEntityImageUrl } from '@/utils/entityImageUtils';

interface MyStuffItemCardProps {
  item: any;
  readOnly?: boolean;
  onUpdate?: (data: { id: string; status: string; sentiment_score: number; watch_for_upgrades?: boolean }) => void;
  onDelete?: (id: string) => void;
}

const statusColors = {
  currently_using: 'bg-green-500/10 text-green-700 dark:text-green-400',
  used_before: 'bg-gray-500/10 text-gray-700 dark:text-gray-400',
  want_to_try: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  wishlist: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  stopped: 'bg-red-500/10 text-red-700 dark:text-red-400',
};

const statusLabels = {
  currently_using: 'Currently Using',
  used_before: 'Used Before',
  want_to_try: 'Want to Try',
  wishlist: 'Wishlist',
  stopped: 'Stopped',
};

const MyStuffItemCard = ({ item, readOnly = false, onUpdate, onDelete }: MyStuffItemCardProps) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [isWatching, setIsWatching] = useState(item.watch_for_upgrades || false);

  const handleDelete = () => {
    if (onDelete) {
      onDelete(item.id);
    }
  };

  const handleToggleWatch = () => {
    const newWatchState = !isWatching;
    setIsWatching(newWatchState);
    if (onUpdate) {
      onUpdate({
        id: item.id,
        status: item.status,
        sentiment_score: item.sentiment_score,
        watch_for_upgrades: newWatchState,
      });
    }
  };

  return (
    <>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow">
        {/* Entity Image */}
        {getOptimalEntityImageUrl(item.entity) && (
          <div className="aspect-video bg-muted relative">
            <img 
              src={getOptimalEntityImageUrl(item.entity) || ''} 
              alt={item.entity?.name || 'Entity'}
              className="w-full h-full object-cover"
            />
            {/* Watch indicator */}
            {isWatching && (
              <div className="absolute top-2 right-2">
                <Badge className="bg-primary/90 text-primary-foreground flex items-center gap-1">
                  <Bell className="h-3 w-3" />
                  Watching
                </Badge>
              </div>
            )}
          </div>
        )}

        <div className="p-4">
          {/* Header with status and actions */}
          <div className="flex items-start justify-between mb-2">
            <Badge className={statusColors[item.status as keyof typeof statusColors]}>
              {statusLabels[item.status as keyof typeof statusLabels]}
            </Badge>
            
            {!readOnly && (
              <div className="flex items-center gap-1">
                {/* Watch toggle button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-8 w-8",
                    isWatching && "text-primary"
                  )}
                  onClick={handleToggleWatch}
                  title={isWatching ? "Stop watching for upgrades" : "Watch for upgrades"}
                >
                  {isWatching ? (
                    <Bell className="h-4 w-4 fill-current" />
                  ) : (
                    <BellOff className="h-4 w-4" />
                  )}
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setShowAlternatives(true)}>
                      <Repeat className="mr-2 h-4 w-4" />
                      Find alternatives
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setShowEditModal(true)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={handleDelete}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {/* Entity Name */}
          <Link 
            to={`/entity/${item.entity?.slug}`}
            className="block group"
          >
            <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors line-clamp-2">
              {item.entity?.name}
            </h3>
          </Link>

          {/* Entity Type */}
          <p className="text-sm text-muted-foreground mb-3 capitalize">
            {item.entity?.type}
          </p>

          {/* Sentiment Score */}
          {item.sentiment_score !== null && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm text-muted-foreground">Sentiment:</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
                  style={{ 
                    width: `${((item.sentiment_score + 5) / 10) * 100}%` 
                  }}
                />
              </div>
              <span className="text-sm font-medium">{item.sentiment_score}</span>
            </div>
          )}

          {/* Source Badge */}
          <Badge variant="outline" className="text-xs">
            {item.source === 'manual' ? 'Added manually' : `From ${item.source.replace('auto_', '')}`}
          </Badge>
        </div>
      </Card>

      <EditMyStuffModal 
        open={showEditModal} 
        onOpenChange={setShowEditModal}
        item={item}
        onUpdate={onUpdate}
      />

      <AlternativesDrawer
        open={showAlternatives}
        onOpenChange={setShowAlternatives}
        entityId={item.entity?.id}
        entityName={item.entity?.name}
      />
    </>
  );
};

export default MyStuffItemCard;
