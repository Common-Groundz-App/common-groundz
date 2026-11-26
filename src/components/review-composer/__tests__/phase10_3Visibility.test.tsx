// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { REVIEW_VISIBILITIES } from '@/components/review-composer/values';
import { isReviewVideoVisibilityLocked } from '@/utils/reviewVideoErrors';
import StepFour from '@/components/profile/reviews/steps/StepFour';

const src = (p: string) => readFileSync(p, 'utf8');

describe('Phase 10.3 — Public/Private authoring', () => {
  it('review composer offers exactly Public and Private', () => {
    expect([...REVIEW_VISIBILITIES]).toEqual(['public', 'private']);
  });

  it('review visibility step renders exactly two radio options, Public default', () => {
    render(<StepFour {...({ part: 'visibility', config: { sections: [] }, answers: {}, visibility: 'public', onVisibilityChange: () => {} } as any)} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(screen.getByLabelText('Public').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByLabelText('Private').getAttribute('aria-checked')).toBe('false');
  });

  it('video lock keeps Private disabled', () => {
    render(<StepFour {...({ part: 'visibility', config: { sections: [] }, answers: {}, visibility: 'public', onVisibilityChange: () => {}, nonPublicLockedReason: 'Has video' } as any)} />);
    expect(screen.getByLabelText('Private').hasAttribute('disabled')).toBe(true);
  });

  it('no active authoring path can submit circle_only', () => {
    for (const p of [
      'src/components/feed/EnhancedCreatePostForm.tsx',
      'src/components/feed/composer/ComposerBottomBar.tsx',
      'src/components/reviews/ReviewOwnerMenu.tsx',
      'src/components/profile/reviews/steps/StepFour.tsx',
    ]) {
      expect(src(p)).not.toMatch(/value="circle(_only)?"|Circle Only|Only Me|return 'circle_only'|'circle'/);
    }
  });

  it('recognizes only the specific video lock error', () => {
    expect(isReviewVideoVisibilityLocked({ code: '22023', message: 'review_video_visibility_locked' })).toBe(true);
    expect(isReviewVideoVisibilityLocked({ code: '22023', message: 'other' })).toBe(false);
  });
});
