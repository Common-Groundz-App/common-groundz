
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  User, 
  Settings, 
  LogOut, 
  Shield,
  ChevronDown 
} from 'lucide-react';
import { checkAdminAccess } from '@/services/adminService';

const UserMenu = () => {
  const { user, signOut, profile } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const verifyAdminAccess = async () => {
      if (user) {
        const hasAccess = await checkAdminAccess();
        setIsAdmin(hasAccess);
      }
    };

    verifyAdminAccess();
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.charAt(0).toUpperCase();
  };

  const getDisplayName = () => {
    if (profile?.username) return profile.username;
    if (profile?.first_name) return profile.first_name;
    return user?.email?.split('@')[0] || 'User';
  };

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 px-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback>
              {getInitials(getDisplayName())}
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:flex items-center gap-1">
            <span className="text-sm font-medium">{getDisplayName()}</span>
            {isAdmin && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                Admin
              </Badge>
            )}
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span>{getDisplayName()}</span>
            <span className="text-xs text-muted-foreground font-normal">
              {user.email}
            </span>
            {isAdmin && (
              <Badge variant="secondary" className="text-xs mt-1 w-fit">
                Administrator
              </Badge>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onClick={() => navigate(`/profile/${profile?.username || user.id}`)}
          className="cursor-pointer"
        >
          <User className="mr-2 h-4 w-4" />
          Profile
        </DropdownMenuItem>
        
        <DropdownMenuItem
          onClick={() => navigate('/settings')}
          className="cursor-pointer"
        >
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>

        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => navigate('/admin')}
              className="cursor-pointer"
            >
              <Shield className="mr-2 h-4 w-4" />
              Admin Portal
            </DropdownMenuItem>
          </>
        )}
        
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer text-red-600"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;
