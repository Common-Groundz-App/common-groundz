import React from 'react';
import { Helmet } from 'react-helmet-async';
import { LEGAL_CONFIG } from '@/config/legalConfig';
import { getCanonicalType } from '@/services/entityTypeHelpers';
import { EntityType } from '@/services/recommendation/types';

interface EntityStructuredDataProps {
  entity: {
    name: string;
    description?: string | null;
    image_url?: string | null;
    slug?: string | null;
    type: EntityType | string;
  };
  stats: {
    averageRating: number | null;
    reviewCount: number;
  } | null;
}

const SCHEMA_TYPE_MAP: Record<string, string> = {
  book: 'Book',
  movie: 'Movie',
  tv_show: 'TVSeries',
  place: 'LocalBusiness',
  food: 'Restaurant',
  product: 'Product',
  course: 'Course',
  app: 'SoftwareApplication',
  game: 'VideoGame',
  experience: 'TouristAttraction',
  brand: 'Organization',
  event: 'Event',
  service: 'Service',
  professional: 'Person',
};

const EntityStructuredData: React.FC<EntityStructuredDataProps> = ({ entity, stats }) => {
  if (!entity.name || !entity.slug) return null;

  const baseUrl = LEGAL_CONFIG.websiteUrl;
  const entityUrl = `${baseUrl}/entity/${entity.slug}`;
  const canonicalType = getCanonicalType(entity.type);
  const schemaType = SCHEMA_TYPE_MAP[canonicalType] || 'Thing';

  // Build entity JSON-LD with conditional fields
  const entityJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    '@id': `${entityUrl}#entity`,
    name: entity.name,
    url: entityUrl,
    inLanguage: 'en',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': entityUrl,
    },
    potentialAction: {
      '@type': 'ViewAction',
      target: entityUrl,
    },
  };

  if (entity.description) {
    entityJsonLd.description = entity.description;
  }

  if (entity.image_url) {
    entityJsonLd.image = entity.image_url;
  }

  // Public aggregate ratings only. Circle-only ratings are auth-gated and NOT included.
  if (stats && stats.reviewCount > 0 && stats.averageRating != null) {
    entityJsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: stats.averageRating,
      reviewCount: stats.reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${baseUrl}/` },
      { '@type': 'ListItem', position: 2, name: entity.name },
    ],
  };

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(entityJsonLd)}</script>
      <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
    </Helmet>
  );
};

export default EntityStructuredData;
