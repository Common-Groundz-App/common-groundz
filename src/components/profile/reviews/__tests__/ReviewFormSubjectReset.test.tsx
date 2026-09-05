/**
 * Phase 3D acceptance case 7 — behaviour layer.
 *
 * Replacing a review's subject with a DIFFERENT entity of the SAME canonical
 * type must clear subject-specific answers (choice chips, curated tags, food
 * tags), because questionnaire answers describe the exact reviewed subject,
 * not merely its type. Re-selecting the IDENTICAL entity id must clear
 * nothing. The rule is per-subject-id, exercised here through the real
 * ReviewForm UI: SubjectSelectStep → handleSubjectChange →
 * resetQuestionnaireAnswers → StepThree.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import ReviewForm from '../ReviewForm';
import type { EntityAdapter } from '@/components/profile/circles/types';

/**
 * Shared mutable refs for the mocked pickers — vi.mock factories are hoisted,
 * so per-test entities flow through this hoisted holder.
 */
const pickers = vi.hoisted(() => ({
  /** Entity the mocked UnifiedEntitySelector "picks" next. */
  nextPick: null as EntityAdapter | null,
  /** Entity the mocked SubjectQuickCreate "creates" next. */
  nextCreate: null as EntityAdapter | null,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'owner-1' } }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/hooks/useAuthPrompt', () => ({
  useAuthPrompt: () => ({ requireAuth: (fn: () => void) => fn() }),
}));

vi.mock('@/services/reviewService', () => ({
  createReview: vi.fn(),
  updateReview: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/hooks/recommendations/use-recommendation-uploads', () => ({
  useRecommendationUploads: () => ({
    handleImageUpload: vi.fn(),
    isUploading: false,
  }),
}));

vi.mock('@/hooks/useSearchFunnel', () => ({
  useSearchFunnel: () => ({ log: vi.fn() }),
}));

vi.mock('@/services/entityHierarchyService', () => ({
  getParentEntity: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/components/feed/UnifiedEntitySelector', () => ({
  UnifiedEntitySelector: ({
    onEntitiesChange,
  }: {
    onEntitiesChange: (entities: EntityAdapter[]) => void;
  }) => (
    <button
      data-testid="pick-subject"
      onClick={() => pickers.nextPick && onEntitiesChange([pickers.nextPick])}
    >
      Pick subject
    </button>
  ),
}));

vi.mock('../steps/SubjectQuickCreate', () => ({
  __esModule: true,
  default: ({ onCreated }: { onCreated: (entity: EntityAdapter) => void }) => (
    <button
      data-testid="quick-create"
      onClick={() => pickers.nextCreate && onCreated(pickers.nextCreate)}
    >
      Quick create
    </button>
  ),
}));

// Keep the real SubjectSelectStep and StepThree (the components under test);
// stub the steps that only add rendering weight.
vi.mock('../steps/StepOne', () => ({
  __esModule: true,
  default: () => <div data-testid="step-one" />,
}));

vi.mock('../steps/StepFour', () => ({
  __esModule: true,
  default: () => <div data-testid="step-four" />,
}));

vi.mock('@/components/media/MediaUploader', () => ({
  MediaUploader: () => <div data-testid="media-uploader" />,
}));

vi.mock('../FoodTagSelector', () => ({
  __esModule: true,
  default: ({ selected }: { selected: string[] }) => (
    <div data-testid="food-tags">{selected.join(',')}</div>
  ),
}));

const PRODUCT_A: EntityAdapter = { id: 'prod-a', name: 'Kettle One', type: 'product' };
const PRODUCT_B: EntityAdapter = { id: 'prod-b', name: 'Kettle Two', type: 'product' };
const FOOD_A: EntityAdapter = { id: 'food-a', name: 'Ramen A', type: 'food' };
const FOOD_B: EntityAdapter = { id: 'food-b', name: 'Ramen B', type: 'food' };

function editReviewFor(entity: EntityAdapter, metadata: Record<string, unknown>) {
  return {
    id: `review-${entity.id}`,
    user_id: 'owner-1',
    entity_id: entity.id,
    entity: { id: entity.id, name: entity.name, type: entity.type },
    category: entity.type,
    rating: 4,
    title: entity.name,
    metadata,
    created_at: '2026-01-01T00:00:00Z',
  } as any;
}

const pressedCount = () =>
  document.querySelectorAll('[aria-pressed="true"]').length;

