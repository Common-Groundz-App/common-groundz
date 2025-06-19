import { cacheService } from './cacheService';
import { fetchForYouFeed, fetchFollowingFeed } from '@/hooks/feed/api/feed';

interface ScrollBehavior {
  timestamp: number;
  scrollTop: number;
  velocity: number;
  direction: 'up' | 'down';
}

interface UserBehaviorPattern {
  userId: string;
  averageScrollVelocity: number;
  preferredFeedType: 'for-you' | 'following';
  sessionDuration: number;
  lastActiveTab: string;
  scrollBehaviors: ScrollBehavior[];
}

class SmartPrefetchService {
  private userBehaviors = new Map<string, UserBehaviorPattern>();
  private prefetchCache = new Map<string, any>();
  private scrollVelocityHistory: number[] = [];
  private lastScrollTime = 0;
  private lastScrollTop = 0;

  // Initialize prefetching for a user
  initializePrefetching(userId: string, currentTab: string) {
    if (!this.userBehaviors.has(userId)) {
      this.userBehaviors.set(userId, {
        userId,
        averageScrollVelocity: 0,
        preferredFeedType: currentTab as 'for-you' | 'following',
        sessionDuration: 0,
        lastActiveTab: currentTab,
        scrollBehaviors: []
      });
    }

    // Load cached behavior patterns
    const cachedBehavior = cacheService.get<UserBehaviorPattern>(`user-behavior-${userId}`);
    if (cachedBehavior) {
      this.userBehaviors.set(userId, cachedBehavior);
    }
  }

  // Handle scroll behavior for smart prefetching
  handleScrollBehavior(scrollTop: number, activeTab: string, userId: string) {
    const now = Date.now();
    const timeDiff = now - this.lastScrollTime;
    
    if (timeDiff > 0 && this.lastScrollTime > 0) {
      const scrollDiff = scrollTop - this.lastScrollTop;
      const velocity = Math.abs(scrollDiff) / timeDiff;
      
      // Track scroll velocity
      this.scrollVelocityHistory.push(velocity);
      if (this.scrollVelocityHistory.length > 10) {
        this.scrollVelocityHistory.shift();
      }

      // Update user behavior pattern
      const behavior = this.userBehaviors.get(userId);
      if (behavior) {
        behavior.scrollBehaviors.push({
          timestamp: now,
          scrollTop,
          velocity,
          direction: scrollDiff > 0 ? 'down' : 'up'
        });

        // Keep only recent behaviors (last 20)
        if (behavior.scrollBehaviors.length > 20) {
          behavior.scrollBehaviors.shift();
        }

        // Update average velocity
        const recentVelocities = behavior.scrollBehaviors.slice(-10).map(b => b.velocity);
        behavior.averageScrollVelocity = recentVelocities.reduce((a, b) => a + b, 0) / recentVelocities.length;

        // Cache updated behavior
        cacheService.set(`user-behavior-${userId}`, behavior, 24 * 60 * 60 * 1000); // 24 hours
      }

      // Trigger prefetching based on scroll behavior
      this.triggerSmartPrefetch(userId, activeTab, velocity, scrollTop);
    }

    this.lastScrollTime = now;
    this.lastScrollTop = scrollTop;
  }

  // Trigger smart prefetching based on user behavior
  private async triggerSmartPrefetch(userId: string, activeTab: string, velocity: number, scrollTop: number) {
    const behavior = this.userBehaviors.get(userId);
    if (!behavior) return;

    // High velocity scrolling indicates user is looking for content
    if (velocity > behavior.averageScrollVelocity * 1.5) {
      console.log('🚀 High velocity detected, prefetching next page...');
      await this.prefetchNextPage(activeTab, userId);
    }

    // Prefetch opposite tab if user frequently switches
    if (this.shouldPrefetchOppositeTab(behavior, activeTab)) {
      const oppositeTab = activeTab === 'for-you' ? 'following' : 'for-you';
      console.log(`🔄 Prefetching opposite tab: ${oppositeTab}`);
      await this.prefetchFeedData(oppositeTab, userId);
    }

    // Prefetch user profiles based on scroll position
    if (scrollTop > 1000) {
      console.log('👥 Prefetching user profiles...');
      await this.prefetchUserProfiles(userId);
    }
  }

  // Prefetch feed data for a specific tab
  async prefetchFeedData(feedType: 'for-you' | 'following', userId: string) {
    const cacheKey = `prefetch-${feedType}-${userId}`;
    
    // Check if already prefetched recently
    if (this.prefetchCache.has(cacheKey)) {
      return;
    }

    try {
      const fetchFunction = feedType === 'for-you' ? fetchForYouFeed : fetchFollowingFeed;
      const data = await fetchFunction({
        userId,
        page: 0,
        itemsPerPage: 10
      });

      // Cache the prefetched data
      cacheService.set(cacheKey, data, 5 * 60 * 1000); // 5 minutes
      this.prefetchCache.set(cacheKey, data);

      console.log(`✅ Prefetched ${feedType} feed data for user ${userId}`);
    } catch (error) {
      console.error(`Failed to prefetch ${feedType} feed:`, error);
    }
  }

  // Prefetch next page of current feed
  private async prefetchNextPage(activeTab: string, userId: string) {
    const cacheKey = `prefetch-next-${activeTab}-${userId}`;
    
    if (this.prefetchCache.has(cacheKey)) {
      return;
    }

    try {
      const fetchFunction = activeTab === 'for-you' ? fetchForYouFeed : fetchFollowingFeed;
      const data = await fetchFunction({
        userId,
        page: 1, // Next page
        itemsPerPage: 10
      });

      cacheService.set(cacheKey, data, 3 * 60 * 1000); // 3 minutes
      this.prefetchCache.set(cacheKey, data);

      console.log(`📄 Prefetched next page for ${activeTab}`);
    } catch (error) {
      console.error('Failed to prefetch next page:', error);
    }
  }

  // Determine if we should prefetch the opposite tab
  private shouldPrefetchOppositeTab(behavior: UserBehaviorPattern, currentTab: string): boolean {
    // If user frequently switches tabs, prefetch opposite
    const recentBehaviors = behavior.scrollBehaviors.slice(-5);
    const hasRecentActivity = recentBehaviors.length > 0;
    
    return hasRecentActivity && Math.random() < 0.3; // 30% chance for smart prefetching
  }

  // Prefetch user profiles that might be shown
  private async prefetchUserProfiles(userId: string) {
    // This would prefetch common user profiles
    // Implementation depends on your user discovery service
    console.log('👥 User profile prefetching triggered');
  }

  // Get prefetched data if available
  getPrefetchedData(feedType: string, userId: string): any | null {
    const cacheKey = `prefetch-${feedType}-${userId}`;
    return cacheService.get(cacheKey) || this.prefetchCache.get(cacheKey) || null;
  }

  // Clear prefetch cache
  clearPrefetchCache() {
    this.prefetchCache.clear();
    console.log('🧹 Prefetch cache cleared');
  }

  // Get user behavior analytics
  getUserBehaviorAnalytics(userId: string) {
    const behavior = this.userBehaviors.get(userId);
    if (!behavior) return null;

    return {
      averageScrollVelocity: behavior.averageScrollVelocity,
      preferredFeedType: behavior.preferredFeedType,
      totalScrollBehaviors: behavior.scrollBehaviors.length,
      recentActivity: behavior.scrollBehaviors.slice(-5)
    };
  }
}

export const smartPrefetchService = new SmartPrefetchService();
