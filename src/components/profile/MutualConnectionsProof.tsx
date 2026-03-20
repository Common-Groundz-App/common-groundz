
import React, { useEffect, useRef, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ProfileAvatar } from '@/components/common/ProfileAvatar';
import { analytics } from '@/services/analytics';
import UserListModal from './modals/UserListModal';

interface MutualUser {
  id: string;
  username: string | null;
  first_name: string | null;
  avatar_url: string | null;
  total_count: number;
}

interface MutualConnectionsProofProps {
  profileUserId: string;
  isOwnProfile: boolean;
}

const formatMutualText = (users: MutualUser[], totalCount: number): string => {
  const names = users.map(u => u.first_name || u.username || 'Someone');

  if (totalCount === 1) {
    return `Followed by ${names[0]}`;
  }
  if (totalCount === 2) {
    return `Followed by ${names[0]} and ${names[1] || 'someone'}`;
  }
  // 3+
  const shown = names.slice(0, 2).join(', ');
  const remaining = totalCount - 2;
  return `Followed by ${shown} and ${remaining} other${remaining === 1 ? '' : 's'} you follow`;
};

const MutualConnectionsProof: React.FC<MutualConnectionsProofProps> = ({
  profileUserId,
  isOwnProfile
}) => {
  const { user } = useAuth();
  const [mutuals, setMutuals] = useState<MutualUser[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!user?.id || isOwnProfile || user.id === profileUserId) return;

    const fetchMutuals = async () => {
      try {
        const { data, error } = await supabase.rpc('get_profile_mutual_connections', {
          viewer_id: user.id,
          profile_user_id: profileUserId,
          result_limit: 3
        });

        if (error || !data || data.length === 0) {
          setMutuals([]);
          setTotalCount(0);
          return;
        }

        setMutuals(data as MutualUser[]);
        setTotalCount(Number(data[0]?.total_count) || 0);
      } catch {
        setMutuals([]);
        setTotalCount(0);
      }
    };

    fetchMutuals();
  }, [user?.id, profileUserId, isOwnProfile]);

  // Analytics — fire once per mount
  useEffect(() => {
    if (totalCount > 0 && !trackedRef.current) {
      trackedRef.current = true;
      analytics.track('mutual_proof_shown', { surface: 'profile', count: totalCount });
    }
  }, [totalCount]);

  if (!user || isOwnProfile || totalCount === 0) return null;

  const text = formatMutualText(mutuals, totalCount);

  const handleClick = () => {
    analytics.track('mutual_proof_clicked', { surface: 'profile' });
    setShowModal(true);
  };

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
        {/* Stacked avatars */}
        <div className="flex items-center">
          {mutuals.map((mutual, index) => (
            <Link
              key={mutual.id}
              to={mutual.username ? `/u/${mutual.username}` : `/profile/${mutual.id}`}
              className="relative group"
              style={{ marginLeft: index > 0 ? '-0.5rem' : '0' }}
            >
              <ProfileAvatar
                userId={mutual.id}
                size="sm"
                className="border-2 border-background ring-1 ring-border/20 group-hover:scale-110 transition-transform duration-200"
                showSkeleton={false}
              />
            </Link>
          ))}
        </div>

        {/* Clickable text */}
        <span
          className="cursor-pointer hover:text-primary hover:underline transition-colors duration-200 leading-tight"
          onClick={handleClick}
        >
          {text}
        </span>
      </div>

      <UserListModal
        open={showModal}
        onOpenChange={setShowModal}
        profileUserId={profileUserId}
        listType="followers"
        isOwnProfile={false}
      />
    </>
  );
};

export default MutualConnectionsProof;
