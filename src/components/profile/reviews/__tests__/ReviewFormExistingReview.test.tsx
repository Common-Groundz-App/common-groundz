/**
 * Review Lifecycle Step 1 — the review form never creates a second review for
 * a subject the person already reviewed (Home, Profile and Entity entry points
 * all mount this form).
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ReviewForm from '../ReviewForm';
import type { EntityAdapter } from '@/components/profile/circles/types';

const h = vi.hoisted(() => ({
  lookup: vi.fn(),
  navigate: vi.fn(),
  createReview: vi.fn(),
  nextPick: null as any,
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner-1' } }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }), toast: vi.fn() }));
vi.mock('@/hooks/useAuthPrompt', () => ({ useAuthPrompt: () => ({ requireAuth: () => true }) }));
vi.mock('@/hooks/useSearchFunnel', () => ({ useSearchFunnel: () => ({ log: vi.fn() }) }));
vi.mock('@/services/reviewService', () => ({ createReview: h.createReview, updateReview: vi.fn() }));
vi.mock('@/services/review/ownReview', async () => {
  const actual = await vi.importActual<any>('@/services/review/ownReview');
  return { ...actual, findOwnReviewForEntity: h.lookup };
});
vi.mock('react-router-dom', () => ({ useNavigate: () => h.navigate }));
vi.mock('@/hooks/recommendations/use-recommendation-uploads', () => ({
  useRecommendationUploads: () => ({ handleImageUpload: vi.fn(), isUploading: false }),
}));
vi.mock('@/services/entityHierarchyService', () => ({ getParentEntity: vi.fn().mockResolvedValue(null) }));
vi.mock('@/components/feed/UnifiedEntitySelector', () => ({
  UnifiedEntitySelector: ({ onEntitiesChange }: any) => (
    <button type="button" data-testid="pick-subject" onClick={() => onEntitiesChange([h.nextPick])}>Pick</button>
  ),
}));
vi.mock('../steps/SubjectQuickCreate', () => ({ __esModule: true, default: () => null }));
vi.mock('../steps/StepOne', () => ({
  __esModule: true,
  default: ({ onChange }: any) => <button type="button" onClick={() => onChange(4)}>rate</button>,
}));
vi.mock('../steps/StepThree', () => ({ __esModule: true, default: () => <div data-testid="step-three" /> }));
vi.mock('../steps/StepFour', () => ({ __esModule: true, default: () => <div data-testid="step-four" /> }));

const BOOK: EntityAdapter = { id: 'book-1', name: 'Zero to One', type: 'book' } as EntityAdapter;
const next = () => screen.getByRole('button', { name: /^Next$/ });

async function pickSubject(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText('rate'));
  await user.click(next());
  h.nextPick = BOOK;
  await user.click(screen.getByTestId('pick-subject'));
}

function renderNew() {
  return render(<ReviewForm isOpen onClose={() => {}} onSubmit={async () => {}} />);
}

describe('ReviewForm — one review per subject', () => {
  beforeEach(() => {
    h.lookup.mockReset();
    h.navigate.mockReset();
    h.createReview.mockReset();
  });

  it('blocks Next while the check is pending', async () => {
    h.lookup.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderNew();
    await pickSubject(user);
    expect(next()).toHaveProperty('disabled', true);
    expect(screen.getByText(/Checking whether you've already reviewed this/)).toBeTruthy();
  });

  it('continues normally when not reviewed yet', async () => {
    h.lookup.mockResolvedValue({ status: 'none' });
    const user = userEvent.setup();
    renderNew();
    await pickSubject(user);
    await waitFor(() => expect(next()).toHaveProperty('disabled', false));
    expect(screen.queryByText(/already reviewed this/)).toBeNull();
  });

  it('stops and offers Add an update when already reviewed', async () => {
    h.lookup.mockResolvedValue({ status: 'found', review: { id: 'r1' }, canonicalPath: '/entity/zero-to-one' });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ReviewForm isOpen onClose={onClose} onSubmit={async () => {}} />);
    await pickSubject(user);
    await screen.findByText("You've already reviewed this");
    expect(next()).toHaveProperty('disabled', true);
    await user.click(screen.getByRole('button', { name: 'Add an update' }));
    expect(h.navigate).toHaveBeenCalledWith('/entity/zero-to-one', { state: { openReviewUpdate: { reviewId: 'r1' } } });
    expect(onClose).toHaveBeenCalled();
    expect(h.createReview).not.toHaveBeenCalled();
  });

  it('retries a missing canonical address without navigating to an ID', async () => {
    h.lookup.mockResolvedValueOnce({ status: 'found', review: { id: 'r1' }, canonicalPath: null })
      .mockResolvedValueOnce({ status: 'found', review: { id: 'r1' }, canonicalPath: null })
      .mockResolvedValueOnce({ status: 'found', review: { id: 'r1' }, canonicalPath: '/entity/books/zero-to-one' });
    const user = userEvent.setup();
    renderNew();
    await pickSubject(user);
    await screen.findByText("You've already reviewed this");
    await user.click(screen.getByRole('button', { name: 'Add an update' }));
    await screen.findByText(/couldn't open this update/i);
    expect(h.navigate).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(h.navigate).toHaveBeenCalledWith('/entity/books/zero-to-one', { state: { openReviewUpdate: { reviewId: 'r1' } } });
  });

  it('a failed check blocks and Try again re-checks', async () => {
    h.lookup.mockResolvedValueOnce({ status: 'error' }).mockResolvedValueOnce({ status: 'none' });
    const user = userEvent.setup();
    renderNew();
    await pickSubject(user);
    await screen.findByRole('button', { name: 'Try again' });
    expect(next()).toHaveProperty('disabled', true);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(next()).toHaveProperty('disabled', false));
    expect(h.lookup).toHaveBeenCalledTimes(2);
  });

  it('opened from an entity page checks the locked subject', async () => {
    h.lookup.mockResolvedValue({ status: 'found', review: { id: 'r1' } });
    render(
      <ReviewForm isOpen onClose={() => {}} onSubmit={async () => {}} entity={{ id: 'book-1', name: 'Zero to One', type: 'book' } as any} />,
    );
    await waitFor(() => expect(h.lookup).toHaveBeenCalledWith('book-1', { excludeReviewId: undefined }));
  });

  it('edit mode: switching to an already-reviewed subject is blocked; keeping the subject is not checked', async () => {
    h.lookup.mockResolvedValue({ status: 'found', review: { id: 'other' } });
    const user = userEvent.setup();
    render(
      <ReviewForm
        isOpen
        isEditMode
        onClose={() => {}}
        onSubmit={async () => {}}
        review={{ id: 'r-edit', user_id: 'owner-1', entity_id: 'movie-1', entity: { id: 'movie-1', name: 'M', type: 'movie' }, category: 'movie', rating: 4, title: 'M', metadata: {}, created_at: '2026-01-01T00:00:00Z' } as any}
      />,
    );
    expect(h.lookup).not.toHaveBeenCalled();
    await user.click(next());
    await user.click(screen.getByRole('button', { name: /clear selected subject/i }));
    h.nextPick = BOOK;
    await user.click(screen.getByTestId('pick-subject'));
    await screen.findByText("You've already reviewed this");
    expect(h.lookup).toHaveBeenCalledWith('book-1', { excludeReviewId: 'r-edit' });
  });

  it('a race on this rule recovers to Add an update; other errors stay errors', async () => {
    h.lookup.mockResolvedValueOnce({ status: 'none' }).mockResolvedValueOnce({ status: 'found', review: { id: 'r1' } });
    h.createReview.mockRejectedValueOnce({ code: '23505', message: 'duplicate key value violates unique constraint "reviews_one_per_user_entity"' });
    const user = userEvent.setup();
    renderNew();
    await pickSubject(user);
    await waitFor(() => expect(next()).toHaveProperty('disabled', false));
    await user.click(next());
    await user.click(next());
    await user.click(screen.getByRole('button', { name: /Submit|Publish/ }));
    await screen.findByText("You've already reviewed this");
    expect(h.lookup).toHaveBeenCalledTimes(2);
  });
});
