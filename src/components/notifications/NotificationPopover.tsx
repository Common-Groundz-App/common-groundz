import React, { useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Check, Loader2, X } from 'lucide-react';
import { useContentViewer } from '@/contexts/ContentViewerContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { EntityType, Notification } from '@/services/notificationService';
import { NotificationList } from './NotificationList';

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
        aria-label="Notifications popover"
      >
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-lg border-b border-border/50">
          <div className="flex items-center justify-between p-4">
            <h4 className="text-sm font-semibold" id="notifications-title">Notifications</h4>
            <X 
              className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setOpen(false)}
            />
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
