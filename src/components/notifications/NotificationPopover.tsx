import React, { useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Bell, Check, Loader2 } from 'lucide-react';
import { useContentViewer } from '@/contexts/ContentViewerContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { EntityType, Notification } from '@/services/notificationService';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/user-avatar';

interface NotificationPopoverProps {
  trigger: React.ReactNode;
  align?: "start" | "center" | "end";
}

export function NotificationPopover({ trigger, align = "end" }: NotificationPopoverProps) {
  const { notifications, unreadNotifications, markAsRead, loading, markingAsRead } = useNotifications();
  const { openContent } = useContentViewer();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  const handleNotificationClick = React.useCallback(async (notification: Notification, event: React.MouseEvent) => {
    event.preventDefault();
    
    if (!notification.is_read) {
      await markAsRead([notification.id]);
    }
    
    setOpen(false);
    
    if (!notification.entity_type || !notification.entity_id) {
      if (notification.action_url) {
        navigate(notification.action_url);
      } else {
        toast({
          description: "This notification doesn't have any associated content"
        });
      }
      return;
    }
    
    const commentId = notification.metadata?.comment_id || null;
    
    switch (notification.entity_type as EntityType) {
      case 'post':
        openContent('post', notification.entity_id, commentId);
        break;
      case 'recommendation':
        openContent('recommendation', notification.entity_id, commentId);
        break;
      case 'profile':
        navigate(`/profile/${notification.entity_id}`);
        break;
      default:
        if (notification.action_url) {
          navigate(notification.action_url);
        } else {
          toast({
            description: "This notification doesn't have any associated content"
          });
        }
    }
  }, [navigate, openContent, toast, markAsRead]);

  const handleMarkAllAsRead = () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length > 0) {
      markAsRead(unreadIds);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 max-h-[480px] overflow-y-auto p-0 backdrop-blur-lg bg-background/95 border border-border/50 shadow-lg"
        align={align}
      >
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-lg border-b border-border/50">
          <div className="flex items-center justify-between p-4">
            <h4 className="text-sm font-semibold">Notifications</h4>
            {notifications.length > 0 && unreadNotifications.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-xs"
                onClick={handleMarkAllAsRead}
                disabled={markingAsRead}
              >
                {markingAsRead ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : null}
                Mark all as read
              </Button>
            )}
          </div>
          
          <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab} className="w-full px-4 pb-2">
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
              <TabsTrigger value="unread" className="flex-1">
                Unread {unreadNotifications.length > 0 && `(${unreadNotifications.length})`}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="mt-2">
              <NotificationList 
                notifications={notifications}
                loading={loading}
                onNotificationClick={handleNotificationClick}
              />
            </TabsContent>

            <TabsContent value="unread" className="mt-2">
              <NotificationList 
                notifications={unreadNotifications}
                loading={loading}
                onNotificationClick={handleNotificationClick}
                emptyMessage="No unread notifications"
                emptyIcon={Check}
              />
            </TabsContent>
          </Tabs>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface NotificationListProps {
  notifications: Notification[];
  loading: boolean;
  onNotificationClick: (notification: Notification, event: React.MouseEvent) => void;
  emptyMessage?: string;
  emptyIcon?: React.ElementType;
}

function NotificationList({ 
  notifications, 
  loading, 
  onNotificationClick,
  emptyMessage = "No notifications yet",
  emptyIcon: EmptyIcon = Bell 
}: NotificationListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <EmptyIcon className="h-8 w-8 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="px-2 py-1">
      {notifications.map((notification) => (
        <button
          key={notification.id}
          onClick={(e) => onNotificationClick(notification, e)}
          className={cn(
            "w-full text-left px-3 py-2.5 rounded-lg transition-all duration-200",
            "hover:bg-accent/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            !notification.is_read && "bg-primary/5"
          )}
        >
          <div className="flex items-start gap-3">
            <UserAvatar
              imageUrl={notification.image_url}
              username={notification.title}
              className="w-9 h-9"
            />
            <div className="flex-1 min-w-0">
              <p className={cn(
                "text-sm leading-5 text-foreground",
                !notification.is_read && "font-medium"
              )}>
                {notification.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 break-words">
                {notification.message}
              </p>
              <p className="text-[11px] text-muted-foreground/75 mt-1">
                {new Date(notification.created_at).toLocaleString()}
              </p>
            </div>
            {notification.is_read && (
              <Check className="w-4 h-4 text-primary/50 mt-1 shrink-0" />
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
