/**
 * Phase 3D acceptance case 7 — behaviour layer.
 *
 * Replacing a review's subject with a DIFFERENT entity of the SAME canonical
 * type must clear the subject-specific answers (choice chips, curated tags,
 * food tags), because questionnaire answers describe the exact reviewed
 * subject, not merely its type. Re-selecting the IDENTICAL entity id must
 * clear nothing.
 *
 * The rule is exercised through the real ReviewForm state machine
 * (SubjectSelectStep -> handleSubjectChange -> resetQuestionnaireAnswers), and
 * observed where the answers actually render: Step Four. StepFour is replaced
 * by a probe that serialises the `answers` object it receives, so the
 * assertions read the form's own live questionnaire state rather than styling.
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
  toast: vi.fn(),
}));

vi.mock('@/hooks/useAuthPrompt', () => ({
  useAuthPrompt: () => ({ requireAuth: (fn: () => void) => fn() }),
}));

vi.mock('@/hooks/useSearchFunnel', () => ({
  useSearchFunnel: () => ({ log: vi.fn() }),
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
      type="button"
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
      type="button"
      data-testid="quick-create"
      onClick={() => pickers.nextCreate && onCreated(pickers.nextCreate)}
    >
      Quick create
    </button>
  ),
}));

// Steps 1 and 3 only add rendering weight for this rule; Step 4 becomes the
// probe that exposes the live questionnaire answers.
vi.mock('../steps/StepOne', () => ({
  __esModule: true,
  default: () => <div data-testid="step-one" />,
}));

vi.mock('../steps/StepThree', () => ({
  __esModule: true,
  default: () => <div data-testid="step-three" />,
}));

vi.mock('../steps/StepFour', () => ({
  __esModule: true,
  default: ({ answers }: { answers: unknown }) => (
    <pre data-testid="answers-probe">{JSON.stringify(answers)}</pre>
  ),
}));

const PRODUCT_A: EntityAdapter = { id: 'prod-a', name: 'Kettle One', type: 'product' } as EntityAdapter;
const PRODUCT_B: EntityAdapter = { id: 'prod-b', name: 'Kettle Two', type: 'product' } as EntityAdapter;
const FOOD_A: EntityAdapter = { id: 'food-a', name: 'Ramen A', type: 'food' } as EntityAdapter;
const FOOD_B: EntityAdapter = { id: 'food-b', name: 'Ramen B', type: 'food' } as EntityAdapter;

function editReviewFor(entity: EntityAdapter, metadata: Record<string, unknown>) {
  return {
    id: `review-${entity.id}`,
    user_id: 'owner-1',
    entity_id: entity.id,
    entity: { id: entity.id, name: entity.name, type: entity.type },
    category: entity.type,
    rating: 4,
    title: entity.name,
    subtitle: entity.name,
    description: 'Stored description',
    metadata,
    created_at: '2026-01-01T00:00:00Z',
  } as any;
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

/** Current step number, read from the navigation indicator. */
const currentStep = () =>
  Number(screen.getByText(/Step \d of 4/).textContent?.match(/Step (\d)/)?.[1]);

async function goToStep(user: ReturnType<typeof userEvent.setup>, target: number) {
  for (let guard = 0; guard < 8 && currentStep() !== target; guard++) {
    const name = currentStep() < target ? /^Next$/ : /^Back$/;
    await user.click(screen.getByRole('button', { name }));
  }
  expect(currentStep()).toBe(target);
}

/** The live questionnaire answers as Step Four receives them. */
async function readAnswers() {
  const probe = await screen.findByTestId('answers-probe');
  return JSON.parse(probe.textContent || '{}') as {
    choices?: Record<string, string>;
    curated?: Record<string, string[]>;
    tags?: Record<string, string[]>;
  };
}

const productMetadata = {
  provenance: { source: 'import-2024' },
  questionnaire: {
    version: 1,
    type: 'product',
    answers: { would_recommend: 'yes', repeat_intent: 'yes' },
  },
};

const foodMetadata = {
  provenance: { source: 'import-2024' },
  food_tags: ['spicy', 'shareable'],
  questionnaire: {
    version: 1,
    type: 'food',
    answers: { would_recommend: 'yes', portion: 'generous' },
  },
};

describe('same-type subject replacement clears subject-specific answers', () => {
  beforeEach(() => {
    pickers.nextPick = null;
    pickers.nextCreate = null;
  });

  it('product -> a different product clears the stored choice answers', async () => {
    const user = userEvent.setup();
    renderForm(editReviewFor(PRODUCT_A, productMetadata));

    await goToStep(user, 4);
    const before = await readAnswers();
    expect(Object.keys(before.choices ?? {}).length).toBeGreaterThan(0);

    await goToStep(user, 2);
    await user.click(screen.getByRole('button', { name: /clear selected subject/i }));
    pickers.nextPick = PRODUCT_B;
    await user.click(screen.getByTestId('pick-subject'));
    expect(screen.getByText('Kettle Two')).toBeTruthy();

    await goToStep(user, 4);
    await waitFor(async () => {
      const after = await readAnswers();
      expect(after.choices ?? {}).toEqual({});
      expect(after.curated ?? {}).toEqual({});
    });
  });

  it('product -> the identical product id clears nothing', async () => {
    const user = userEvent.setup();
    renderForm(editReviewFor(PRODUCT_A, productMetadata));

    await goToStep(user, 4);
    const before = await readAnswers();

    // Re-select the SAME id without clearing first, so handleSubjectChange
    // runs with an unchanged entity_id.
    await goToStep(user, 2);
    pickers.nextCreate = { ...PRODUCT_A };
    await user.click(screen.getByTestId('quick-create'));

    await goToStep(user, 4);
    expect(await readAnswers()).toEqual(before);
  });

  it('food -> a different food clears the choice answers and the food tags', async () => {
    const user = userEvent.setup();
    renderForm(editReviewFor(FOOD_A, foodMetadata));

    await goToStep(user, 4);
    const before = await readAnswers();
    expect(Object.keys(before.choices ?? {}).length).toBeGreaterThan(0);
    expect(before.tags?.food_tags).toEqual(['spicy', 'shareable']);

    await goToStep(user, 2);
    await user.click(screen.getByRole('button', { name: /clear selected subject/i }));
    pickers.nextPick = FOOD_B;
    await user.click(screen.getByTestId('pick-subject'));

    await goToStep(user, 4);
    await waitFor(async () => {
      const after = await readAnswers();
      expect(after.choices ?? {}).toEqual({});
      expect(after.tags?.food_tags).toEqual([]);
    });
  });

  it('food -> the identical food id keeps the answers and the food tags', async () => {
    const user = userEvent.setup();
    renderForm(editReviewFor(FOOD_A, foodMetadata));

    await goToStep(user, 4);
    const before = await readAnswers();

    await goToStep(user, 2);
    pickers.nextCreate = { ...FOOD_A };
    await user.click(screen.getByTestId('quick-create'));

    await goToStep(user, 4);
    const after = await readAnswers();
    expect(after).toEqual(before);
    expect(after.tags?.food_tags).toEqual(['spicy', 'shareable']);
  });
});
