
import React, { useState, useCallback } from 'react';
import { Bell, Check, Loader2 } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useContentViewer } from '@/contexts/ContentViewerContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { EntityType } from '@/services/notificationService';
import { cn } from '@/lib/utils';

export const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, markAsRead, loading } = useNotifications();
  const { openContent } = useContentViewer();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const handleDropdownChange = (val: boolean) => {
    setOpen(val);
    if (val && unreadCount > 0) {
      // Mark all unread as read when opened
      const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
      if (unreadIds.length > 0) markAsRead(unreadIds);
    }
  };

  const handleNotificationClick = useCallback((notification: any, event: React.MouseEvent) => {
    event.preventDefault();
    setOpen(false);
    
    if (!notification.entity_type || !notification.entity_id) {
      // If there's no entity information, try using the action URL directly
      if (notification.action_url) {
        navigate(notification.action_url);
      } else {
        toast({
          description: "This notification doesn't have any associated content"
        });
      }
      return;
    }
    
    // Extract comment ID from metadata if available
    const commentId = notification.metadata?.comment_id || null;
    
    // Handle click based on entity type
    switch (notification.entity_type as EntityType) {
      case 'post':
        openContent('post', notification.entity_id, commentId);
        break;
      case 'recommendation':
        openContent('recommendation', notification.entity_id, commentId);
        break;
      case 'profile':
        // For profiles, navigate directly to the profile page
        navigate(`/profile/${notification.entity_id}`);
        break;
      default:
        // For other types or if action_url is available, use that
        if (notification.action_url) {
          navigate(notification.action_url);
        } else {
          toast({
            description: "This notification doesn't have any associated content"
          });
        }
    }
  }, [navigate, openContent, toast]);

  return (
    <DropdownMenu open={open} onOpenChange={handleDropdownChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-80 max-h-[480px] overflow-y-auto backdrop-blur-lg bg-background/95 border border-border/50 shadow-lg animate-in fade-in-0 zoom-in-95"
      >
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-lg border-b border-border/50">
          <div className="flex items-center justify-between p-4">
            <h4 className="text-sm font-semibold">Notifications</h4>
            {notifications.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-xs"
                onClick={() => {
                  const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
                  if (unreadIds.length > 0) markAsRead(unreadIds);
                }}
              >
                Mark all as read
              </Button>
            )}
          </div>
        </div>
        
        <div className="px-2 py-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            notifications.map((n) => (
              <button
                onClick={(e) => handleNotificationClick(n, e)}
                key={n.id}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200",
                  "hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  !n.is_read && "bg-primary/5"
                )}
              >
                <div className="flex items-start gap-3">
                  {n.image_url ? (
                    <img 
                      src={n.image_url} 
                      className="w-9 h-9 rounded-full object-cover border"
                      alt=""
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-muted/50 flex items-center justify-center">
                      <Bell className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm leading-5 text-foreground",
                      !n.is_read && "font-medium"
                    )}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 break-words">
                      {n.message}
                    </p>
                    <p className="text-[11px] text-muted-foreground/75 mt-1">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  {n.is_read && (
                    <Check className="w-4 h-4 text-primary/50 mt-1 shrink-0" />
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationBell;
