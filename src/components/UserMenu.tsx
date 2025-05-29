
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
import { Link } from "react-router-dom";
import { useProfile, useProfileCacheActions } from "@/hooks/use-profile-cache";

export function UserMenu() {
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);
  const { data: profile, isLoading } = useProfile(user?.id);
  const { invalidateProfile } = useProfileCacheActions();

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

  if (!user) {
    return (
      <Button asChild size="sm" className="bg-brand-orange hover:bg-brand-orange/90 text-white">
        <Link to="/auth">Sign In</Link>
      </Button>
    );
  }

  // Generate display name with fallbacks
  const getDisplayName = (): string => {
    if (profile?.displayName) return profile.displayName;
    
    const userMetadata = user.user_metadata;
    const firstName = userMetadata?.first_name || '';
    const lastName = userMetadata?.last_name || '';
    
    if (firstName || lastName) {
      return `${firstName} ${lastName}`.trim();
    }
    
    return user.email?.split('@')[0] || 'User';
  };

  const displayName = getDisplayName();

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage 
              src={profile?.avatar_url || ""} 
              alt={displayName} 
            />
            <AvatarFallback className="bg-brand-orange text-white">
              {profile?.initials || displayName.substring(0, 2).toUpperCase()}
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
          onClick={async () => {
            setIsOpen(false);
            await signOut();
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
