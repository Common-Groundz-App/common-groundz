import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { RecommendedUser, logUserImpression } from '@/services/userRecommendationService';
import { ProfileAvatar } from '@/components/common/ProfileAvatar';
import UsernameLink from '@/components/common/UsernameLink';
import { useFollow } from '@/hooks/use-follow';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

export type MutualPreview = {
  mutual_user_id: string;
  username: string | null;
  first_name: string | null;
  avatar_url: string | null;
};

export type MutualData = {
  previews: MutualPreview[];
  total_count: number;
};

interface UserRecommendationCardProps {
  user: RecommendedUser;
  mutualData?: MutualData;
  onFollowSuccess?: () => void;
}

const getSourceFallbackText = (source?: string): string => {
  switch (source) {
    case 'active': return 'Popular this week';
    case 'fresh': return 'New on Common Groundz';
    case 'fof': return 'Followed by people you follow';
    default: return 'Suggested for you';
  }
};

const formatMutualProofText = (previews: MutualPreview[], totalCount: number): { names: { name: string; userId: string; username: string | null }[]; suffix: string } => {
  const names = previews.slice(0, 2).map(p => ({
    name: p.first_name || p.username || 'someone',
    userId: p.mutual_user_id,
    username: p.username,
  }));

  if (totalCount === 1) {
    return { names, suffix: '' };
  }
  if (totalCount === 2) {
    return { names, suffix: '' };
  }
  const remaining = totalCount - 2;
  return { names, suffix: `and ${remaining} other${remaining === 1 ? '' : 's'} you follow` };
};

export const UserRecommendationCard: React.FC<UserRecommendationCardProps> = ({ 
  user, 
  mutualData,
  onFollowSuccess 
}) => {
  const { user: currentUser } = useAuth();
  const { isFollowing, followLoading, handleFollowToggle } = useFollow(user.id);
  const [isHidden, setIsHidden] = useState(false);

  const handleOptimisticFollow = async () => {
    setIsHidden(true);
    
    try {
      await handleFollowToggle();
      
      if (currentUser?.id) {
        await logUserImpression(currentUser.id, user.id);
      }
      
      onFollowSuccess?.();
    } catch (error) {
      setIsHidden(false);
    }
  };

  if (isHidden || isFollowing) {
    return null;
  }

  const hasMutuals = mutualData && mutualData.total_count > 0;

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <ProfileAvatar 
          userId={user.id} 
          size="sm"
          showSkeleton={false}
        />
        <div className="flex-1 min-w-0">
          <UsernameLink 
            username={user.username} 
            userId={user.id}
            className="font-medium text-sm block truncate"
          >
            {user.displayName}
          </UsernameLink>
          {user.username && (
            <div className="text-xs text-muted-foreground truncate">
              @{user.username}
            </div>
          )}
          {/* Mutual proof or fallback reason */}
          {hasMutuals ? (
            <MutualProofLine mutualData={mutualData} />
          ) : (
            <div className="text-xs text-muted-foreground/70 truncate mt-0.5">
              {getSourceFallbackText(user.source)}
            </div>
          )}
        </div>
      </div>
      <Button
        size="sm"
        variant="default"
        onClick={handleOptimisticFollow}
        disabled={followLoading}
        className="text-xs px-3 py-1 h-auto ml-2 shrink-0"
      >
        {followLoading ? 'Following...' : 'Follow'}
      </Button>
    </div>
  );
};

const MutualProofLine: React.FC<{ mutualData: MutualData }> = ({ mutualData }) => {
  const { names, suffix } = formatMutualProofText(mutualData.previews, mutualData.total_count);
  const ariaLabel = `Mutual followers: ${names.map(n => n.name).join(', ')}`;

  return (
    <div className="flex items-center gap-1.5 mt-0.5">
      {/* Stacked clickable avatars */}
      <div className="flex items-center shrink-0" aria-label={ariaLabel}>
        {mutualData.previews.slice(0, 2).map((preview, index) => {
          const profilePath = preview.username ? `/u/${preview.username}` : `/profile/${preview.mutual_user_id}`;
          return (
            <Link
              key={preview.mutual_user_id}
              to={profilePath}
              onClick={e => e.stopPropagation()}
              style={{ marginLeft: index > 0 ? '-0.25rem' : '0' }}
              className="relative z-10 hover:z-20 transition-transform hover:scale-110"
            >
              <ProfileAvatar
                userId={preview.mutual_user_id}
                size="xs"
                className="border-2 border-background"
                showSkeleton={false}
              />
            </Link>
          );
        })}
      </div>
      {/* Non-interactive text */}
      <span className="text-xs text-muted-foreground/70 truncate">
        Followed by{' '}
        {names.map((n, i) => (
          <React.Fragment key={n.userId}>
            {i > 0 && (mutualData.total_count === 2 && i === 1 ? ' and ' : ', ')}
            <span className="font-medium">{n.name}</span>
          </React.Fragment>
        ))}
        {suffix && <> {suffix}</>}
      </span>
    </div>
  );
};
