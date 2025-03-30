
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit, Heart, Award, Target, Users, MapPin, Calendar, Twitter, Instagram, Linkedin } from 'lucide-react';

interface ProfileStats {
  groundzScoreAvg: number;
  circleCertifiedRecs: number;
  totalRecommendations: number;
  inCircles: number;
}

interface ProfileSocial {
  twitter?: string;
  instagram?: string;
  linkedin?: string;
}

interface ProfileCardProps {
  profile: {
    name: string;
    bio?: string;
    avatar?: string;
    location?: string;
    memberSince: string;
    stats: ProfileStats;
    social?: ProfileSocial;
  };
  isOwnProfile: boolean;
}

const ProfileCard = ({ profile, isOwnProfile }: ProfileCardProps) => {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase();
  };

  return (
    <Card className="p-6 h-full shadow-md">
      <div className="flex flex-col items-center text-center">
        <Avatar className="h-32 w-32 mb-4">
          <AvatarImage src={profile.avatar} alt={profile.name} />
          <AvatarFallback className="text-2xl bg-brand-orange/20 text-brand-orange">
            {getInitials(profile.name)}
          </AvatarFallback>
        </Avatar>
        
        <h1 className="text-2xl font-bold mb-2">{profile.name}</h1>
        
        {profile.bio && (
          <p className="text-muted-foreground mb-6 max-w-xs">{profile.bio}</p>
        )}
        
        {/* Stats section */}
        <div className="w-full grid grid-cols-2 gap-4 my-6">
          <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
            <div className="flex items-center mb-1 text-brand-orange">
              <Heart className="w-4 h-4 mr-1" />
              <span className="font-semibold">{profile.stats.groundzScoreAvg}</span>
            </div>
            <p className="text-xs text-muted-foreground">Groundz Score Avg</p>
          </div>
          
          <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
            <div className="flex items-center mb-1 text-brand-orange">
              <Award className="w-4 h-4 mr-1" />
              <span className="font-semibold">{profile.stats.circleCertifiedRecs}</span>
            </div>
            <p className="text-xs text-muted-foreground">Circle Certified</p>
          </div>
          
          <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
            <div className="flex items-center mb-1 text-brand-orange">
              <Target className="w-4 h-4 mr-1" />
              <span className="font-semibold">{profile.stats.totalRecommendations}</span>
            </div>
            <p className="text-xs text-muted-foreground">Total Recommendations</p>
          </div>
          
          <div className="flex flex-col items-center p-3 rounded-lg bg-muted/50">
            <div className="flex items-center mb-1 text-brand-orange">
              <Users className="w-4 h-4 mr-1" />
              <span className="font-semibold">{profile.stats.inCircles}</span>
            </div>
            <p className="text-xs text-muted-foreground">In Circles</p>
          </div>
        </div>
        
        {/* Location & member since */}
        <div className="w-full space-y-3 mb-6">
          {profile.location && (
            <div className="flex items-center text-sm">
              <MapPin className="w-4 h-4 mr-2 text-muted-foreground" />
              <span>{profile.location}</span>
            </div>
          )}
          
          <div className="flex items-center text-sm">
            <Calendar className="w-4 h-4 mr-2 text-muted-foreground" />
            <span>Member since {profile.memberSince}</span>
          </div>
        </div>
        
        {/* Social links */}
        {profile.social && (
          <div className="flex justify-center space-x-4 mb-6">
            {profile.social.twitter && (
              <a href={`https://twitter.com/${profile.social.twitter}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-brand-orange transition-colors">
                <Twitter className="w-5 h-5" />
              </a>
            )}
            
            {profile.social.instagram && (
              <a href={`https://instagram.com/${profile.social.instagram}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-brand-orange transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
            )}
            
            {profile.social.linkedin && (
              <a href={`https://linkedin.com/in/${profile.social.linkedin}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-brand-orange transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
            )}
          </div>
        )}
        
        {/* Edit profile button - only visible to the profile owner */}
        {isOwnProfile && (
          <Button variant="outline" className="w-full mt-2">
            <Edit className="w-4 h-4 mr-2" />
            Edit Profile
          </Button>
        )}
      </div>
    </Card>
  );
};

export default ProfileCard;
