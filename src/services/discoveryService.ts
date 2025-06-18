
import { supabase } from '@/integrations/supabase/client';
import { PersonalizedEntity } from './enhancedExploreService';

export interface DiscoveryCollection {
  title: string;
  entities: PersonalizedEntity[];
  type: 'new' | 'social' | 'contextual' | 'location' | 'mood';
  reason: string;
}

export class DiscoveryService {
  
  // Get "New This Week" entities with good initial ratings
  async getNewThisWeek(limit: number = 6): Promise<PersonalizedEntity[]> {
    try {
      const { data: entities } = await supabase
        .from('entities')
        .select(`
          *,
          recommendations!inner(rating)
        `)
        .eq('is_deleted', false)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(limit * 2);

      if (!entities) return [];

      // Filter entities with good initial engagement (rating >= 4 or multiple recommendations)
      const qualityNewEntities = entities
        .filter(entity => {
          const recommendations = entity.recommendations || [];
          const avgRating = recommendations.length > 0 
            ? recommendations.reduce((sum: number, rec: any) => sum + rec.rating, 0) / recommendations.length
            : 0;
          return recommendations.length >= 2 || avgRating >= 4.0;
        })
        .slice(0, limit);

      return qualityNewEntities.map(entity => ({
        ...entity,
        reason: 'New this week'
      }));
    } catch (error) {
      console.error('Error getting new entities:', error);
      return [];
    }
  }

