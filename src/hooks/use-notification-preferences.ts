import { useState, useEffect, useCallback } from 'react';
import { notificationPreferencesService, NotificationPreferences } from '@/services/notificationPreferencesService';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function useNotificationPreferences() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPreferences = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const data = await notificationPreferencesService.getPreferences();
      setPreferences(data);
    } catch (err) {
      console.error('[useNotificationPreferences] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const toggleWeeklyDigest = async (enabled: boolean) => {
    try {
      await notificationPreferencesService.toggleWeeklyDigest(enabled);
      setPreferences(prev => prev ? { ...prev, weekly_digest_enabled: enabled } : null);
      toast({
        title: enabled ? 'Weekly digest enabled' : 'Weekly digest disabled',
        description: enabled 
          ? "You'll receive weekly journey insights" 
          : "You won't receive weekly digests",
      });
    } catch (err) {
      toast({
        title: 'Error updating preferences',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const toggleJourneyNotifications = async (enabled: boolean) => {
    try {
      await notificationPreferencesService.toggleJourneyNotifications(enabled);
      setPreferences(prev => prev ? { ...prev, journey_notifications_enabled: enabled } : null);
      toast({
        title: enabled ? 'Journey notifications enabled' : 'Journey notifications disabled',
      });
    } catch (err) {
      toast({
        title: 'Error updating preferences',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  };

  return {
    preferences,
    isLoading,
    toggleWeeklyDigest,
    toggleJourneyNotifications,
    refetch: fetchPreferences,
  };
}
