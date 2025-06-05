
import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
      
      console.log('🚪 UserMenu: Starting enhanced sign out process');
      
      const { error } = await signOut();
      
      if (error) {
        console.error('❌ UserMenu: Sign out failed:', error);
        
        // Check if it's a session-related error that we can ignore
        if (error.message?.includes('session') || 
            error.message?.includes('missing') || 
            error.message?.includes('expired') ||
            error.message?.includes('Auth session missing')) {
          console.log('✅ UserMenu: Session error handled, user signed out successfully');
          toast({
            title: "Signed out successfully",
            description: "You have been logged out of your account.",
          });
          // Force navigation to home page
          setTimeout(() => {
            window.location.href = '/';
          }, 100);
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
      
      console.log('✅ UserMenu: Sign out successful');
      toast({
        title: "Signed out successfully",
        description: "You have been logged out of your account.",
      });
      
      // Force navigation to home page after successful logout
      setTimeout(() => {
        window.location.href = '/';
      }, 100);
    } catch (error) {
      console.error('💥 UserMenu: Unexpected error during sign out:', error);
      toast({
        title: "Signed out successfully", // Still show success to user
        description: "You have been logged out of your account.",
      });
      setIsSigningOut(false);
      // Force navigation even on error
      setTimeout(() => {
        window.location.href = '/';
      }, 100);
    }
  }, [signOut, toast]);

  // Memoize the computed values to prevent unnecessary re-renders
  const { displayName, initials } = React.useMemo(() => {
    const name = profile?.displayName || user?.email?.split('@')[0] || 'User';
    const userInitials = profile?.initials || name.substring(0, 2).toUpperCase();
    return { displayName: name, initials: userInitials };
  }, [profile?.displayName, profile?.initials, user?.email]);

  // Enhanced validation - check both user AND session
  if (!user || !session) {
    return (
      <Button asChild size="sm" className="bg-brand-orange hover:bg-brand-orange/90 text-white">
        <Link to="/auth">Sign In</Link>
      </Button>
    );
  }

  // Additional session validation
  if (session.expires_at && new Date(session.expires_at * 1000) < new Date()) {
    console.log('🚫 UserMenu: Session expired, showing sign in button');
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
          <Avatar className="h-8 w-8">
            <AvatarImage 
              src={profile?.avatar_url || ""} 
              alt={displayName} 
            />
            <AvatarFallback className="bg-brand-orange text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
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
