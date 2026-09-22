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
import { parseEntityType, type CanonicalEntityType } from '@/services/entityType';

const ENTITY_FALLBACK_ICONS: Record<CanonicalEntityType, LucideIcon> = {
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

const LEGACY_PLACEHOLDER_PATHS = new Set([
  '/photo-1465146344425-f00d5f5c8f07',
  '/photo-1460661419201-fd4cecdf8a8b',
  '/photo-1485846234645-a62644f84728',
  '/photo-1488646953014-85cb44e25828',
  '/photo-1489599849927-2ee91cede3ba',
  '/photo-1489599510961-b3f9db2a06be',
  '/photo-1492684223066-81342ee5ff30',
  '/photo-1495446815901-a7297e633e8d',
  '/photo-1495195134817-aeb325a55b65',
  '/photo-1501554728187-ce583db33af7',
  '/photo-1501854140801-50d01698950b',
  '/photo-1504674900247-0877df9cc836',
  '/photo-1505740420928-5e560c06d30e',
  '/photo-1506905925346-21bda4d32df4',
  '/photo-1507679799987-c73779587ccf',
  '/photo-1511367461989-f85a21fda167',
  '/photo-1511512578047-dfb367046420',
  '/photo-1511671782779-c97d3d27a1d4',
  '/photo-1512941937669-90a1b58e7e9c',
  '/photo-1517248135467-4c7edcad34c4',
  '/photo-1523050854058-8df90110c9f1',
  '/photo-1523275335684-37898b6baf30',
  '/photo-1526401485004-46910ecc8e51',
  '/photo-1544716278-ca5e3f4abd8c',
  '/photo-1543002588-bfa74002ed7e',
  '/photo-1551024709-8f23befc6f87',
  '/photo-1555939594-58d7698950b',
  '/photo-1556761175-b413da4baf72',
  '/photo-1560769629-975ec94e6a86',
  '/photo-1567620905732-2d1ec7ab7445',
  '/photo-1593359677879-a4bb92f829d1',
]);

export const getEntityFallbackIcon = (type: unknown): LucideIcon => {
  const canonicalType = parseEntityType(type);
  return canonicalType ? ENTITY_FALLBACK_ICONS[canonicalType] : Tag;
};

export const isKnownLegacyEntityPlaceholderUrl = (value: unknown): boolean => {
  if (typeof value !== 'string' || value.trim() === '') return false;

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'images.unsplash.com') return false;
    return LEGACY_PLACEHOLDER_PATHS.has(url.pathname.replace(/\/$/, ''));
  } catch {
    return false;
  }
};

export const getPersistableEntityImageUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || isKnownLegacyEntityPlaceholderUrl(trimmed)) return null;
  return trimmed;
};