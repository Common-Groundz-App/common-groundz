import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface PostTextRendererProps {
  content: string;
  className?: string;
}

/**
 * Unified text renderer for post content.
 * Handles both #hashtags and @mentions in a single pass.
 * - Hashtags: blue link to /t/{tag}
 * - Mentions: orange (text-primary) link to /u/{username}, matching comment MentionText styling
 * 
 * Safeguards:
 * - Skips @mentions preceded by non-whitespace (e.g. email@test.com)
 * - Skips @mentions inside URLs
 */

// Combined regex: captures hashtags and potential mentions
const TOKEN_REGEX = /(#[a-zA-Z]\w*)|(@[a-z0-9._]+)/gi;

function isInsideUrl(text: string, matchIndex: number): boolean {
  // Check if the match is part of a URL by looking backwards for http(s)://
  const before = text.substring(Math.max(0, matchIndex - 30), matchIndex);
  return /https?:\/\/\S*$/.test(before);
}

function isValidMentionBoundary(text: string, matchIndex: number): boolean {
  // @ must be at start of string or preceded by whitespace
  if (matchIndex === 0) return true;
  const charBefore = text[matchIndex - 1];
  return /\s/.test(charBefore);
}

export const PostTextRenderer: React.FC<PostTextRendererProps> = ({ content, className }) => {
  if (!content) return null;

  const segments: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(TOKEN_REGEX);

  while ((match = regex.exec(content)) !== null) {
    // Push text before this match
    if (match.index > lastIndex) {
      segments.push(<span key={`t-${lastIndex}`}>{content.slice(lastIndex, match.index)}</span>);
    }

    const hashtagMatch = match[1];
    const mentionMatch = match[2];

    if (hashtagMatch) {
      const normalized = hashtagMatch.slice(1).toLowerCase();
      segments.push(
        <Link
          key={`h-${match.index}`}
          to={`/t/${normalized}`}
          className="text-blue-500 hover:text-blue-600 hover:underline transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {hashtagMatch}
        </Link>
      );
    } else if (mentionMatch) {
      const username = mentionMatch.slice(1);
      
      if (
        isValidMentionBoundary(content, match.index) &&
        !isInsideUrl(content, match.index)
      ) {
        segments.push(
          <Link
            key={`m-${match.index}`}
            to={`/u/${username}`}
            className="text-primary font-medium hover:underline transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {mentionMatch}
          </Link>
        );
      } else {
        // Not a valid mention — render as plain text
        segments.push(<span key={`p-${match.index}`}>{mentionMatch}</span>);
      }
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < content.length) {
    segments.push(<span key={`t-${lastIndex}`}>{content.slice(lastIndex)}</span>);
  }

  return <div className={cn("min-w-0 whitespace-pre-wrap", className)}>{segments}</div>;
};

export default PostTextRenderer;
