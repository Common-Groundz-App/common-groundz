
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

// Helper function to generate the appropriate action URL based on notification type
const generateActionUrl = (notification: Notification): string | null => {
  const { type, entity_type, entity_id, sender_id, metadata } = notification;
  
  if (!entity_type || !entity_id) {
    return null;
  }
  
  switch (type) {
    case 'like':
      if (entity_type === 'post') {
        return `/profile/${sender_id}?post=${entity_id}`;
      } else if (entity_type === 'recommendation') {
        return `/profile/${sender_id}?rec=${entity_id}`;
      } else if (entity_type === 'review') {
        return `/profile/${sender_id}?review=${entity_id}`;
      }
      break;
      
    case 'comment':
      if (entity_type === 'post') {
        // If we have a comment ID in metadata, include it to scroll to that comment
        const commentId = metadata?.comment_id;
        return commentId 
          ? `/profile/${sender_id}?post=${entity_id}&comment=${commentId}`
          : `/profile/${sender_id}?post=${entity_id}`;
      } else if (entity_type === 'recommendation') {
        const commentId = metadata?.comment_id;
        return commentId 
          ? `/profile/${sender_id}?rec=${entity_id}&comment=${commentId}`
          : `/profile/${sender_id}?rec=${entity_id}`;
      }
      break;
      
    case 'follow':
      return `/profile/${sender_id}`;
      
    case 'system':
      // System notifications might have custom URLs defined already
      return notification.action_url;
      
    default:
      return null;
  }
  
  return null;
};

export const fetchNotifications = async (limit = 20): Promise<Notification[]> => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  
  // Process notifications to ensure they have the correct action URLs
  const processedNotifications = data.map(notification => {
    // Use the database-provided action_url if it exists, otherwise generate one
    const actionUrl = notification.action_url || generateActionUrl(notification);
    
    return {
      ...notification,
      action_url: actionUrl
    };
  });
  
  return processedNotifications as Notification[];
};

export const markNotificationsAsRead = async (notificationIds: string[]): Promise<string[]> => {
  const { data, error } = await supabase
    .rpc('mark_notifications_as_read', { notification_ids: notificationIds });

  if (error) throw error;
  return data || [];
};
