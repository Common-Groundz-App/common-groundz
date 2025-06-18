
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { discoveryService, DiscoveryCollection } from '@/services/discoveryService';
import { enhancedDiscoveryService } from '@/services/enhancedDiscoveryService';
import { PersonalizedEntity } from '@/services/enhancedExploreService';

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
  const [discoveryCollections, setDiscoveryCollections] = useState<DiscoveryCollection[]>([]);
  const [newThisWeek, setNewThisWeek] = useState<PersonalizedEntity[]>([]);
  const [forYou, setForYou] = useState<PersonalizedEntity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchDiscoveryData = async () => {
    try {
      setIsLoading(true);
      
      if (user?.id && useAdvancedAlgorithms) {
        // Use enhanced discovery service for authenticated users
        const [collections, newEntities, forYouEntities] = await Promise.all([
          enhancedDiscoveryService.getEnhancedDiscoveryCollections(user.id),
          enhancedDiscoveryService.getQualityNewThisWeek(6),
          enhancedDiscoveryService.getSmartForYouRecommendations(user.id, 6)
        ]);

        setDiscoveryCollections(collections);
        setNewThisWeek(newEntities);
        setForYou(forYouEntities);

        // Background: Calculate quality scores for newly discovered entities
        const allEntityIds = [
          ...newEntities.map(e => e.id),
          ...forYouEntities.map(e => e.id),
          ...collections.flatMap(c => c.entities.map(e => e.id))
        ];
        enhancedDiscoveryService.calculateQualityScores([...new Set(allEntityIds)]);
        
      } else {
        // Fall back to basic discovery service
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
    
    let intervalId: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      intervalId = setInterval(fetchDiscoveryData, refreshInterval);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [user?.id, autoRefresh, refreshInterval, useAdvancedAlgorithms]);

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
