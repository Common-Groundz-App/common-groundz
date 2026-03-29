import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ProfileAvatar } from '@/components/common/ProfileAvatar';
import UsernameLink from '@/components/common/UsernameLink';
import { useProfile } from '@/hooks/use-profile-cache';
import { useNavigate } from 'react-router-dom';
import { getEntityUrl } from '@/utils/entityUrlUtils';
import { Star } from 'lucide-react';

interface TaggedEntity {
  id: string;
  name: string;
  type: string;
  slug?: string;
  description?: string;
  image_url?: string;
  category_id?: string;
}

interface PostDetailSidebarProps {
  authorId: string | null;
  taggedEntities: TaggedEntity[];
  loading?: boolean;
}

const EntityCard: React.FC<{ entity: TaggedEntity }> = ({ entity }) => {
  const navigate = useNavigate();
  const entityUrl = getEntityUrl(entity as any);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {entity.image_url && (
            <img
              src={entity.image_url}
              alt={entity.name}
              className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <button
              onClick={() => navigate(entityUrl)}
              className="font-semibold text-sm hover:underline text-left leading-tight"
            >
              {entity.name}
            </button>
            <span className="text-xs text-muted-foreground capitalize block mt-0.5">
              {entity.type}
            </span>
          </div>
        </div>

        {entity.description && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
            {entity.description}
          </p>
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
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
            {profile.bio}
          </p>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full mt-3 text-xs"
          onClick={() => navigate(profileUrl)}
        >
          View Profile
        </Button>
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
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-12 w-12 rounded-lg" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-4 w-24" />
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
