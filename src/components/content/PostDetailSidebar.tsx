import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ProfileAvatar } from '@/components/common/ProfileAvatar';
import UsernameLink from '@/components/common/UsernameLink';
import { useProfile } from '@/hooks/use-profile-cache';
import { useNavigate } from 'react-router-dom';
import { getEntityUrl } from '@/utils/entityUrlUtils';
import { getEntityStats } from '@/services/entityService';
import { fetchFollowerCount } from '@/services/profileService';
import { useAuth } from '@/contexts/AuthContext';
import { useFollow } from '@/hooks/use-follow';
import FollowButton from '@/components/profile/actions/FollowButton';
import { useQuery } from '@tanstack/react-query';
import { Star, MapPin, MessageSquare, ThumbsUp, Users, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface TaggedEntity {
  id: string;
  name: string;
  type: string;
  slug?: string;
  description?: string;
  image_url?: string;
  category_id?: string;
  venue?: string;
}

interface PostDetailSidebarProps {
  authorId: string | null;
  taggedEntities: TaggedEntity[];
  loading?: boolean;
}

const EntityCard: React.FC<{ entity: TaggedEntity }> = ({ entity }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const entityUrl = getEntityUrl(entity as any);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['entity-stats', entity.id],
    queryFn: () => getEntityStats(entity.id, user?.id || null),
    staleTime: 1000 * 60 * 10,
  });

  const entityTypeLabel = entity.type
    ? entity.type.charAt(0).toUpperCase() + entity.type.slice(1).replace(/_/g, ' ')
    : '';

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      {/* Hero image */}
      {entity.image_url && (
        <button
          onClick={() => navigate(entityUrl)}
          className="w-full block"
        >
          <div className="w-full h-32 overflow-hidden">
            <img
              src={entity.image_url}
              alt={entity.name}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
            />
          </div>
        </button>
      )}

      <CardContent className="p-4">
        {/* Entity name + type badge */}
        <div className="flex items-start justify-between gap-2">
          <button
            onClick={() => navigate(entityUrl)}
            className="font-semibold text-sm hover:underline text-left leading-tight"
          >
            {entity.name}
          </button>
          {entityTypeLabel && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent text-accent-foreground whitespace-nowrap flex-shrink-0">
              {entityTypeLabel}
            </span>
          )}
        </div>

        {/* Venue / location */}
        {entity.venue && (
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{entity.venue}</span>
          </div>
        )}

        {/* Description */}
        {entity.description && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-3 leading-relaxed">
            {entity.description}
          </p>
        )}

        {/* Stats row */}
        {statsLoading ? (
          <div className="flex gap-4 mt-3 pt-3 border-t">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-12" />
          </div>
        ) : stats ? (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t text-xs text-muted-foreground">
            {stats.averageRating !== null && (
              <div className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                <span className="font-medium text-foreground">{stats.averageRating.toFixed(1)}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <ThumbsUp className="h-3 w-3" />
              <span>{stats.recommendationCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              <span>{stats.reviewCount}</span>
            </div>
          </div>
        ) : null}

        {/* Circle signal */}
        {stats && stats.circleRecommendationCount > 0 && (
          <div className="mt-2 text-xs text-primary font-medium flex items-center gap-1.5">
            <Users className="h-3 w-3" />
            <span>
              {stats.circleRecommendationCount} from your circle recommend{stats.circleRecommendationCount === 1 ? 's' : ''} this
            </span>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full mt-3 text-xs"
          onClick={() => navigate(entityUrl)}
        >
          View all experiences
        </Button>
      </CardContent>
    </Card>
  );
};

const AuthorCard: React.FC<{ userId: string }> = ({ userId }) => {
  const { data: profile, isLoading } = useProfile(userId);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isFollowing, followLoading, handleFollowToggle } = useFollow(userId);

  const { data: followerCount } = useQuery({
    queryKey: ['followerCount', userId],
    queryFn: () => fetchFollowerCount(userId),
    staleTime: 1000 * 60 * 5,
  });

  const { data: postCount } = useQuery({
    queryKey: ['user-post-count', userId],
    queryFn: async () => {
      const { count } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_deleted', false);
      return count || 0;
    },
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (!profile) return null;

  const profileUrl = profile.username ? `/u/${profile.username}` : `/profile/${userId}`;
  const isOwnProfile = user?.id === userId;
  const memberSince = profile.created_at
    ? format(new Date(profile.created_at), 'MMM yyyy')
    : null;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <ProfileAvatar userId={userId} size="md" />
          <div className="min-w-0 flex-1">
            <UsernameLink
              userId={userId}
              username={profile.username}
              displayName={profile.displayName}
              showHandle={true}
            />
          </div>
        </div>

        {profile.bio && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
            {profile.bio}
          </p>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t text-xs text-muted-foreground">
          {followerCount !== undefined && (
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span className="font-medium text-foreground">{followerCount}</span>
              <span>followers</span>
            </div>
          )}
          {postCount !== undefined && (
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              <span className="font-medium text-foreground">{postCount}</span>
              <span>posts</span>
            </div>
          )}
        </div>

        {/* Member since */}
        {memberSince && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>Joined {memberSince}</span>
          </div>
        )}

        {/* Follow button or View Profile */}
        {!isOwnProfile && user ? (
          <div className="mt-3">
            <FollowButton
              isFollowing={isFollowing}
              isLoading={followLoading}
              onFollowToggle={handleFollowToggle}
            />
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3 text-xs"
            onClick={() => navigate(profileUrl)}
          >
            View Profile
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

const PostDetailSidebar: React.FC<PostDetailSidebarProps> = ({
  authorId,
  taggedEntities,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="space-y-4 sticky top-20">
        <Card>
          <CardContent className="p-0">
            <Skeleton className="h-32 w-full rounded-t-lg" />
            <div className="p-4 space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <div className="flex gap-4 pt-3 border-t">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-8 w-full" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="flex gap-4 pt-3 border-t">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 sticky top-20">
      {/* Entity Card(s) — first */}
      {taggedEntities.length > 0 && (
        <EntityCard entity={taggedEntities[0]} />
      )}

      {/* Author Card */}
      {authorId && <AuthorCard userId={authorId} />}
    </div>
  );
};

export default PostDetailSidebar;
