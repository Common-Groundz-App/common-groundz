
import React from 'react';
import { Shell } from 'lucide-react';

const ContentLoading = () => {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex flex-col items-center gap-2">
        <Shell className="h-8 w-8 animate-pulse text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading content...</p>
      </div>
    </div>
  );
};

export default ContentLoading;
