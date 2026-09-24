import React from 'react';
import { useParams } from 'react-router-dom';
import { formatSlugAsName } from '@/utils/formatSlug';
import { EntityV4LoadingWrapper } from '@/components/entity/EntityV4LoadingWrapper';

// The single entity page. Legacy v1/v2/v3 were retired in Group 6B; any
// query string (including obsolete ?v= / ?preview=) is left untouched.
const EntityV4 = React.lazy(() => import('@/components/entity-v4/EntityV4'));

const EntityDetail = () => {
  const { slug, parentSlug, childSlug } = useParams<{
    slug?: string;
    parentSlug?: string;
    childSlug?: string;
  }>();

  const displayName = formatSlugAsName(
    parentSlug && childSlug ? childSlug : slug || 'Entity'
  );

  return (
    <React.Suspense fallback={<EntityV4LoadingWrapper entityName={displayName} entityType="product" />}>
      <EntityV4 />
    </React.Suspense>
  );
};

export default EntityDetail;
