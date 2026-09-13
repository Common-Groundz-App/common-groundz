
import { supabase } from '@/integrations/supabase/client';
import { PersonalizedEntity } from './enhancedExploreService';

export interface DiscoveryCollection {
  title: string;
  entities: PersonalizedEntity[];
  type: 'new' | 'social' | 'contextual' | 'location' | 'mood';
  reason: string;
}

/**
 * Phase 4.2B.3 — discovery surfaces read canonical reviews, never the legacy
 * recommendations table. Global surfaces use public + published reviews only;
 * social surfaces rely on RLS to scope visibility to what the viewer may see.
 * Endorsement eligibility is the DB-resolved reviews.is_recommended = true.
 */
interface CanonicalReview {
  user_id: string;
  entity_id: string;
  rating: number | null;
  latest_rating: number | null;
  is_recommended: boolean | null;
  created_at: string;
}

/** Keep the latest review per (user_id, entity_id). Input must be created_at DESC. */
const canonicalize = (rows: CanonicalReview[]): CanonicalReview[] => {
  const seen = new Set<string>();
  const out: CanonicalReview[] = [];
  for (const row of rows) {
    const key = `${row.user_id}:${row.entity_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
};

const effectiveRating = (r: CanonicalReview): number => r.latest_rating ?? r.rating ?? 0;

export class DiscoveryService {
  
  // Get "New This Week" entities with good initial ratings
  async getNewThisWeek(limit: number = 6): Promise<PersonalizedEntity[]> {
    try {
      const { data: entities } = await supabase
        .from('entities')
        .select('*')
        .eq('is_deleted', false)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(limit * 2);

      if (!entities || entities.length === 0) return [];

      // Canonical public reviews for these entities (global surface population)
      const { data: reviewRows } = await supabase
        .from('reviews')
        .select('user_id, entity_id, rating, latest_rating, is_recommended, created_at')
        .eq('status', 'published')
        .eq('visibility', 'public')
        .in('entity_id', entities.map(e => e.id))
        .order('created_at', { ascending: false });

      const byEntity = new Map<string, { count: number; total: number }>();
      canonicalize((reviewRows || []) as CanonicalReview[]).forEach(r => {
        const entry = byEntity.get(r.entity_id) || { count: 0, total: 0 };
        entry.count += 1;
        entry.total += effectiveRating(r);
        byEntity.set(r.entity_id, entry);
      });

      // Filter entities with good initial engagement (avg rating >= 4 or multiple reviewers)
      const qualityNewEntities = entities
        .filter(entity => {
          const agg = byEntity.get(entity.id);
          if (!agg || agg.count === 0) return false;
          return agg.count >= 2 || (agg.total / agg.count) >= 4.0;
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
      // First get the list of users the current user follows
      const { data: followingUsers } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId);

      if (!followingUsers || followingUsers.length === 0) {
        return [];
      }

      const followingIds = followingUsers.map(f => f.following_id);

      // Recent canonical endorsements by followed users. Visibility and
      // canonical-first endorsement selection are enforced in SQL
      // (public + circle_only by followed authors), never re-implemented here.
      const { data: reviewRows } = await supabase
        .rpc('get_canonical_endorsements_for_viewer', {
          p_viewer_id: userId,
          p_user_ids: followingIds,
          p_since: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
        });

      if (!reviewRows || reviewRows.length === 0) return [];

      // Already canonical + endorsed (recency-ordered by the routine)
      const canonical = reviewRows as Array<{ user_id: string; entity_id: string; created_at: string }>;
      const entityIdsInOrder: string[] = [];
      const seenEntities = new Set<string>();
      canonical.forEach(r => {
        if (!seenEntities.has(r.entity_id)) {
          seenEntities.add(r.entity_id);
          entityIdsInOrder.push(r.entity_id);
        }
      });

      const { data: entities } = await supabase
        .from('entities')
        .select('*')
        .eq('is_deleted', false)
        .in('id', entityIdsInOrder.slice(0, limit * 3));

      if (!entities) return [];

      const entityById = new Map(entities.map(e => [e.id, e]));
      return entityIdsInOrder
        .map(id => entityById.get(id))
        .filter((e): e is NonNullable<typeof e> => Boolean(e))
        .slice(0, limit)
        .map(entity => ({
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
        .order('trending_score_v2', { ascending: false })
        .order('id', { ascending: true })
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
        .order('trending_score_v2', { ascending: false })
        .order('id', { ascending: true })
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
        .order('trending_score_v2', { ascending: false })
        .order('id', { ascending: true })
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
        .order('trending_score_v2', { ascending: false })
        .order('id', { ascending: true })
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

      // Get entities matching user interests with proper type assertion
      const entityTypes = userInterests.data
        .map(i => i.entity_type)
        .filter(type => ['book', 'movie', 'place', 'product', 'food'].includes(type)) as ('book' | 'movie' | 'place' | 'product' | 'food')[];

      if (entityTypes.length === 0) {
        return socialEntities;
      }

      const { data: personalizedEntities } = await supabase
        .from('entities')
        .select('*')
        .eq('is_deleted', false)
        .in('type', entityTypes)
        .order('trending_score_v2', { ascending: false })
        .order('id', { ascending: true })
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
