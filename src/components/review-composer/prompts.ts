/**
 * Phase 2 wording contract for the new review composer only.
 * Presentation copy; keyed by the resolved questionnaire key.
 */
import type { QuestionnaireConfig } from '@/components/profile/reviews/questionnaire/registry';

export interface ThoughtsPrompt {
  label: string;
  placeholder: string;
}

export const THOUGHTS_PROMPTS: Record<QuestionnaireConfig['key'], ThoughtsPrompt> = {
  movie: { label: 'What did you think?', placeholder: 'What did you enjoy or dislike? Anything that stood out?' },
  tv_show: { label: 'What did you think?', placeholder: "What kept you watching, or what didn't work for you?" },
  book: { label: 'How was the read?', placeholder: 'What stood out to you? Anything people should know?' },
  food: { label: 'How was it?', placeholder: 'How was the taste, quality, or portion? Anything worth knowing?' },
  place: { label: 'How was your visit?', placeholder: 'What was your experience like? Any tips for someone visiting?' },
  product: { label: 'How was it in real use?', placeholder: "What worked well, what didn't, and what should someone know before buying?" },
  app: { label: 'How was the app?', placeholder: 'What do you use it for? What works well or gets frustrating?' },
  game: { label: 'How was the game?', placeholder: 'What did you enjoy? Anything that could have been better?' },
  course: { label: 'How was the course?', placeholder: 'What did you learn? What worked well or could have been better?' },
  service: { label: 'How was the service?', placeholder: 'How was your experience? Did it meet your expectations?' },
  professional: { label: 'How was your experience?', placeholder: 'What stood out about working with them?' },
  brand: { label: 'How was your experience?', placeholder: 'What has your experience with this brand been like?' },
  event: { label: 'How was the event?', placeholder: 'What stood out? Anything people should know before attending?' },
  experience: { label: 'How was the experience?', placeholder: 'What made it memorable? Anything others should know?' },
  others: { label: 'What did you think?', placeholder: 'Share your experience and anything worth knowing.' },
  legacy_unlinked: { label: 'What did you think?', placeholder: 'Share your experience and anything worth knowing.' },
};

export const thoughtsPromptFor = (key: QuestionnaireConfig['key'] | null | undefined): ThoughtsPrompt =>
  (key && THOUGHTS_PROMPTS[key]) || THOUGHTS_PROMPTS.others;

/** Secondary feedback under Connected Rings, whole-number ratings 0–5. */
export function neutralRatingFeedback(rating: number): string {
  switch (Math.round(rating)) {
    case 1: return "What didn't work for you?";
    case 2: return 'What could have been better?';
    case 3: return "What worked, and what didn't?";
    case 4: return 'What did you like about it?';
    case 5: return 'What made it stand out?';
    default: return 'Tap the rings to share your rating.';
  }
}
