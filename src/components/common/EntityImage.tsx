import React, { useMemo, useState } from 'react';
import {
  AppWindow,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Clapperboard,
  Gamepad2,
  GraduationCap,
  MapPin,
  Package,
  Sparkles,
  Tag,
  Tv,
  Utensils,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Entity } from '@/services/recommendation/types';
import {
  parseEntityType,
  type CanonicalEntityType,
} from '@/services/entityType';
import { getOptimalEntityImageUrl } from '@/utils/entityImageUtils';

const FALLBACK_ICONS: Record<CanonicalEntityType, LucideIcon> = {
  movie: Clapperboard,
  book: BookOpen,
  tv_show: Tv,
  course: GraduationCap,
  app: AppWindow,
  game: Gamepad2,
  experience: Sparkles,
  food: Utensils,
  product: Package,
  place: MapPin,
  brand: Building2,
  event: CalendarDays,
  service: Wrench,
  professional: BriefcaseBusiness,
  others: Tag,
};

const getEntityFallbackIcon = (type: unknown): LucideIcon => {
  const canonicalType = parseEntityType(type);
  return canonicalType ? FALLBACK_ICONS[canonicalType] : Tag;
};

interface EntityImageProps {
  entity: Entity;
  className?: string;
  fallbackClassName?: string;
  decorative?: boolean;
}

export const EntityImage: React.FC<EntityImageProps> = ({
  entity,
  className,
  fallbackClassName,
  decorative = false,
}) => {
  const imageUrl = useMemo(() => getOptimalEntityImageUrl(entity), [entity]);
  const sourceKey = `${entity.id}:${imageUrl ?? ''}`;
  const [failedSourceKey, setFailedSourceKey] = useState<string | null>(null);
  const FallbackIcon = getEntityFallbackIcon(entity.type);
  const showFallback = !imageUrl || failedSourceKey === sourceKey;
  const accessibleLabel = decorative ? undefined : entity.name;

  if (showFallback) {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground',
          className,
          fallbackClassName,
        )}
        role={decorative ? undefined : 'img'}
        aria-label={accessibleLabel}
        aria-hidden={decorative ? true : undefined}
        data-testid="entity-image-fallback"
      >
        <FallbackIcon className="h-1/2 w-1/2" aria-hidden="true" />
      </span>
    );
  }

  return (
    <img
      key={sourceKey}
      src={imageUrl}
      alt={decorative ? '' : entity.name}
      className={cn('shrink-0 rounded-full object-cover', className)}
      onError={() => setFailedSourceKey(sourceKey)}
      data-testid="entity-image"
    />
  );
};