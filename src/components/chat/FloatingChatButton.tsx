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
        "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg transition-all z-50",
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
