import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ReviewOwnerMenu } from './ReviewOwnerMenu';

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
    expect(await screen.findByText('You can edit for 1 hour after publishing.')).toBeInTheDocument();

    await user.click(edit);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('keeps owner Edit visible but inert at the exact one-hour boundary', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    renderMenu('2026-10-03T11:00:00Z', { onEdit });
    await openMenu(user);

    const edit = screen.getByRole('menuitem', { name: 'Edit' });
    expect(edit).toHaveClass('cursor-not-allowed');
    await user.hover(edit);
    expect(await screen.findByText('Edit window closed (1 hour limit)')).toBeInTheDocument();

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
});