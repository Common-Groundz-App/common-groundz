
import React, { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useNotifications } from '@/hooks/useNotifications';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function NotificationsDrawer() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, loading } = useNotifications();

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener('open-notifications-drawer', handleOpen);
    return () => window.removeEventListener('open-notifications-drawer', handleOpen);
  }, []);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && unreadCount > 0) {
      const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
      if (unreadIds.length > 0) markAsRead(unreadIds);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange} >
      <SheetContent side="right" className="w-full sm:w-[400px] p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center justify-between">
            <span>Notifications</span>
            {notifications.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-xs"
                onClick={() => {
                  const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
                  if (unreadIds.length > 0) markAsRead(unreadIds);
                }}
              >
                Mark all as read
              </Button>
            )}
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="all" className="w-full">
          <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-lg border-b">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
              <TabsTrigger 
                value="all" 
                className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary"
              >
                All
              </TabsTrigger>
              <TabsTrigger 
                value="unread"
                className="rounded-none border-b-2 border-transparent px-4 py-2 data-[state=active]:border-primary"
              >
                Unread
              </TabsTrigger>
            </TabsList>
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
              <TabsContent value="all" className="mt-0">
                {notifications.map((n) => (
                  <button
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
                ))}
              </TabsContent>
            )}
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
