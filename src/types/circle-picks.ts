
export interface CirclePicksItem {
  id: string;
  type: 'recommendation' | 'review' | 'post';
  title: string;
  content?: string;
  rating?: number;
  category: string;
  imageUrl?: string;
  entityName?: string;
  entityType?: string;
  createdAt: string;
  updatedAt: string;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  isSaved: boolean;
  author: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl?: string;
  };
  entity?: {
    id: string;
    name: string;
    type: string;
    slug: string;
    imageUrl?: string;
  };
}

export interface CirclePicksFilters {
  category: string;
  sortBy: 'newest' | 'oldest' | 'highest-rated' | 'most-liked';
}

export interface FollowedUser {
  id: string;
  username: string;
  fullName: string;
  avatarUrl?: string;
  followedAt: string;
}
