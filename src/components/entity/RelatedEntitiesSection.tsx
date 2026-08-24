import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ImageWithFallback } from '@/components/common/ImageWithFallback';
import { ConnectedRingsRating } from '@/components/ui/connected-rings';
import { ArrowRight } from 'lucide-react';
import { Entity } from '@/services/recommendation/types';
import { EntityStats } from '@/hooks/use-entity-detail-cached';
import type { ChildPresentation } from '@/services/entityRelationshipRegistry';

/**
 * RelatedEntitiesSection — the ONLY overview-surface renderer for a provider's
 * child entities on Entity V4.
 *
 * All labelling comes from `getChildPresentation` (the registry contract):
 * - Registered provider→offering groups use the registry noun ("Products",
 *   "Dishes"). Unregistered children render under a generic "Related" group.
 * - This component NEVER hardcodes a noun — there is no "Products" string here.
 *
 * Card content stays unchanged: name, image, rating (reviews deferred).
 */
interface RelatedEntitiesSectionProps {
  /** Presentation contract from getChildPresentation(providerType, children). */
  presentation: ChildPresentation<Entity>;
  childrenStats?: Record<string, EntityStats>;
  onViewChild: (child: Entity) => void;
  onViewAll: () => void;
}

const MAX_VISIBLE_PER_GROUP = 4;

const viewAllLabel = (groupLabel: string, count: number, registered: boolean) =>
  registered
    ? `View all ${count} ${groupLabel.toLowerCase()}`
    : `View all ${count} items`;

export const RelatedEntitiesSection: React.FC<RelatedEntitiesSectionProps> = ({
  presentation,
  childrenStats,
  onViewChild,
  onViewAll
}) => {
  if (presentation.mode === 'none') return null;

  return (
    <>
      {presentation.groups.map((group) => {
        const visibleChildren = group.children.slice(0, MAX_VISIBLE_PER_GROUP);
        const hasMore = group.children.length > MAX_VISIBLE_PER_GROUP;
        const title = group.registered ? `Featured ${group.label}` : group.label;

        return (
          <Card key={group.type ?? 'related'}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{title}</CardTitle>
              {hasMore && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onViewAll}
                  className="text-brand-orange hover:text-brand-orange/80 hover:bg-brand-orange/10"
                >
                  {viewAllLabel(group.label, group.children.length, group.registered)}
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {visibleChildren.map((child) => {
                  const childStat = childrenStats?.[child.id];
                  const hasRating = childStat?.averageRating != null;

                  return (
                    <div
                      key={child.id}
                      className="border rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer group"
                      onClick={() => onViewChild(child)}
                    >
                      <div className="aspect-square mb-3 rounded-md overflow-hidden bg-gray-100">
                        <ImageWithFallback
                          src={child.image_url || ''}
                          alt={child.name}
                          entityType={child.type}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <h4 className="font-medium text-sm mb-1 line-clamp-2 group-hover:text-brand-orange transition-colors">
                        {child.name}
                      </h4>
                      {hasRating && (
                        <div className="flex items-center gap-1">
                          <ConnectedRingsRating
                            value={childStat.averageRating!}
                            size="xs"
                            showValue
                          />
                          <span className="text-xs text-muted-foreground">
                            ({childStat.reviewCount || 0})
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </>
  );
};
