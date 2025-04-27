
import React, { useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Check, Loader2 } from 'lucide-react';
import { useContentViewer } from '@/contexts/ContentViewerContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { EntityType, Notification } from '@/services/notificationService';
import { NotificationList } from './NotificationList';

interface NotificationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationDrawer({ open, onOpenChange }: NotificationDrawerProps) {
  const { notifications, unreadNotifications, markAsRead, loading, markingAsRead } = useNotifications();
  const { openContent } = useContentViewer();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("all");

  const handleNotificationClick = React.useCallback(async (notification: Notification, event: React.MouseEvent) => {
    event.preventDefault();
    
    if (!notification.is_read) {
      await markAsRead([notification.id]);
    }
    
    onOpenChange(false);
    
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
  }, [navigate, openContent, toast, onOpenChange, markAsRead]);

  const handleMarkAllAsRead = () => {
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length > 0) {
      markAsRead(unreadIds);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[400px] p-0">
        <div className="flex h-full flex-col">
          <SheetHeader className="sticky top-0 z-20 bg-background/95 backdrop-blur-lg border-b border-border/50 p-4">
            <SheetTitle className="text-sm font-semibold">Notifications</SheetTitle>
            <SheetDescription className="sr-only">View and manage your notifications</SheetDescription>
            {notifications.length > 0 && unreadNotifications.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-xs absolute top-4 right-8"
                onClick={handleMarkAllAsRead}
                disabled={markingAsRead}
              >
                {markingAsRead ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : null}
                Mark all as read
              </Button>
            )}
          </SheetHeader>

          <div className="px-4 pb-2">
            <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab} className="w-full">
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
