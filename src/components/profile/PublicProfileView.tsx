import React from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MapPin, CalendarDays, BadgeCheck } from 'lucide-react';
import { format } from 'date-fns';
import { trackGuestEvent } from '@/utils/guestConversionTracker';

interface PublicProfileViewProps {
  profile: {
    id: string;
    username: string | null;
    avatar_url: string | null;
    first_name: string | null;
    last_name: string | null;
    bio: string | null;
    location: string | null;
    cover_url: string | null;
    is_verified: boolean | null;
    created_at: string | null;
  };
  followerCount: number;
  followingCount: number;
}

const PublicProfileView: React.FC<PublicProfileViewProps> = ({ profile, followerCount, followingCount }) => {
  const displayName = profile.first_name && profile.last_name
    ? `${profile.first_name} ${profile.last_name}`
    : profile.first_name || profile.username || 'User';

  const initials = profile.first_name && profile.last_name
    ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
    : profile.username
      ? profile.username.substring(0, 2).toUpperCase()
      : 'U';

  const joinedDate = profile.created_at
    ? format(new Date(profile.created_at), 'MMMM yyyy')
    : null;

  return (
    <div className="pb-16">
      {/* Cover Image */}
      <div className="w-full h-48 sm:h-64 bg-muted overflow-hidden">
        {profile.cover_url ? (
          <img
            src={profile.cover_url}
            alt={`${displayName}'s cover`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5" />
        )}
      </div>

      {/* Profile Info */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="-mt-12 sm:-mt-16 mb-4">
          <Avatar className="h-24 w-24 sm:h-32 sm:w-32 border-4 border-background shadow-lg">
            <AvatarImage src={profile.avatar_url || ''} alt={displayName} />
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>

        <div className="space-y-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-1.5">
              {displayName}
              {profile.is_verified && (
                <BadgeCheck className="h-5 w-5 text-primary" />
              )}
            </h1>
            {profile.username && (
              <p className="text-muted-foreground">@{profile.username}</p>
            )}
          </div>

          {profile.bio && (
            <p className="text-foreground/90 whitespace-pre-wrap">{profile.bio}</p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {profile.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {profile.location}
              </span>
            )}
            {joinedDate && (
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                Joined {joinedDate}
              </span>
            )}
          </div>

          <div className="flex gap-4 text-sm">
            <span>
              <strong className="text-foreground">{followerCount}</strong>{' '}
              <span className="text-muted-foreground">Followers</span>
            </span>
            <span>
              <strong className="text-foreground">{followingCount}</strong>{' '}
              <span className="text-muted-foreground">Following</span>
            </span>
          </div>
        </div>

        {/* CTA Card */}
        <div className="mt-8 rounded-xl border border-border bg-card p-6 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-card-foreground mb-2">
            Join Common Groundz to see {displayName}'s recommendations
          </h2>
          <p className="text-sm text-muted-foreground mb-5">
            Discover trusted reviews, recommendations, and more from people you trust.
          </p>
          <div className="flex justify-center gap-3">
            <Button asChild onClick={() => trackGuestEvent('guest_clicked_signup_cta', { profileId: profile.id })}>
              <Link to="/auth?tab=signup">Sign Up</Link>
            </Button>
            <Button variant="outline" asChild onClick={() => trackGuestEvent('guest_clicked_login_cta', { profileId: profile.id })}>
              <Link to="/auth">Log In</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicProfileView;
