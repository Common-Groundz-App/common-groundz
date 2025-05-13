
import { Review } from '@/services/reviewService';

export interface ReviewOptimisticUpdateProps {
  id: string;
  isLiked?: boolean;
  likes?: number;
  isSaved?: boolean;
}

// Re-export the types from the parent directory
export * from '../types';
