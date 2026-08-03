import React from 'react';
import { Bell } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import type { NotificationPreferenceKey } from '@/services/notificationPreferencesService';
import type { EffectiveNotificationPreferences } from '@/hooks/use-notification-preferences';

interface ActivityNotificationsCardProps {
  preferences: EffectiveNotificationPreferences;
  isLoading: boolean;
  setPreference: (key: NotificationPreferenceKey, value: boolean) => Promise<void> | void;
  isPending: (key: NotificationPreferenceKey) => boolean;
}

const CATEGORIES: Array<{
  key: NotificationPreferenceKey;
  id: string;
  label: string;
  description: string;
}> = [
  {
    key: 'likes_enabled',
    id: 'notif-likes',
    label: 'Likes',
    description: 'When someone likes your experience or recommendation',
  },
  {
    key: 'comments_enabled',
    id: 'notif-comments',
    label: 'Comments',
    description: 'When someone comments on your experience or recommendation',
  },
  {
    key: 'replies_enabled',
    id: 'notif-replies',
    label: 'Replies',
    description: 'When someone replies to your comment',
  },
  {
    key: 'mentions_enabled',
    id: 'notif-mentions',
    label: 'Mentions',
    description: 'When someone mentions you in a comment',
  },
  {
    key: 'comment_likes_enabled',
    id: 'notif-comment-likes',
    label: 'Comment likes',
    description: 'When someone likes your comment',
  },
  {
    key: 'follows_enabled',
    id: 'notif-follows',
    label: 'New followers',
    description: 'When someone follows you',
  },
];

const ActivityNotificationsCard: React.FC<ActivityNotificationsCardProps> = ({
  preferences,
  isLoading,
  setPreference,
  isPending,
}) => {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Activity notifications
        </CardTitle>
        <CardDescription>
          Choose what you get notified about. Turning something off only affects future
          activity — notifications you already have stay untouched.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="space-y-6">
            {CATEGORIES.map(category => (
              <div key={category.key} className="flex items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-6 w-11 rounded-full" />
              </div>
            ))}
          </div>
        ) : (
          CATEGORIES.map((category, index) => (
            <React.Fragment key={category.key}>
              {index > 0 && <Separator />}
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <Label htmlFor={category.id} className="font-medium">
                    {category.label}
                  </Label>
                  <p id={`${category.id}-description`} className="text-sm text-muted-foreground">
                    {category.description}
                  </p>
                </div>
                <Switch
                  id={category.id}
                  aria-describedby={`${category.id}-description`}
                  checked={preferences[category.key]}
                  onCheckedChange={value => setPreference(category.key, value)}
                  disabled={isPending(category.key)}
                />
              </div>
            </React.Fragment>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default ActivityNotificationsCard;
