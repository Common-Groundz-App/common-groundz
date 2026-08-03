import { supabase } from '@/integrations/supabase/client';

export interface NotificationPreferences {
  id: string;
  user_id: string;
  weekly_digest_enabled: boolean;
  journey_notifications_enabled: boolean;
  likes_enabled: boolean;
  comment_likes_enabled: boolean;
  comments_enabled: boolean;
  replies_enabled: boolean;
  mentions_enabled: boolean;
  follows_enabled: boolean;
  created_at: string;
  updated_at: string;
}

/** Preference keys the UI can toggle. */
export type NotificationPreferenceKey =
  | 'weekly_digest_enabled'
  | 'journey_notifications_enabled'
  | 'likes_enabled'
  | 'comment_likes_enabled'
  | 'comments_enabled'
  | 'replies_enabled'
  | 'mentions_enabled'
  | 'follows_enabled';

/**
 * Missing-row semantics, mirrored from the database column defaults and from
 * `public.notification_allowed`. A user with no preference row behaves exactly
 * as if every activity category were enabled, journey notifications enabled,
 * and the weekly digest disabled.
 */
export const NOTIFICATION_PREFERENCE_DEFAULTS: Record<NotificationPreferenceKey, boolean> = {
  weekly_digest_enabled: false,
  journey_notifications_enabled: true,
  likes_enabled: true,
  comment_likes_enabled: true,
  comments_enabled: true,
  replies_enabled: true,
  mentions_enabled: true,
  follows_enabled: true,
};

export const NOTIFICATION_PREFERENCE_KEYS = Object.keys(
  NOTIFICATION_PREFERENCE_DEFAULTS
) as NotificationPreferenceKey[];

class NotificationPreferencesService {
  /**
   * Reads the preference row for an explicitly passed user id. The caller owns
   * identity resolution so a queued request can never land on a different
   * account after a sign-out or account switch.
   */
  async getPreferences(userId: string): Promise<NotificationPreferences | null> {
    if (!userId) return null;

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[NotificationPreferencesService] Error fetching preferences:', error);
      throw error;
    }

    return (data as NotificationPreferences | null) ?? null;
  }

  /**
   * Writes a single preference key for an explicitly passed user id.
   *
   * Update-then-insert rather than an upsert carrying every column: a full-row
   * upsert would overwrite the user's other categories with defaults whenever
   * two toggles race. The insert path only supplies defaults when no row exists
   * yet, so a user's first toggle can never create a row with unintended values.
   */
  async setPreference(
    userId: string,
    key: NotificationPreferenceKey,
    value: boolean
  ): Promise<NotificationPreferences> {
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const { data: updated, error: updateError } = await supabase
      .from('notification_preferences')
      .update({ [key]: value })
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (updateError) {
      console.error('[NotificationPreferencesService] Error updating preferences:', updateError);
      throw updateError;
    }

    if (updated) {
      return updated as NotificationPreferences;
    }

    // No row yet: create one from the documented defaults with this key applied.
    const { data: inserted, error: insertError } = await supabase
      .from('notification_preferences')
      .upsert(
        {
          user_id: userId,
          ...NOTIFICATION_PREFERENCE_DEFAULTS,
          [key]: value,
        },
        { onConflict: 'user_id', ignoreDuplicates: false }
      )
      .select()
      .single();

    if (insertError) {
      console.error('[NotificationPreferencesService] Error creating preferences:', insertError);
      throw insertError;
    }

    return inserted as NotificationPreferences;
  }
}


export const notificationPreferencesService = new NotificationPreferencesService();
