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
        // Mock related hashtags based on co-occurrence patterns
        // In production, this would query the database for hashtags that frequently appear together
        const mockRelated: HashtagWithCount[] = [
          { id: '1', name_original: 'Photography', name_norm: 'photography', post_count: 234, created_at: new Date().toISOString() },
          { id: '2', name_original: 'PhotoOfTheDay', name_norm: 'photooftheday', post_count: 189, created_at: new Date().toISOString() },
          { id: '3', name_original: 'NaturePhotography', name_norm: 'naturephotography', post_count: 156, created_at: new Date().toISOString() },
          { id: '4', name_original: 'PortraitPhotography', name_norm: 'portraitphotography', post_count: 143, created_at: new Date().toISOString() },
          { id: '5', name_original: 'StreetPhotography', name_norm: 'streetphotography', post_count: 132, created_at: new Date().toISOString() },
          { id: '6', name_original: 'LandscapePhotography', name_norm: 'landscapephotography', post_count: 128, created_at: new Date().toISOString() },
        ].filter(tag => tag.name_norm !== currentHashtag.toLowerCase());

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setRelatedHashtags(mockRelated.slice(0, limit));
      } catch (error) {
        console.error('Error fetching related hashtags:', error);
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