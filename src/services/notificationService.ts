
import { supabase } from '@/integrations/supabase/client';

export type NotificationType = 'like' | 'comment' | 'follow' | 'system';
export type EntityType = 'post' | 'recommendation' | 'review' | 'profile' | 'system';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  sender_id?: string;
  title: string;
  message: string;
  entity_type?: EntityType;
  entity_id?: string;
  is_read: boolean;
  image_url?: string | null;
  action_url?: string | null;
  created_at: string;
  updated_at: string;
  metadata?: any;
}

export const fetchNotifications = async (limit = 20): Promise<Notification[]> => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  
  // Correct action URLs before returning
  const notificationsWithFixedUrls = data.map(notification => {
    if (notification.entity_type === 'recommendation' && notification.action_url?.startsWith('/recommendations/')) {
      // Use the correct profile route with recommendation section instead
      return {
        ...notification,
        action_url: `/profile?rec=${notification.entity_id}`
      };
    }
    return notification;
  });
  
  return notificationsWithFixedUrls as Notification[];
};

export const markNotificationsAsRead = async (notificationIds: string[]): Promise<string[]> => {
  const { data, error } = await supabase
    .rpc('mark_notifications_as_read', { notification_ids: notificationIds });

  if (error) throw error;
  return data || [];
};
