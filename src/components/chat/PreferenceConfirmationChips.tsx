import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface DetectedPreference {
  type: 'avoid' | 'preference';
  value: string;
  scope: string;
  confidence: number;
}

interface PreferenceConfirmationChipsProps {
  preference: DetectedPreference;
  onSaveAsAvoid: () => void;
  onSaveAsPreference: () => void;
  onDismiss: () => void;
}

export function PreferenceConfirmationChips({
  preference,
  onSaveAsAvoid,
  onSaveAsPreference,
  onDismiss,
}: PreferenceConfirmationChipsProps) {
  const defaultType = preference.type;

  return (
    <div className="flex items-center gap-2 mt-2 ml-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <span className="text-xs text-muted-foreground">Save as:</span>
      <Button
        variant={defaultType === 'avoid' ? 'default' : 'outline'}
        size="sm"
        className={cn(
          "h-6 text-xs px-2",
          defaultType === 'avoid' && "bg-destructive/90 hover:bg-destructive text-destructive-foreground"
        )}
        onClick={onSaveAsAvoid}
      >
        🚫 Avoid
      </Button>
      <Button
        variant={defaultType === 'preference' ? 'default' : 'outline'}
        size="sm"
        className={cn(
          "h-6 text-xs px-2",
          defaultType === 'preference' && "bg-primary hover:bg-primary/90"
        )}
        onClick={onSaveAsPreference}
      >
        ⭐ Preference
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 text-xs px-2 text-muted-foreground hover:text-foreground"
        onClick={onDismiss}
      >
        ✖ Ignore
      </Button>
    </div>
  );
}
