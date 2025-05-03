
import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EnhancedCreatePostForm } from './EnhancedCreatePostForm';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface SmartComposerButtonProps {
  className?: string;
}

export function SmartComposerButton({ className }: SmartComposerButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { user } = useAuth();
  
  const username = user?.user_metadata?.username || user?.email?.split('@')[0] || 'User';
  const avatarUrl = user?.user_metadata?.avatar_url;
  
  return (
    <>
      <div className={cn("flex items-center gap-3 w-full bg-background rounded-xl p-3", className)}>
        <UserAvatar username={username} imageUrl={avatarUrl} className="h-9 w-9" />
        
        <Button 
          variant="outline" 
          className="w-full justify-start font-normal text-muted-foreground h-12 text-left rounded-xl border bg-accent/5 px-4"
          onClick={() => setIsDialogOpen(true)}
        >
          What do you want to share today?
        </Button>
      </div>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <EnhancedCreatePostForm 
            onSuccess={() => {
              setIsDialogOpen(false);
              
              // Dispatch events to refresh both feeds
              window.dispatchEvent(new CustomEvent('refresh-for-you-feed'));
              window.dispatchEvent(new CustomEvent('refresh-following-feed'));
              window.dispatchEvent(new CustomEvent('refresh-profile-posts'));
            }}
            onCancel={() => setIsDialogOpen(false)} 
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
