
import React from 'react';

interface ContentErrorProps {
  message?: string;
}

const ContentError = ({ message }: ContentErrorProps) => {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center">
        <h3 className="font-medium mb-2">Content Not Available</h3>
        <p className="text-muted-foreground text-sm">{message || 'This content is no longer available'}</p>
      </div>
    </div>
  );
};

export default ContentError;
