import type { DatabasePostType } from './postUtils';

export type StructuredFieldsRecord = Record<string, unknown>;

export function isStructuredFieldsRecord(value: unknown): value is StructuredFieldsRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function getValidReviewPostRating(
  postType: DatabasePostType | null | undefined,
  structuredFields: unknown,
): number | null {
  if (postType !== 'review' || !isStructuredFieldsRecord(structuredFields)) return null;

  const rating = structuredFields.rating;
  return typeof rating === 'number' && Number.isFinite(rating) && rating >= 1 && rating <= 5
    ? rating
    : null;
}