import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LastUpdatedIndicator } from './LastUpdatedIndicator';

interface OfflineInlineStateProps {
  message: string;
  onRetry?: () => void;
  lastRefresh?: Date | null;
}

export const OfflineInlineState: React.FC<OfflineInlineStateProps> = ({
  message,
  onRetry,
  lastRefresh,
}) => {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/60 border border-border/40 text-muted-foreground text-sm">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {lastRefresh && <LastUpdatedIndicator date={lastRefresh} />}
      {onRetry && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={onRetry}
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      )}
    </div>
  );
};
