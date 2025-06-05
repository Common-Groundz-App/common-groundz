import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, User, Settings } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useProfile, useProfileCacheActions } from "@/hooks/use-profile-cache";
import { useToast } from "@/hooks/use-toast";
import { ProfileAvatar } from "@/components/common/ProfileAvatar";

export function UserMenu() {
  const { user, session, signOut } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const { data: profile } = useProfile(user?.id);
  const { invalidateProfile } = useProfileCacheActions();
  const { toast } = useToast();

  // Listen for profile update events
  React.useEffect(() => {
    const handleProfileUpdate = () => {
      if (user?.id) {
        invalidateProfile(user.id);
      }
    };

    window.addEventListener('profile-updated', handleProfileUpdate);
    
    return () => {
      window.removeEventListener('profile-updated', handleProfileUpdate);
    };
  }, [user?.id, invalidateProfile]);

  const handleSignOut = React.useCallback(async () => {
    try {
      setIsSigningOut(true);
      setIsOpen(false);
      
      console.log('UserMenu: Starting sign out process');
      
      const { error } = await signOut();
      
      if (error) {
        console.error('UserMenu: Sign out failed:', error);
        
        // Check if it's a session-related error that we can ignore
        if (error.message?.includes('session') || error.message?.includes('missing')) {
          console.log('UserMenu: Session error ignored, user likely already signed out');
          toast({
            title: "Signed out successfully",
            description: "You have been logged out of your account.",
          });
          // Force navigation to home page
          navigate('/', { replace: true });
          return;
        }
        
        toast({
          title: "Sign out failed",
          description: error.message,
          variant: "destructive",
        });
        setIsSigningOut(false);
        return;
      }
      
      console.log('UserMenu: Sign out successful');
      toast({
        title: "Signed out successfully",
        description: "You have been logged out of your account.",
      });
      
      // Force navigation to home page after successful logout
      navigate('/', { replace: true });
    } catch (error) {
      console.error('UserMenu: Error during sign out:', error);
      toast({
        title: "Sign out failed",
        description: "An unexpected error occurred while signing out.",
        variant: "destructive",
      });
      setIsSigningOut(false);
    }
  }, [signOut, toast, navigate]);

  // Memoize the computed values to prevent unnecessary re-renders
  const { displayName } = React.useMemo(() => {
    const name = profile?.displayName || user?.email?.split('@')[0] || 'User';
    return { displayName: name };
  }, [profile?.displayName, user?.email]);

  // Don't render if no user or session
  if (!user || !session) {
    return (
      <Button asChild size="sm" className="bg-brand-orange hover:bg-brand-orange/90 text-white">
        <Link to="/auth">Sign In</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full" disabled={isSigningOut}>
          <ProfileAvatar userId={user?.id} size="sm" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile" className="flex items-center cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings" className="flex items-center cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={handleSignOut}
          disabled={isSigningOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>{isSigningOut ? 'Signing out...' : 'Log out'}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
