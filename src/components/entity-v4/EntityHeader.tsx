
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Star, Users, TrendingUp, ChevronRight } from "lucide-react";
import { Entity } from '@/services/recommendation/types';
import { SafeUserProfile } from '@/types/profile';
import { EntityStats } from '@/hooks/use-entity-detail-cached';
import { EntityActions } from './EntityActions';

interface EntityHeaderProps {
  entity: Entity;
  parentEntity: Entity | null;
  hierarchyLoading: boolean;
  entityImage: string;
  stats: EntityStats | null;
  user: SafeUserProfile | null;
  circleRating: number | null;
  circleRatingCount: number;
  circleContributors: any[];
  isSaved: boolean;
  isSaveLoading: boolean;
  onShare: () => Promise<void>;
  onToggleSave: () => Promise<void>;
  onRecommendationModalOpen: () => void;
  onSidebarAction: () => void;
  sidebarButtonConfig: {
    text: string;
    icon: React.ComponentType<any>;
    action: () => void;
    tooltip: string | null;
  };
}

export const EntityHeader: React.FC<EntityHeaderProps> = ({
  entity,
  parentEntity,
  hierarchyLoading,
  entityImage,
  stats,
  user,
  circleRating,
  circleRatingCount,
  circleContributors,
  isSaved,
  isSaveLoading,
  onShare,
  onToggleSave,
  onRecommendationModalOpen,
  onSidebarAction,
  sidebarButtonConfig
}) => {
  return (
    <>
      {/* Hero Section */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Entity Image */}
            <div className="w-full md:w-1/3 lg:w-1/4">
              <div className="aspect-[4/3] rounded-lg overflow-hidden bg-gray-100">
                <img 
                  src={entityImage} 
                  alt={entity.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            
            {/* Entity Details */}
            <div className="flex-1">
              {/* Breadcrumb */}
              {parentEntity && (
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                  <span className="hover:text-blue-600 cursor-pointer">{parentEntity.name}</span>
                  <ChevronRight className="w-4 h-4" />
                  <span>{entity.name}</span>
                </div>
              )}

              {/* Title and Type */}
              <div className="mb-4">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{entity.name}</h1>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="secondary">{entity.type}</Badge>
                  {entity.venue && <Badge variant="outline">{entity.venue}</Badge>}
                </div>
              </div>

              {/* Description */}
              {entity.description && (
                <p className="text-gray-600 mb-6 leading-relaxed">{entity.description}</p>
              )}

              {/* Action Buttons */}
              <EntityActions
                entity={entity}
                user={user}
                isSaved={isSaved}
                isSaveLoading={isSaveLoading}
                onShare={onShare}
                onToggleSave={onToggleSave}
                onRecommendationModalOpen={onRecommendationModalOpen}
                onSidebarAction={onSidebarAction}
                sidebarButtonConfig={sidebarButtonConfig}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-white border-b py-4">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center">
            {/* Circle Rating */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
                {circleRating ? circleRating.toFixed(1) : '?'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">Circle Rating</h3>
                  <Badge variant="outline" className="text-xs">
                    {circleRatingCount} {circleRatingCount === 1 ? 'rating' : 'ratings'}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">
                  From people you trust • {circleContributors.length} contributors
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-8">
              <div className="text-center">
                <div className="flex items-center gap-1 justify-center mb-1">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span className="font-semibold text-lg">
                    {stats?.averageRating?.toFixed(1) || 'N/A'}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {stats?.reviewCount || 0} reviews
                </p>
              </div>

              <div className="text-center">
                <div className="flex items-center gap-1 justify-center mb-1">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="font-semibold text-lg">
                    {stats?.recommendationCount || 0}
                  </span>
                </div>
                <p className="text-xs text-gray-500">recommendations</p>
              </div>

              <div className="text-center">
                <div className="flex items-center gap-1 justify-center mb-1">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span className="font-semibold text-lg">
                    {Math.floor(Math.random() * 1000) + 100}
                  </span>
                </div>
                <p className="text-xs text-gray-500">followers</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
