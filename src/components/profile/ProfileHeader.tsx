
import React from 'react';
import { User } from '@supabase/supabase-js';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MapPin, Settings } from 'lucide-react';

interface ProfileHeaderProps {
  user: User | null;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({ user }) => {
  if (!user) return null;

  // Get username from email
  const username = user.email?.split('@')[0] || 'user';
  
  return (
    <div className="relative">
      {/* Cover Image - Beautiful nature scene */}
      <div className="w-full h-[300px] overflow-hidden">
        <img
          src="/lovable-uploads/20bee1a9-6553-4fb5-9c4b-032858171300.png"
          alt="Cover"
          className="w-full h-full object-cover"
        />
      </div>
      
      {/* Profile section with avatar and basic info */}
      <div className="container mx-auto px-4">
        <div className="relative -mt-24 flex flex-col sm:flex-row items-start sm:items-end gap-4">
          {/* Avatar with border */}
          <div className="z-10">
            <Avatar className="h-40 w-40 border-4 border-background rounded-full overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1492633423870-43d1cd2775eb?&w=128&h=128&dpr=2&q=80" 
                alt="Profile" 
                className="h-full w-full object-cover"
              />
            </Avatar>
          </div>
          
          {/* User info */}
          <div className="flex-grow mt-4 sm:mt-0 mb-4 sm:mb-8">
            <h1 className="text-3xl font-bold text-foreground">Morgan Smith</h1>
            <p className="text-muted-foreground">@{username}</p>
            <div className="flex items-center mt-1">
              <MapPin size={16} className="text-muted-foreground" />
              <span className="ml-1 text-muted-foreground">San Francisco, CA</span>
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex gap-2 ml-auto mb-8">
            <Button variant="outline" size="sm" className="gap-1">
              <Settings size={16} />
              Edit Profile
            </Button>
            <Button size="sm">Follow</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;
