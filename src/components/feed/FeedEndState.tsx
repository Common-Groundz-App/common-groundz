
import React from 'react';
import { CheckCircle } from 'lucide-react';

const FeedEndState = () => {
  return (
    <div className="py-8 text-center">
      <div className="flex justify-center mb-3">
        <CheckCircle className="h-8 w-8 text-brand-orange opacity-60" />
      </div>
      <p className="text-base font-medium text-foreground mb-1">
        You're all caught up!
      </p>
      <p className="text-sm text-muted-foreground">
        You've seen all available posts
      </p>
    </div>
  );
};

export default FeedEndState;
