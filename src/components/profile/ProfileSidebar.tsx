
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar, Globe, Twitter, Instagram } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

interface ProfileSidebarProps {
  name: string;
  title?: string;
  bio?: string;
  location?: string;
  memberSince?: string;
  followers?: number;
  stats: {
    groundzScore: number;
    circleCertified: number;
    totalRecommendations: number;
    inCircles: number;
  };
}

const ProfileSidebar = ({
  name,
  title,
  bio,
  location,
  memberSince,
  followers,
  stats
}: ProfileSidebarProps) => {
  return (
    <div className="bg-card shadow-md rounded-xl overflow-hidden">
      {/* Profile card */}
      <div className="flex flex-col items-center p-6 pt-12">
        <Avatar className="h-32 w-32 border-4 border-white shadow-lg mb-4">
          <AvatarImage src="/lovable-uploads/a9d5589a-01ed-4fc1-84ba-67233d6d9412.png" alt={name} />
          <AvatarFallback>{name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
        </Avatar>
        
        <h1 className="text-2xl font-bold text-center">{name}</h1>
        {title && <p className="text-muted-foreground text-sm mt-1">{title}</p>}
        
        <div className="flex items-center mt-2">
          <span className="text-amber-500 flex items-center">★</span>
          <span className="font-bold ml-1">{stats.groundzScore}</span>
          <span className="text-muted-foreground text-xs ml-1">({stats.totalRecommendations})</span>
        </div>
        
        {bio && <p className="text-sm text-center mt-4">{bio}</p>}
        
        <div className="mt-6 w-full">
          <Button variant="default" className="w-full">
            Contact
          </Button>
        </div>
      </div>
      
      {/* Stats section */}
      <div className="grid grid-cols-2 gap-4 p-6 border-t border-border">
        <div className="flex flex-col items-center">
          <div className="text-2xl font-bold text-primary">{stats.groundzScore}</div>
          <div className="text-xs text-muted-foreground">Groundz Score Avg</div>
        </div>
        <div className="flex flex-col items-center">
          <div className="text-2xl font-bold text-primary">{stats.circleCertified}</div>
          <div className="text-xs text-muted-foreground">Circle Certified</div>
        </div>
        <div className="flex flex-col items-center">
          <div className="text-2xl font-bold text-primary">{stats.totalRecommendations}</div>
          <div className="text-xs text-muted-foreground">Total Recommendations</div>
        </div>
        <div className="flex flex-col items-center">
          <div className="text-2xl font-bold text-primary">{stats.inCircles}</div>
          <div className="text-xs text-muted-foreground">In X Circles</div>
        </div>
      </div>
      
      {/* Info section */}
      <div className="p-6 border-t border-border">
        {location && (
          <div className="flex items-center text-sm mb-3">
            <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
            <span>{location}</span>
          </div>
        )}
        
        {memberSince && (
          <div className="flex items-center text-sm mb-3">
            <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
            <span>Member since {memberSince}</span>
          </div>
        )}
        
        {followers && (
          <div className="flex items-center text-sm mb-3">
            <span className="text-muted-foreground">Followed by {followers} people</span>
          </div>
        )}
      </div>
      
      {/* Social links */}
      <div className="flex justify-center p-4 border-t border-border gap-4">
        <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
          <Globe className="h-5 w-5" />
        </a>
        <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
          <Twitter className="h-5 w-5" />
        </a>
        <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
          <Instagram className="h-5 w-5" />
        </a>
      </div>
    </div>
  );
};

export default ProfileSidebar;
