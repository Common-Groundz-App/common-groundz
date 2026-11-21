/**
 * Reader-side wording for a saved repeat-intent answer, e.g. "Might buy again".
 * Presentation only: composer questions and stored codes are unchanged.
 * `course` has no repeat intent; unknown types/codes return null.
 */
import { parseEntityType, type CanonicalEntityType } from '@/services/entityType';

const PHRASES: Partial<Record<CanonicalEntityType, string>> = {
  movie: 'watch again',
  book: 'read again',
  tv_show: 'keep watching',
  app: 'keep using',
  game: 'play again',
  experience: 'do again',
  food: 'order again',
  product: 'buy again',
  place: 'visit again',
  brand: 'buy from again',
  event: 'attend again',
  service: 'use again',
  professional: 'work with again',
  others: 'choose again',
};

const PREFIX: Record<string, string> = { yes: 'Would', maybe: 'Might', no: "Wouldn't" };

export function repeatIntentStatement(category: string | null | undefined, value: string | null | undefined): string | null {
  const type = parseEntityType(category);
  const phrase = type ? PHRASES[type] : undefined;
  const prefix = value ? PREFIX[value] : undefined;
  return phrase && prefix ? `${prefix} ${phrase}` : null;
}
