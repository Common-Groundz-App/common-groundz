import { useState, useEffect } from 'react';
import { cachedPhotoService } from '@/services/cachedPhotoService';
import { supabase } from '@/integrations/supabase/client';

export interface CachedPhotoStats {
  totalCached: number;
  expired: number;
  byQuality: Record<string, number>;
  byEntity: Record<string, number>;
  loading: boolean;
  error: string | null;
}

export const useCachedPhotoStats = () => {
  const [stats, setStats] = useState<CachedPhotoStats>({
    totalCached: 0,
    expired: 0,
    byQuality: {},
    byEntity: {},
    loading: true,
    error: null
  });

  const refreshStats = async () => {
    try {
      setStats(prev => ({ ...prev, loading: true, error: null }));
      const cacheStats = await cachedPhotoService.getCacheStats();
      setStats({
        ...cacheStats,
        loading: false,
        error: null
      });
    } catch (error) {
      console.error('Error fetching cache stats:', error);
      setStats(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch stats'
      }));
    }
  };

  const cleanupExpiredPhotos = async (): Promise<number> => {
    try {
      const deletedCount = await cachedPhotoService.cleanupExpiredPhotos();
      // Refresh stats after cleanup
      await refreshStats();
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up expired photos:', error);
      throw error;
    }
  };

  const manualCleanup = async (): Promise<{ deletedCount: number; stats: any }> => {
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-cached-photos');
      
      if (error) {
        throw error;
      }
      
      // Refresh our local stats
      await refreshStats();
      
      return data;
    } catch (error) {
      console.error('Error in manual cleanup:', error);
      throw error;
    }
  };

  useEffect(() => {
    refreshStats();
  }, []);

  return {
    stats,
    refreshStats,
    cleanupExpiredPhotos,
    manualCleanup
  };
};