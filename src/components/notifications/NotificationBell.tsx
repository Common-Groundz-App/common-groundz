
import React, { useState, useCallback } from 'react';
import { Bell, Check } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useContentViewer } from '@/contexts/ContentViewerContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { EntityType } from '@/services/notificationService';

export const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, markAsRead, loading } = useNotifications();
  const { openContent } = useContentViewer();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const handleDropdownChange = (val: boolean) => {
    setOpen(val);
    if (val) {
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
            <span className="absolute top-0 right-0 inline-block h-4 w-4 rounded-full bg-red-500 text-white text-xs text-center leading-4">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 max-h-[400px] overflow-y-auto">
        <div className="p-2">
          <h4 className="font-bold mb-2">Notifications</h4>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
          ) : (
            notifications.map((n) => (
              <a
                href="#"
                onClick={(e) => handleNotificationClick(n, e)}
                key={n.id}
                className={`flex items-start gap-2 p-2 rounded hover:bg-accent transition relative ${
                  !n.is_read ? 'bg-orange-50' : ''
                }`}
                style={{ textDecoration: 'none' }}
              >
                {n.image_url ? (
                  <img src={n.image_url} className="w-8 h-8 rounded-full object-cover border" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                    <Bell className="w-5 h-5" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{n.title}</div>
                  <div className="text-xs text-muted-foreground break-words">{n.message}</div>
                  <div className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString()}</div>
                </div>
                {n.is_read && <Check className="w-4 h-4 text-green-400 mt-1" />}
              </a>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationBell;
