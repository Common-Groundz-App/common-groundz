
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
  metadata?: {
    comment_id?: string;
    [key: string]: any;
  };
}

export const fetchNotifications = async (limit = 20): Promise<Notification[]> => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as Notification[];
};

export const markNotificationsAsRead = async (notificationIds: string[]): Promise<string[]> => {
  const { data, error } = await supabase
    .rpc('mark_notifications_as_read', { notification_ids: notificationIds });

  if (error) throw error;
  return data || [];
};

// Helper function to generate content URLs
export const getContentUrl = (type: EntityType, id: string, commentId?: string): string => {
  if (!type || !id) return '#';
  
  let url = '';
  
  switch (type) {
    case 'post':
      url = `/post/${id}`;
      break;
    case 'recommendation':
      url = `/recommendation/${id}`;
      break;
    case 'review':
      url = `/review/${id}`;
      break;
    case 'profile':
      url = `/profile/${id}`;
      break;
    default:
      url = '#';
  }
  
  // Add comment ID as a query parameter if provided
  if (commentId) {
    url += `?commentId=${commentId}`;
  }
  
  return url;
};
