import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const ctx = { viewerId: null as string | null, isPending: vi.fn(() => false), toggle: vi.fn() };
vi.mock('../ReviewHelpfulContext', () => ({ useReviewHelpful: () => ctx }));
import { HelpfulControl } from '../HelpfulControl';

const review = (o: any = {}) => ({ id: 'r1', user_id: 'author', visibility: 'public', likes: 3, isLiked: false, ...o }) as any;

describe('Phase 11.2 HelpfulControl', () => {
  beforeEach(() => { ctx.viewerId = null; ctx.isPending.mockReturnValue(false); ctx.toggle.mockReset(); });

  it('guests see the public count and tapping goes through toggle (auth prompt)', () => {
    render(<HelpfulControl review={review()} />);
    fireEvent.click(screen.getByRole('button', { name: /Mark as Helpful/ }));
    expect(screen.getByText('Helpful · 3')).toBeTruthy();
    expect(ctx.toggle).toHaveBeenCalledTimes(1);
  });

  it('shows the selected state for the signed-in voter', () => {
    ctx.viewerId = 'u1';
    render(<HelpfulControl review={review({ isLiked: true, likes: 4 })} />);
    expect(screen.getByRole('button', { name: /Remove Helpful vote/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('authors get a passive count, no button', () => {
    ctx.viewerId = 'author';
    render(<HelpfulControl review={review()} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByTestId('helpful-passive').textContent).toContain('Helpful · 3');
  });

  it('private reviews render nothing', () => {
    const { container } = render(<HelpfulControl review={review({ visibility: 'private' })} isPrivateReview />);
    expect(container.innerHTML).toBe('');
  });

  it('is disabled while pending and does not propagate clicks to the card', () => {
    ctx.viewerId = 'u1';
    ctx.isPending.mockReturnValue(true);
    const parent = vi.fn();
    render(<div onClick={parent}><HelpfulControl review={review()} /></div>);
    const btn = screen.getByRole('button', { name: /Mark as Helpful/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    ctx.isPending.mockReturnValue(false);
  });

  it('click on Timeline card Helpful does not trigger card navigation', () => {
    ctx.viewerId = 'u1';
    const parent = vi.fn();
    render(<div onClick={parent}><HelpfulControl review={review()} /></div>);
    fireEvent.click(screen.getByRole('button', { name: /Mark as Helpful/ }));
    expect(parent).not.toHaveBeenCalled();
    expect(ctx.toggle).toHaveBeenCalled();
  });
});
