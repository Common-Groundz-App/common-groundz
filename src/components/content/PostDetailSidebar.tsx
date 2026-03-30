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
import { MapPin, MessageSquare, ThumbsUp, Users, Calendar } from 'lucide-react';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { EntityFollowButton } from '@/components/entity/EntityFollowButton';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { getSentimentColor, getSentimentLabel } from '@/utils/ratingColorUtils';
import { useCircleRating } from '@/hooks/use-circle-rating';
import { CircleContributorsPreview } from '@/components/recommendations/CircleContributorsPreview';

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

  const { circleRating, circleRatingCount, circleContributors, isLoading: circleLoading } = useCircleRating(entity.id);

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

      <CardContent className="p-5">
        {/* Entity name + follow button */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => navigate(entityUrl)}
            className="font-semibold text-sm hover:underline text-left leading-tight min-w-0 flex-1"
          >
            {entity.name}
          </button>
          <div className="flex-shrink-0">
            <EntityFollowButton
              entityId={entity.id}
              entityName={entity.name}
              size="sm"
            />
          </div>
        </div>

        {/* Venue / location */}
        {entity.venue && (
          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
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

        {/* === PRIMARY: Overall Rating === */}
        {statsLoading ? (
          <div className="mt-3 pt-3 border-t space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        ) : stats && stats.averageRating !== null ? (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center justify-between">
              <ConnectedRingsRating
                value={stats.averageRating}
                variant="badge"
                showValue={false}
                size="sm"
                minimal={true}
              />
              <span
                className="text-lg font-bold"
                style={{ color: getSentimentColor(stats.averageRating, stats.reviewCount > 0) }}
              >
                {stats.reviewCount > 0 ? stats.averageRating.toFixed(1) : "0"}
              </span>
            </div>
            <div className="mt-1 leading-tight">
              <div className="flex items-center gap-1 font-semibold text-xs text-foreground">
                Overall Rating
                <InfoTooltip content="Overall Rating is the average review rating from all users who reviewed this item on Common Groundz." />
              </div>
              <div
                className="text-xs font-bold"
                style={{ color: getSentimentColor(stats.averageRating, stats.reviewCount > 0) }}
              >
                {getSentimentLabel(stats.averageRating, stats.reviewCount > 0)}
              </div>
              <div className="text-xs text-muted-foreground">
                ({stats.reviewCount.toLocaleString()} {stats.reviewCount === 1 ? 'review' : 'reviews'})
              </div>
            </div>
          </div>
        ) : null}

        {/* === SECONDARY: Circle Rating === */}
        {user && !circleLoading && circleRating !== null && circleRatingCount > 0 ? (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center justify-between">
              <div className="w-fit">
                <ConnectedRingsRating
                  value={circleRating}
                  variant="badge"
                  showValue={false}
                  size="sm"
                  minimal={true}
                />
              </div>
              <span
                className="text-lg font-bold"
                style={{ color: getSentimentColor(circleRating, circleRatingCount > 0) }}
              >
                {circleRating.toFixed(1)}
              </span>
            </div>
            <div className="mt-1 leading-tight">
              <div className="flex items-center gap-1 font-semibold text-xs text-brand-orange">
                Circle Rating
                <InfoTooltip content="Circle Rating is the average review rating from people in your Circle (friends or trusted users you follow)." />
              </div>
              <div
                className="text-xs font-bold"
                style={{ color: getSentimentColor(circleRating, circleRatingCount > 0) }}
              >
                {getSentimentLabel(circleRating, circleRatingCount > 0)}
              </div>
              <div className="text-xs text-muted-foreground">
                Based on {circleRatingCount} rating{circleRatingCount !== 1 ? 's' : ''} from your circle
              </div>
              <CircleContributorsPreview
                contributors={circleContributors}
                totalCount={circleRatingCount}
                maxDisplay={4}
                entityName={entity.name}
                stats={stats}
              />
            </div>
          </div>
        ) : user && !circleLoading && (circleRating === null || circleRatingCount === 0) ? (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center justify-between">
              <div className="w-fit">
                <ConnectedRingsRating
                  value={0}
                  variant="badge"
                  showValue={false}
                  size="sm"
                  minimal={true}
                />
              </div>
              <span className="text-lg font-bold text-muted-foreground">
                0
              </span>
            </div>
            <div className="mt-1 leading-tight">
              <div className="flex items-center gap-1 font-semibold text-xs text-brand-orange">
                Circle Rating
                <InfoTooltip content="Circle Rating is the average review rating from people in your Circle (friends or trusted users you follow)." />
              </div>
              <div className="text-xs text-muted-foreground">
                No ratings from your circle yet
              </div>
            </div>
          </div>
        ) : null}

        {/* === TERTIARY: Recommendations === */}
        {stats && (stats.recommendationCount > 0 || (user && stats.circleRecommendationCount > 0)) && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <ThumbsUp className="h-3.5 w-3.5 text-brand-orange" />
              <span className="text-foreground font-medium">
                {stats.recommendationCount > 0 && (
                  <>
                    <span className="text-brand-orange">{stats.recommendationCount.toLocaleString()}</span> Recommending
                    {user && stats.circleRecommendationCount > 0 && (
                      <>
                        {' '}<span className="text-muted-foreground">(</span><span className="text-brand-orange font-medium">{stats.circleRecommendationCount} from circle</span><span className="text-muted-foreground">)</span>
                      </>
                    )}
                  </>
                )}
                {stats.recommendationCount === 0 && user && stats.circleRecommendationCount > 0 && (
                  <span className="text-brand-orange font-medium">{stats.circleRecommendationCount} from your circle</span>
                )}
              </span>
              <InfoTooltip 
                content={`Reviews with 4 or more circles are considered recommendations.\n"From circle" shows how many people you follow have recommended this recently.\nOnly recent ratings are counted to keep things current and relevant.`}
                side="top"
              />
            </div>
          </div>
        )}

        <Button
          size="sm"
          className="w-full mt-4 text-xs bg-brand-orange hover:bg-brand-orange/90 text-white"
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
        <CardContent className="p-5 space-y-3">
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
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <ProfileAvatar userId={userId} size="md" className="ring-2 ring-background shadow-sm" />
          <div className="min-w-0 flex-1">
            <UsernameLink
              userId={userId}
              username={profile.username}
              displayName={profile.displayName}
              showHandle={true}
              className="[&>a:first-child]:text-lg [&>a:first-child]:font-bold"
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
          <div className="mt-4 [&>button]:w-full">
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
            className="w-full mt-4 text-xs"
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
            <div className="p-5 space-y-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-full" />
              {/* Rating block skeleton */}
              <div className="pt-3 border-t space-y-2">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-8" />
                </div>
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              {/* Circle block skeleton */}
              <div className="pt-3 border-t space-y-2">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-8" />
                </div>
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-8 w-full" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 space-y-3">
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
