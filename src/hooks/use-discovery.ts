
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { discoveryService, DiscoveryCollection } from '@/services/discoveryService';
import { enhancedDiscoveryService } from '@/services/enhancedDiscoveryService';
import { PersonalizedEntity } from '@/services/enhancedExploreService';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

interface UseDiscoveryProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
  useAdvancedAlgorithms?: boolean;
}

export const useDiscovery = ({ 
  autoRefresh = false, 
  refreshInterval = 10 * 60 * 1000, // 10 minutes
  useAdvancedAlgorithms = true
}: UseDiscoveryProps = {}) => {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [discoveryCollections, setDiscoveryCollections] = useState<DiscoveryCollection[]>([]);
  const [newThisWeek, setNewThisWeek] = useState<PersonalizedEntity[]>([]);
  const [forYou, setForYou] = useState<PersonalizedEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchDiscoveryData = async () => {
    if (!isOnline) return;
    
    try {
      setIsLoading(true);
      
      if (user?.id && useAdvancedAlgorithms) {
        const [collections, newEntities, forYouEntities] = await Promise.all([
          enhancedDiscoveryService.getEnhancedDiscoveryCollections(user.id),
          enhancedDiscoveryService.getQualityNewThisWeek(6),
          enhancedDiscoveryService.getSmartForYouRecommendations(user.id, 6)
        ]);

        setDiscoveryCollections(collections);
        setNewThisWeek(newEntities);
        setForYou(forYouEntities);
      } else {
        const [collections, newEntities, forYouEntities] = await Promise.all([
          discoveryService.getAllDiscoveryCollections(user?.id),
          discoveryService.getNewThisWeek(6),
          user?.id ? discoveryService.getForYouRecommendations(user.id, 6) : Promise.resolve([])
        ]);

        setDiscoveryCollections(collections);
        setNewThisWeek(newEntities);
        setForYou(forYouEntities);
      }
      
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching discovery data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscoveryData();
    
    if (autoRefresh) {
      const scheduleNext = () => {
        timerRef.current = setTimeout(async () => {
          if (document.hidden || !isOnline) {
            scheduleNext();
            return;
          }
          await fetchDiscoveryData();
          scheduleNext();
        }, refreshInterval);
      };
      scheduleNext();
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [user?.id, autoRefresh, refreshInterval, useAdvancedAlgorithms, isOnline]);

  const refreshDiscovery = () => {
    fetchDiscoveryData();
  };

  return {
    discoveryCollections,
    newThisWeek,
    forYou,
    isLoading,
    lastRefresh,
    refreshDiscovery
  };
};
