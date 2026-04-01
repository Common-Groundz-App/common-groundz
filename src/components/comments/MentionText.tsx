
import React from 'react';
import { Link } from 'react-router-dom';

interface MentionTextProps {
  content: string;
}

const MENTION_REGEX = /@([a-z0-9._]+)/gi;

const MentionText: React.FC<MentionTextProps> = ({ content }) => {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(MENTION_REGEX);

  while ((match = regex.exec(content)) !== null) {
    // Text before the match
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }

    const username = match[1];
    parts.push(
      <Link
        key={`${match.index}-${username}`}
        to={`/u/${username}`}
        className="text-primary font-medium hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        @{username}
      </Link>
    );

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return <>{parts}</>;
};

export default MentionText;
