// Legacy file - use entityTypeHelpers.ts instead
// This file exports mapEntityTypeToDatabase for backward compatibility

import { EntityType } from '@/services/recommendation/types';
import { mapEntityTypeToString } from '@/hooks/feed/api/types';

/**
 * Maps any EntityType to a database-supported EntityType
 * @deprecated Use entityTypeHelpers.ts functions instead
 */
export const mapEntityTypeToDatabase = (type: EntityType): string => {
  return mapEntityTypeToString(type);
};
