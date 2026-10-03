import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/components/feed/UnifiedEntitySelector', () => ({
  UnifiedEntitySelector: () => <div data-testid="subject-search" />,
}));
vi.mock('@/hooks/useSearchFunnel', () => ({ useSearchFunnel: () => ({ log: vi.fn() }) }));
vi.mock('../steps/SubjectQuickCreate', () => ({ default: () => null }));

import SubjectSelectStep from '../steps/SubjectSelectStep';

const base = { onSubjectChange: vi.fn(), requirement: 'required' as const };

describe('SubjectSelectStep locked edit', () => {
  it('shows a placeholder card, never search, while loading', () => {
    render(<SubjectSelectStep {...base} subject={null} disabled locked lockedStatus="loading" />);
    expect(screen.getByTestId('locked-subject-skeleton')).toBeTruthy();
    expect(screen.queryByTestId('subject-search')).toBeNull();
  });

  it('shows Subject unavailable with retry on failure, never search', () => {
    const retry = vi.fn();
    render(<SubjectSelectStep {...base} subject={null} disabled locked lockedStatus="error" onRetryLocked={retry} />);
    expect(screen.getByText('Subject unavailable')).toBeTruthy();
    expect(screen.queryByTestId('subject-search')).toBeNull();
    fireEvent.click(screen.getByText('Try again'));
    expect(retry).toHaveBeenCalled();
  });

  it('shows the locked card with no clear button once loaded', () => {
    render(
      <SubjectSelectStep
        {...base}
        subject={{ id: 'e1', name: 'The Bier Library', type: 'place' } as any}
        disabled
        locked
      />,
    );
    expect(screen.getByText("You're reviewing The Bier Library.")).toBeTruthy();
    expect(screen.queryByLabelText('Clear selected subject')).toBeNull();
    expect(screen.queryByTestId('subject-search')).toBeNull();
  });
});
