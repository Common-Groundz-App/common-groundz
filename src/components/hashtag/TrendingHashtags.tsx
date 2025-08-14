import React from 'react';
import { Hash, TrendingUp, Flame, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { HashtagWithCount } from '@/services/hashtagService';

interface TrendingHashtagsProps {
  hashtags: HashtagWithCount[];
  limit?: number;
  displayMode?: 'compact' | 'full' | 'grid';
  showGrowth?: boolean;
  onHashtagClick?: (hashtag: string) => void;
  isLoading?: boolean;
}

const getTrendIndicator = (hashtag: HashtagWithCount) => {
  if (hashtag.post_count > 100) return { icon: Flame, color: 'text-red-500', label: 'Hot' };
  if (hashtag.post_count > 50) return { icon: TrendingUp, color: 'text-orange-500', label: 'Trending' };
  return { icon: Star, color: 'text-yellow-500', label: 'Rising' };
};

export function TrendingHashtags({ 
  hashtags, 
  limit = 6, 
  displayMode = 'grid', 
  showGrowth = true, 
  onHashtagClick,
  isLoading = false 
}: TrendingHashtagsProps) {
  const navigate = useNavigate();
  
  const handleClick = (hashtag: HashtagWithCount) => {
    if (onHashtagClick) {
      onHashtagClick(hashtag.name_norm);
    } else {
      navigate(`/t/${hashtag.name_norm}`);
    }
  };

  const displayedHashtags = hashtags.slice(0, limit);

  if (isLoading) {
    return (
      <div className={`${displayMode === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-3'}`}>
        {Array.from({ length: limit }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-16 bg-muted rounded-lg"></div>
          </div>
        ))}
      </div>
    );
  }

  if (displayedHashtags.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Hash className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No trending hashtags right now</p>
      </div>
    );
  }

  if (displayMode === 'compact') {
    return (
      <div className="space-y-2">
        {displayedHashtags.map((hashtag) => {
          const indicator = getTrendIndicator(hashtag);
          const IconComponent = indicator.icon;
          
          return (
            <div
              key={hashtag.id}
              onClick={() => handleClick(hashtag)}
              className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <Hash className="w-4 h-4 text-primary" />
                <div>
                  <p className="font-medium text-sm">#{hashtag.name_original}</p>
                  <p className="text-xs text-muted-foreground">{hashtag.post_count} posts</p>
                </div>
              </div>
              <IconComponent className={`w-4 h-4 ${indicator.color}`} />
            </div>
          );
        })}
      </div>
    );
  }

  if (displayMode === 'grid') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {displayedHashtags.map((hashtag) => {
          const indicator = getTrendIndicator(hashtag);
          const IconComponent = indicator.icon;
          
          return (
            <div
              key={hashtag.id}
              onClick={() => handleClick(hashtag)}
              className="p-4 bg-card border rounded-lg hover:bg-muted/50 cursor-pointer transition-all hover:shadow-md group"
            >
              <div className="flex items-start justify-between mb-2">
                <Hash className="w-5 h-5 text-primary group-hover:text-brand-orange transition-colors" />
                <IconComponent className={`w-4 h-4 ${indicator.color}`} />
              </div>
              <div>
                <p className="font-medium text-sm mb-1 line-clamp-1">#{hashtag.name_original}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{hashtag.post_count} posts</span>
                  {showGrowth && (
                    <span className={indicator.color}>{indicator.label}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Full display mode
  return (
    <div className="space-y-4">
      {displayedHashtags.map((hashtag, index) => {
        const indicator = getTrendIndicator(hashtag);
        const IconComponent = indicator.icon;
        
        return (
          <div
            key={hashtag.id}
            onClick={() => handleClick(hashtag)}
            className="p-4 bg-card border rounded-lg hover:bg-muted/50 cursor-pointer transition-all hover:shadow-md"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                  <span className="text-sm font-bold text-primary">#{index + 1}</span>
                </div>
                <div>
                  <p className="font-semibold">#{hashtag.name_original}</p>
                  <p className="text-sm text-muted-foreground">{hashtag.post_count} posts</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${indicator.color}`}>{indicator.label}</span>
                <IconComponent className={`w-5 h-5 ${indicator.color}`} />
              </div>
            </div>
            {showGrowth && (
              <div className="text-xs text-muted-foreground">
                Growing in popularity across the platform
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}