import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Hash, Loader2 } from 'lucide-react';
import { HashtagWithCount } from '@/services/hashtagService';

interface HashtagSuggestionsProps {
  currentHashtag: string;
  limit?: number;
  onHashtagClick?: (hashtag: string) => void;
  className?: string;
}

export const HashtagSuggestions: React.FC<HashtagSuggestionsProps> = ({
  currentHashtag,
  limit = 6,
  onHashtagClick,
  className
}) => {
  const [relatedHashtags, setRelatedHashtags] = useState<HashtagWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRelatedHashtags = async () => {
      setLoading(true);
      try {
        const { getRelatedHashtags, getTrendingHashtags } = await import('@/services/hashtagService');
        
        // Try to get related hashtags first
        let related = await getRelatedHashtags(currentHashtag, limit * 2);
        
        // Filter out the current hashtag
        related = related.filter(tag => tag.name_norm !== currentHashtag.toLowerCase());
        
        // If we don't have enough related hashtags, supplement with trending ones
        if (related.length < limit) {
          const trending = await getTrendingHashtags(limit * 2);
          const filteredTrending = trending.filter(tag => 
            tag.name_norm !== currentHashtag.toLowerCase() &&
            !related.some(r => r.name_norm === tag.name_norm)
          );
          
          // Combine related and trending, up to the limit
          related = [...related, ...filteredTrending].slice(0, limit);
        }
        
        setRelatedHashtags(related);
      } catch (error) {
        console.error('Error fetching related hashtags:', error);
        setRelatedHashtags([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRelatedHashtags();
  }, [currentHashtag, limit]);

  const handleHashtagClick = (hashtag: string) => {
    if (onHashtagClick) {
      onHashtagClick(hashtag);
    } else {
      navigate(`/t/${hashtag}`);
    }
  };

  if (loading) {
    return (
      <div className={cn("space-y-3", className)}>
        <h3 className="text-sm font-medium text-muted-foreground">Related hashtags</h3>
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading suggestions...</span>
        </div>
      </div>
    );
  }

  if (relatedHashtags.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      <h3 className="text-sm font-medium text-muted-foreground">Related hashtags</h3>
      <div className="flex flex-wrap gap-2">
        {relatedHashtags.map((hashtag) => (
          <button
            key={hashtag.id}
            onClick={() => handleHashtagClick(hashtag.name_norm)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-muted/80 rounded-full text-sm transition-colors group"
          >
            <Hash className="h-3 w-3 text-primary" />
            <span className="font-medium">{hashtag.name_original}</span>
            <span className="text-xs text-muted-foreground">
              {hashtag.post_count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default HashtagSuggestions;