async function goToStep(user: ReturnType<typeof userEvent.setup>, step: number) {
  // Steps are 1-indexed; click "Continue"/"Next" forward or "Back" backward.
  for (let guard = 0; guard < 8; guard++) {
    const indicator = screen.queryByText(new RegExp(`Step ${step} of 4`));
    if (indicator) return;
    const back = screen.queryByRole('button', { name: /back/i });
    const current = screen.getByText(/Step \d of 4/).textContent ?? '';
    const currentStep = Number(current.match(/Step (\d)/)?.[1]);
    if (currentStep < step) {
      const nexts = screen
        .getAllByRole('button')
        .filter((b) => b.closest('.grid') && b !== back && !b.disabled);
      await user.click(nexts[nexts.length - 1]);
    } else {
      await user.click(back!);
    }
  }
  throw new Error(`could not reach step ${step}`);
}

function renderForm(review: ReturnType<typeof editReviewFor>) {
  return render(
    <ReviewForm
      isOpen
      onClose={() => {}}
      onSubmit={async () => {}}
      review={review}
      isEditMode
    />,
  );
}

describe('same-type subject replacement resets subject-specific answers', () => {
  beforeEach(() => {
    pickers.nextPick = null;
    pickers.nextCreate = null;
  });

  it('product → different product clears the questionnaire choices', async () => {
    const user = userEvent.setup();
    renderForm(
      editReviewFor(PRODUCT_A, {
        questionnaire: {
          version: 1,
          type: 'product',
          answers: { would_recommend: 'yes', repeat_intent: 'yes', value: 'great' },
        },
      }),
    );

    await goToStep(user, 3);
    await waitFor(() => expect(pressedCount()).toBeGreaterThan(0));
    const answeredBefore = pressedCount();

    await goToStep(user, 2);
    await user.click(screen.getByRole('button', { name: /clear selected subject/i }));
    pickers.nextPick = PRODUCT_B;
    await user.click(screen.getByTestId('pick-subject'));
    expect(screen.getByText('Kettle Two')).toBeTruthy();

    await goToStep(user, 3);
    await waitFor(() => expect(pressedCount()).toBe(0));
    expect(answeredBefore).toBeGreaterThan(0);
  });

  it('product → identical product id clears nothing', async () => {
    const user = userEvent.setup();
    renderForm(
      editReviewFor(PRODUCT_A, {
        questionnaire: {
          version: 1,
          type: 'product',
          answers: { would_recommend: 'yes', repeat_intent: 'yes', value: 'great' },
        },
      }),
    );

    await goToStep(user, 3);
    await waitFor(() => expect(pressedCount()).toBeGreaterThan(0));
    const answeredBefore = pressedCount();

    // Re-select the SAME entity id through the quick-create callback — this
    // reaches handleSubjectChange without clearing the subject first.
    await goToStep(user, 2);
    pickers.nextCreate = { ...PRODUCT_A };
    await user.click(screen.getByTestId('quick-create'));

    await goToStep(user, 3);
    await waitFor(() => expect(pressedCount()).toBe(answeredBefore));
  });

  it('food → different food clears choices AND food tags', async () => {
    const user = userEvent.setup();
    renderForm(
      editReviewFor(FOOD_A, {
        food_tags: ['spicy'],
        questionnaire: {
          version: 1,
          type: 'food',
          answers: { would_recommend: 'yes', repeat_intent: 'yes', portion: 'generous' },
        },
      }),
    );

    await goToStep(user, 3);
    await waitFor(() => expect(pressedCount()).toBeGreaterThan(0));
    expect(screen.getByTestId('food-tags').textContent).toBe('spicy');

    await goToStep(user, 2);
    await user.click(screen.getByRole('button', { name: /clear selected subject/i }));
    pickers.nextPick = FOOD_B;
    await user.click(screen.getByTestId('pick-subject'));

    await goToStep(user, 3);
    await waitFor(() => {
      expect(pressedCount()).toBe(0);
      expect(screen.getByTestId('food-tags').textContent).toBe('');
    });
  });

  it('food → identical food id keeps choices and food tags', async () => {
    const user = userEvent.setup();
    renderForm(
      editReviewFor(FOOD_A, {
        food_tags: ['spicy'],
        questionnaire: {
          version: 1,
          type: 'food',
          answers: { would_recommend: 'yes', repeat_intent: 'yes', portion: 'generous' },
        },
      }),
    );

    await goToStep(user, 3);
    await waitFor(() => expect(pressedCount()).toBeGreaterThan(0));

    await goToStep(user, 2);
    pickers.nextCreate = { ...FOOD_A };
    await user.click(screen.getByTestId('quick-create'));

    await goToStep(user, 3);
    await waitFor(() => {
      expect(pressedCount()).toBeGreaterThan(0);
      expect(screen.getByTestId('food-tags').textContent).toBe('spicy');
    });
  });
});
