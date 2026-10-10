import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ReviewOwnerMenu } from './ReviewOwnerMenu';
import { useIsMobile } from '@/hooks/use-mobile';

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: vi.fn(() => false) }));
vi.mock('@/hooks/useReviewComposerNavigate', () => ({
  useReviewComposerNavigate: () => ({ open: (_a: unknown, legacy: () => void) => legacy(), isPending: false }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'owner-1' } }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/services/review/core', () => ({
  deleteReviewThread: vi.fn(),
}));

vi.mock('@/services/review/reviewChangeEvents', () => ({
  notifyReviewsChanged: vi.fn(),
}));

vi.mock('@/components/profile/reviews/ReviewForm', () => ({
  default: () => null,
}));

const NOW = new Date('2026-10-03T12:00:00Z');

function renderMenu(createdAt: string, options?: { isAdmin?: boolean; onEdit?: () => void }) {
  render(
    <ReviewOwnerMenu
      review={{ id: 'review-1', user_id: 'owner-1', created_at: createdAt }}
      isAdmin={options?.isAdmin}
      onEdit={options?.onEdit ?? vi.fn()}
    />,
  );
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Review options' }));
}

describe('ReviewOwnerMenu edit-window presentation', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
    vi.mocked(useIsMobile).mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps owner Edit enabled inside the hour and explains the window', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    renderMenu('2026-10-03T11:00:01Z', { onEdit });
    await openMenu(user);

    const edit = screen.getByRole('menuitem', { name: 'Edit' });
    await user.hover(edit);
    expect((await screen.findAllByText('You can edit for 1 hour after publishing.')).length).toBeGreaterThan(0);

    await user.click(edit);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('portals the enabled explanation outside the clipped menu', async () => {
    const user = userEvent.setup();
    renderMenu('2026-10-03T11:00:01Z');
    await openMenu(user);
    await user.hover(screen.getByRole('menuitem', { name: 'Edit' }));

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('You can edit for 1 hour after publishing.');
    const content = document.querySelector('[class*="radix-tooltip-content-available-width"]');
    expect(content).toBeInTheDocument();
    expect(content?.closest('[role="menu"]')).toBeNull();
    expect(content).toHaveAttribute('data-side', 'left');
  });

  it('wraps the enabled explanation beside Edit on a phone', async () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    const user = userEvent.setup();
    renderMenu('2026-10-03T11:00:01Z');
    await openMenu(user);
    await user.hover(screen.getByRole('menuitem', { name: 'Edit' }));

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('You can edit for 1 hour after publishing.');
    const content = document.querySelector('[class*="radix-tooltip-content-available-width"]');
    expect(content).toHaveClass('w-40', 'whitespace-normal');
    expect(content).toHaveAttribute('data-side', 'left');
  });

  it('keeps the expired explanation beside Edit and the menu open on a phone', async () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    const user = userEvent.setup();
    renderMenu('2026-10-03T11:00:00Z');
    await openMenu(user);
    const edit = screen.getByRole('menuitem', { name: 'Edit' });
    await user.hover(edit);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Edit window closed (1 hour limit)');
    expect(document.querySelector('[class*="radix-tooltip-content-available-width"]')).toHaveAttribute('data-side', 'left');
    await user.click(edit);
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('keeps owner Edit visible but inert at the exact one-hour boundary', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    renderMenu('2026-10-03T11:00:00Z', { onEdit });
    await openMenu(user);

    const edit = screen.getByRole('menuitem', { name: 'Edit' });
    expect(edit).toHaveClass('cursor-not-allowed');
    await user.hover(edit);
    expect((await screen.findAllByText('Edit window closed (1 hour limit)')).length).toBeGreaterThan(0);

    await user.click(edit);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('keeps the admin bypass enabled without owner-only one-hour copy', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    renderMenu('2026-10-03T10:00:00Z', { isAdmin: true, onEdit });
    await openMenu(user);

    const edit = screen.getByRole('menuitem', { name: 'Edit' });
    expect(edit).not.toHaveClass('cursor-not-allowed');
    expect(screen.queryByText(/1 hour/)).not.toBeInTheDocument();

    await user.click(edit);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("gives an admin only moderation removal on someone else's review", async () => {
    const user = userEvent.setup();
    render(
      <ReviewOwnerMenu
        review={{ id: 'review-2', user_id: 'someone-else', created_at: '2026-10-03T11:50:00Z' }}
        isAdmin
        onEdit={vi.fn()}
        onAddTimelineUpdate={vi.fn()}
      />,
    );
    await openMenu(user);
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Add timeline update/ })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Remove review \(moderation\)/ })).toBeInTheDocument();
  });
});