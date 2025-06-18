
import { enhancedExploreService } from './enhancedExploreService';

class BackgroundService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  // Start background trending score updates
  startTrendingUpdates(intervalMinutes: number = 30) {
    if (this.isRunning) {
      console.log('Background service already running');
      return;
    }

    this.isRunning = true;
    console.log(`Starting background trending updates every ${intervalMinutes} minutes`);

    // Run immediately on start
    this.updateTrendingScores();

    // Then run at intervals
    this.intervalId = setInterval(() => {
      this.updateTrendingScores();
    }, intervalMinutes * 60 * 1000);
  }

  // Stop background updates
  stopTrendingUpdates() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      console.log('Background trending updates stopped');
    }
  }

  private async updateTrendingScores() {
    try {
      console.log('Running background trending score update...');
      const updatedCount = await enhancedExploreService.updateAllTrendingScores();
      console.log(`Background update completed: ${updatedCount} entities updated`);
    } catch (error) {
      console.error('Error in background trending update:', error);
    }
  }

  // Update trending scores manually
  async manualUpdate(): Promise<number> {
    return await enhancedExploreService.updateAllTrendingScores();
  }

  // Check if background service is running
  isActive(): boolean {
    return this.isRunning;
  }
}

export const backgroundService = new BackgroundService();

// Auto-start background service in production
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  // Start trending updates every 30 minutes in production
  backgroundService.startTrendingUpdates(30);
}
