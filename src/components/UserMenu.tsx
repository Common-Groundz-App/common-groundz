
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
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const { data: profile, isLoading } = useProfile(user?.id);
  const { invalidateProfile } = useProfileCacheActions();
  const navigate = useNavigate();
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

  // Listen for auth state changes to handle navigation
  React.useEffect(() => {
    if (!user && !isSigningOut) {
      // User has been signed out, navigate to landing page
      console.log('User signed out, navigating to landing page');
      navigate('/', { replace: true });
    }
  }, [user, navigate, isSigningOut]);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      setIsOpen(false); // Close dropdown immediately
      
      console.log('Starting sign out process...');
      const { error } = await signOut();
      
      if (error) {
        console.error('Sign out failed:', error);
        toast({
          title: "Sign out failed",
          description: error.message,
          variant: "destructive",
        });
        setIsSigningOut(false);
        return;
      }
      
      // Show success message
      toast({
        title: "Signed out successfully",
        description: "You have been logged out of your account.",
      });
      
      // Note: Navigation will happen automatically when user becomes null
      // due to the useEffect above that listens to auth state changes
    } catch (error) {
      console.error('Error during sign out:', error);
      toast({
        title: "Sign out failed",
        description: "An unexpected error occurred while signing out.",
        variant: "destructive",
      });
      setIsSigningOut(false);
    }
  };

  if (!user) {
    return (
      <Button asChild size="sm" className="bg-brand-orange hover:bg-brand-orange/90 text-white">
        <Link to="/auth">Sign In</Link>
      </Button>
    );
  }

  // Use enhanced profile data with fallbacks
  const displayName = profile?.displayName || user.email?.split('@')[0] || 'User';
  const initials = profile?.initials || displayName.substring(0, 2).toUpperCase();

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
