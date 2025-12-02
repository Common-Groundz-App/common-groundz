import React from 'react';
import { VerticalTubelightNavbar } from '@/components/ui/vertical-tubelight-navbar';
import { BottomNavigation } from '@/components/navigation/BottomNavigation';
import MyStuffContent from '@/components/mystuff/MyStuffContent';
import Logo from '@/components/Logo';
import { Bell, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';

const MyStuffPage = () => {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();

  return (
    <div className="min-h-screen flex flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] xl:pb-0">
      {/* Mobile Header - Only show on mobile/tablet screens */}
      <div className="xl:hidden fixed top-0 left-0 right-0 z-40 bg-background/90 backdrop-blur-sm border-b">
        <div className="container p-3 mx-auto flex justify-between items-center">
          <Logo size="sm" />
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const event = new CustomEvent('open-search-dialog');
                window.dispatchEvent(event);
              }}
              className="p-2 rounded-full hover:bg-accent"
            >
              <Search size={20} />
            </button>
            {user && (
              <button
                onClick={() => {
                  const event = new CustomEvent('open-notifications');
                  window.dispatchEvent(event);
                }}
                className="p-2 rounded-full hover:bg-accent relative"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Side Navigation - Fixed position */}
      <div className="hidden xl:block fixed left-0 top-0 h-screen pt-4 pl-4 z-50">
        <VerticalTubelightNavbar initialActiveTab="My Stuff" />
      </div>

      {/* Main Content Area - with proper spacing */}
      <div className="flex-1 pt-16 xl:pt-0 xl:ml-64">
        <MyStuffContent />
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="xl:hidden">
        <BottomNavigation />
      </div>
    </div>
  );
};

export default MyStuffPage;
