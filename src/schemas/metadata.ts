import { z } from 'zod';

// Stored photo URL schema
export const StoredPhotoUrlSchema = z.object({
  reference: z.string(),
  storedUrl: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  uploadedAt: z.string().datetime().optional()
});

// Google Places metadata schema
export const GooglePlacesMetadataSchema = z.object({
  place_id: z.string(),
  photo_reference: z.string().optional(),
  photo_references: z.array(z.object({
    photo_reference: z.string(),
    width: z.number().int().positive(),
    height: z.number().int().positive()
  })).optional(),
  stored_photo_urls: z.array(StoredPhotoUrlSchema).optional(),
  location: z.object({
    lat: z.number(),
    lng: z.number()
  }).optional(),
  last_refreshed_at: z.string().datetime().optional()
});

// Validate stored photos before using
export function validateStoredPhotos(data: unknown): z.infer<typeof StoredPhotoUrlSchema>[] | null {
  try {
    return z.array(StoredPhotoUrlSchema).parse(data);
  } catch (error) {
    console.error('Invalid stored_photo_urls format:', error);
    return null;
  }
}
