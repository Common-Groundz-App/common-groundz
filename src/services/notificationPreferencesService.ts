import { supabase } from '@/integrations/supabase/client';

export interface NotificationPreferences {
  id: string;
  user_id: string;
  weekly_digest_enabled: boolean;
  journey_notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
}

class NotificationPreferencesService {
  async getPreferences(): Promise<NotificationPreferences | null> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return null;
    }

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[NotificationPreferencesService] Error fetching preferences:', error);
      throw error;
    }

    return data as NotificationPreferences | null;
  }

  async upsertPreferences(preferences: Partial<Pick<NotificationPreferences, 'weekly_digest_enabled' | 'journey_notifications_enabled'>>): Promise<NotificationPreferences> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert(
        {
          user_id: user.id,
          ...preferences,
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('[NotificationPreferencesService] Error upserting preferences:', error);
      throw error;
    }

    return data as NotificationPreferences;
  }

  async toggleWeeklyDigest(enabled: boolean): Promise<void> {
    await this.upsertPreferences({ weekly_digest_enabled: enabled });
  }

  async toggleJourneyNotifications(enabled: boolean): Promise<void> {
    await this.upsertPreferences({ journey_notifications_enabled: enabled });
  }
}

export const notificationPreferencesService = new NotificationPreferencesService();
