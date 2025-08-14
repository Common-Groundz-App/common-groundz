import React from 'react';
import { Link } from 'react-router-dom';
import { parseHashtagsForDisplay } from '@/utils/hashtag';
import { cn } from '@/lib/utils';

interface HashtagRendererProps {
  content: string;
  className?: string;
}

export const HashtagRenderer: React.FC<HashtagRendererProps> = ({ 
  content, 
  className 
}) => {
  const segments = parseHashtagsForDisplay(content);
  
  return (
    <div className={cn("min-w-0", className)}>
      {segments.map((segment, index) => {
        if (segment.type === 'hashtag' && segment.normalized) {
          return (
            <Link
              key={index}
              to={`/t/${segment.normalized}`}
              className="text-blue-500 hover:text-blue-600 hover:underline transition-colors"
            >
              {segment.content}
            </Link>
          );
        }
        
        return (
          <span key={index}>
            {segment.content}
          </span>
        );
      })}
    </div>
  );
};

export default HashtagRenderer;