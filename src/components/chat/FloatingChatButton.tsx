import { MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FloatingChatButtonProps {
  isOpen: boolean;
  onClick: () => void;
  unreadCount?: number;
}

export function FloatingChatButton({ isOpen, onClick, unreadCount = 0 }: FloatingChatButtonProps) {
  return (
    <Button
      onClick={onClick}
      variant="gradient"
      size="icon"
      className={cn(
        "fixed h-14 w-14 rounded-full shadow-lg transition-all z-50",
        // Mobile/Tablet (<xl): Above bottom nav with safe area, capped at 25vh max
        "bottom-[clamp(1.5rem,calc(4rem+env(safe-area-inset-bottom)+1.5rem),25vh)]",
        "right-[calc(1.5rem+env(safe-area-inset-right))]",
        // Desktop (xl+): Standard corner position (no bottom nav)
        "xl:bottom-6 xl:right-6",
        "hover:scale-110 active:scale-95",
        isOpen && "rotate-90"
      )}
      aria-label={isOpen ? "Close chat" : "Open chat"}
    >
      {isOpen ? (
        <X className="h-6 w-6" />
      ) : (
        <>
          <MessageCircle className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </>
      )}
    </Button>
  );
}