  // Get entities liked by people the user follows
  async getSocialDiscovery(userId: string, limit: number = 6): Promise<PersonalizedEntity[]> {
    try {
      const { data: entities } = await supabase
        .from('entities')
        .select(`
          *,
          recommendations!inner(user_id, rating, created_at)
        `)
        .eq('is_deleted', false)
        .in('recommendations.user_id', 
          supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', userId)
        )
        .gte('recommendations.created_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
        .order('recommendations.created_at', { ascending: false })
        .limit(limit);

      if (!entities) return [];

      return entities.map(entity => ({
        ...entity,
        reason: 'Friends are loving this'
      }));
    } catch (error) {
      console.error('Error getting social discovery:', error);
      return [];
    }
  }

  // Get contextual recommendations based on time and season
  async getContextualRecommendations(limit: number = 6): Promise<PersonalizedEntity[]> {
    try {
      const now = new Date();
      const hour = now.getHours();
      const month = now.getMonth();
      
      let contextualQuery = supabase
        .from('entities')
        .select('*')
        .eq('is_deleted', false);

      // Time-based filtering
      if (hour >= 6 && hour <= 11) {
        // Morning: breakfast, coffee, books
        contextualQuery = contextualQuery.or('type.eq.food,type.eq.book');
      } else if (hour >= 17 && hour <= 22) {
        // Evening: restaurants, movies, places
        contextualQuery = contextualQuery.or('type.eq.food,type.eq.movie,type.eq.place');
      }

      // Seasonal filtering
      let seasonalBoost = '';
      if (month >= 11 || month <= 1) {
        seasonalBoost = 'winter';
      } else if (month >= 2 && month <= 4) {
        seasonalBoost = 'spring';
      } else if (month >= 5 && month <= 7) {
        seasonalBoost = 'summer';
      } else {
        seasonalBoost = 'fall';
      }

      const { data: entities } = await contextualQuery
        .order('trending_score', { ascending: false })
        .limit(limit);

      if (!entities) return [];

      const timeContext = hour >= 6 && hour <= 11 ? 'Perfect for morning' : 
                         hour >= 17 && hour <= 22 ? 'Great for tonight' : 
                         'Trending now';

      return entities.map(entity => ({
        ...entity,
        reason: timeContext
      }));
    } catch (error) {
      console.error('Error getting contextual recommendations:', error);
      return [];
    }
  }

  // Get location-aware recommendations (placeholder for future geo implementation)
  async getLocationBasedRecommendations(userLocation?: string, limit: number = 6): Promise<PersonalizedEntity[]> {
    try {
      const { data: entities } = await supabase
        .from('entities')
        .select('*')
        .eq('is_deleted', false)
        .eq('type', 'place')
        .order('trending_score', { ascending: false })
        .limit(limit);

      if (!entities) return [];

      return entities.map(entity => ({
        ...entity,
        reason: 'Popular nearby'
      }));
    } catch (error) {
      console.error('Error getting location-based recommendations:', error);
      return [];
    }
  }

  // Get mood-based collections
  async getMoodBasedCollections(): Promise<{ [key: string]: PersonalizedEntity[] }> {
    try {
      const collections: { [key: string]: PersonalizedEntity[] } = {};
      
      // Comfort food collection
      const { data: comfortFood } = await supabase
        .from('entities')
        .select('*')
        .eq('is_deleted', false)
        .eq('type', 'food')
        .contains('metadata', { tags: ['comfort', 'cozy', 'warm'] })
        .order('trending_score', { ascending: false })
        .limit(4);

      if (comfortFood && comfortFood.length > 0) {
        collections['Comfort Favorites'] = comfortFood.map(entity => ({
          ...entity,
          reason: 'Perfect comfort choice'
        }));
      }

      // Quick discoveries
      const { data: quickPicks } = await supabase
        .from('entities')
        .select('*')
        .eq('is_deleted', false)
        .gte('trending_score', 5)
        .order('trending_score', { ascending: false })
        .limit(4);

      if (quickPicks && quickPicks.length > 0) {
        collections['Quick Discoveries'] = quickPicks.map(entity => ({
          ...entity,
          reason: 'Quick find'
        }));
      }

      return collections;
    } catch (error) {
      console.error('Error getting mood-based collections:', error);
      return {};
    }
  }

  // Get "For You" personalized recommendations with enhanced logic
  async getForYouRecommendations(userId: string, limit: number = 6): Promise<PersonalizedEntity[]> {
    try {
      // Get user interests and social connections
      const [userInterests, socialEntities] = await Promise.all([
        supabase
          .from('user_interests')
          .select('*')
          .eq('user_id', userId)
          .order('interest_score', { ascending: false })
          .limit(5),
        this.getSocialDiscovery(userId, 3)
      ]);

      if (!userInterests.data || userInterests.data.length === 0) {
        return socialEntities;
      }

      // Get entities matching user interests
      const entityTypes = userInterests.data.map(i => i.entity_type);
      const { data: personalizedEntities } = await supabase
        .from('entities')
        .select('*')
        .eq('is_deleted', false)
        .in('type', entityTypes)
        .order('trending_score', { ascending: false })
        .limit(limit);

      if (!personalizedEntities) return socialEntities;

      // Combine and deduplicate
      const allEntities = [...personalizedEntities, ...socialEntities];
      const uniqueEntities = Array.from(
        new Map(allEntities.map(e => [e.id, e])).values()
      ).slice(0, limit);

      return uniqueEntities.map(entity => ({
        ...entity,
        reason: 'Curated for you'
      }));
    } catch (error) {
      console.error('Error getting for you recommendations:', error);
      return [];
    }
  }

  // Get all discovery collections for a user
  async getAllDiscoveryCollections(userId?: string): Promise<DiscoveryCollection[]> {
    try {
      const [newThisWeek, contextual, moodCollections, locationBased] = await Promise.all([
        this.getNewThisWeek(4),
        this.getContextualRecommendations(4),
        this.getMoodBasedCollections(),
        this.getLocationBasedRecommendations(undefined, 4)
      ]);

      const collections: DiscoveryCollection[] = [];

      if (newThisWeek.length > 0) {
        collections.push({
          title: 'New This Week',
          entities: newThisWeek,
          type: 'new',
          reason: 'Fresh discoveries with great reviews'
        });
      }

      if (userId) {
        const [socialDiscovery, forYou] = await Promise.all([
          this.getSocialDiscovery(userId, 4),
          this.getForYouRecommendations(userId, 4)
        ]);

        if (forYou.length > 0) {
          collections.push({
            title: 'For You',
            entities: forYou,
            type: 'social',
            reason: 'Based on your interests and activity'
          });
        }

        if (socialDiscovery.length > 0) {
          collections.push({
            title: 'Friends Are Loving',
            entities: socialDiscovery,
            type: 'social',
            reason: 'Popular with people you follow'
          });
        }
      }

      if (contextual.length > 0) {
        const hour = new Date().getHours();
        const title = hour >= 6 && hour <= 11 ? 'Perfect for Morning' : 
                     hour >= 17 && hour <= 22 ? 'Great for Tonight' : 
                     'Right Now';
        
        collections.push({
          title,
          entities: contextual,
          type: 'contextual',
          reason: 'Matches the current time and season'
        });
      }

      if (locationBased.length > 0) {
        collections.push({
          title: 'Popular Places',
          entities: locationBased,
          type: 'location',
          reason: 'Trending locations to explore'
        });
      }

      // Add mood-based collections
      Object.entries(moodCollections).forEach(([title, entities]) => {
        if (entities.length > 0) {
          collections.push({
            title,
            entities,
            type: 'mood',
            reason: 'Curated for your mood'
          });
        }
      });

      return collections;
    } catch (error) {
      console.error('Error getting discovery collections:', error);
      return [];
    }
  }
}

export const discoveryService = new DiscoveryService();
