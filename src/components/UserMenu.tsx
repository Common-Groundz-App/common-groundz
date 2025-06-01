
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Settings, LogOut, Home } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function UserMenu() {
  const { user, signOut, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  console.log('👤 [UserMenu] Rendering - isLoading:', isLoading, 'user:', user ? 'authenticated' : 'not authenticated');

  const handleSignOut = async () => {
    try {
      console.log('🚪 [UserMenu] Signing out...');
      const { error } = await signOut();
      
      if (error) {
        console.error('❌ [UserMenu] Sign out error:', error);
        throw error;
      }
      
      console.log('✅ [UserMenu] Sign out successful, navigating to /');
      toast({
        title: 'Signed out',
        description: 'You have been successfully signed out.',
      });
      
      navigate('/', { replace: true });
    } catch (error: any) {
      console.error('❌ [UserMenu] Sign out failed:', error);
      toast({
        title: 'Sign out failed',
        description: error.message || 'Failed to sign out. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Show loading state while auth is initializing
  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Show sign in button if no user
  if (!user) {
    return (
      <Button 
        variant="outline" 
        size="sm"
        onClick={() => navigate('/auth')}
        className="gap-2"
      >
        <User className="w-4 h-4" />
        Sign In
      </Button>
    );
  }

  // Get user initials for avatar fallback
  const getInitials = (email: string) => {
    return email
      .split('@')[0]
      .split('.')
      .map(part => part.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.user_metadata?.avatar_url} alt={user.email || 'User'} />
            <AvatarFallback>
              {getInitials(user.email || 'U')}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <div className="flex items-center justify-start gap-2 p-2">
          <div className="flex flex-col space-y-1 leading-none">
            <p className="font-medium text-sm">
              {user.user_metadata?.full_name || user.email?.split('@')[0]}
            </p>
            <p className="w-[200px] truncate text-xs text-muted-foreground">
              {user.email}
            </p>
          </div>
        </div>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={() => navigate('/home')} className="gap-2">
          <Home className="w-4 h-4" />
          <span>Home</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => navigate('/profile')} className="gap-2">
          <User className="w-4 h-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={() => navigate('/settings')} className="gap-2">
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={handleSignOut} className="gap-2 text-red-600 focus:text-red-600">
          <LogOut className="w-4 h-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
