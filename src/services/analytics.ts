/**
 * Basic Analytics Service - Phase 5 MVP Analytics
 * Simple event tracking for recommendation interactions
 */

interface AnalyticsEvent {
  event: string;
  properties: Record<string, any>;
  timestamp: number;
}

class AnalyticsService {
  private events: AnalyticsEvent[] = [];

  /**
   * Track an analytics event
   */
  track(event: string, properties: Record<string, any> = {}) {
    const analyticsEvent: AnalyticsEvent = {
      event,
      properties,
      timestamp: Date.now()
    };

    this.events.push(analyticsEvent);
    
    // Console log for debugging (can be replaced with real analytics later)
    console.log('Analytics Event:', analyticsEvent);
    
    // Keep only last 100 events to prevent memory issues
    if (this.events.length > 100) {
      this.events = this.events.slice(-100);
    }
  }

  /**
   * Track recommendation card click
   */
  trackRecommendationClick(entityId: string, entityName: string, isNetworkRecommendation: boolean, source: 'main' | 'modal') {
    this.track('recommendation_clicked', {
      entityId,
      entityName,
      isNetworkRecommendation,
      source
    });
  }

  /**
   * Track "See All" button click
   */
  trackSeeAllClick(totalRecommendations: number, hasNetworkData: boolean) {
    this.track('see_all_clicked', {
      totalRecommendations,
      hasNetworkData
    });
  }

  /**
   * Track modal open/close
   */
  trackModalInteraction(action: 'open' | 'close', recommendationsCount: number) {
    this.track('recommendations_modal', {
      action,
      recommendationsCount
    });
  }

  /**
   * Get recent events (for debugging)
   */
  getRecentEvents(limit: number = 10): AnalyticsEvent[] {
    return this.events.slice(-limit);
  }
}

// Export singleton instance
export const analytics = new AnalyticsService();
