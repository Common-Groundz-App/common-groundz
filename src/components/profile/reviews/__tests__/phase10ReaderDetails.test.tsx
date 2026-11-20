import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { resolveReviewReaderDetails } from '../questionnaire/readerDetails';
import ReviewQuestionnaireDetails from '../questionnaire/ReviewQuestionnaireDetails';
import ReviewRecommendationBadge from '../questionnaire/ReviewRecommendationBadge';
import StaticAttributeRings from '../questionnaire/StaticAttributeRings';

const env = (type: string, answers: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  questionnaire: { version: 1, type, answers },
  ...extra,
});

describe('resolveReviewReaderDetails', () => {
  it('resolves registry labels for choices, context and attributes', () => {
    const d = resolveReviewReaderDetails(
      env('movie', { would_recommend: 'yes', repeat_intent: 'maybe', watch_count: 'second_time', attribute_ratings: { story: 4, acting: 9, retired: 3 } }),
      'movie',
    );
    expect(d.recommendation).toBe('yes');
    expect(d.repeatIntent).toMatchObject({ question: 'Would you watch it again?', answer: 'Maybe' });
    expect(d.experienceContext[0]).toMatchObject({ question: 'Which viewing is this?', answer: '2nd time' });
    expect(d.attributeRatings).toEqual([{ id: 'story', label: 'Story', value: 4 }]);
  });

  it('keeps custom tags, humanizes retired ids, ignores legacy stood_out', () => {
    const d = resolveReviewReaderDetails(
      env('movie', { liked: { selected: ['retired_thing'], custom: ['Score'] }, stood_out: { selected: ['x'] } }),
      'movie',
    );
    expect(d.tagGroups).toHaveLength(1);
    expect(d.tagGroups[0].tags.map((t) => t.label)).toEqual(['Retired thing', 'Score']);
  });

  it('reads food_tags and portion for food', () => {
    const d = resolveReviewReaderDetails(env('food', { portion: 'large' }, { food_tags: ['Spicy', 'spicy', 3, ''] }), 'food');
    expect(d.verdictChoices[0].answer).toBe('Large');
    expect(d.tagGroups.find((g) => g.fieldId === 'food_tags')?.tags.map((t) => t.label)).toEqual(['Spicy']);
  });

  it('returns empty for malformed, mismatched, unknown and invalid codes', () => {
    expect(resolveReviewReaderDetails(null, 'movie').isEmpty).toBe(true);
    expect(resolveReviewReaderDetails(env('book', { would_recommend: 'yes' }), 'movie').isEmpty).toBe(true);
    expect(resolveReviewReaderDetails(env('movie', { would_recommend: 'yes' }), 'widget').isEmpty).toBe(true);
    expect(resolveReviewReaderDetails(env('movie', { would_recommend: 'auto' }), 'movie').recommendation).toBeNull();
  });
});

describe('reader components', () => {
  it('badge hidden when unanswered, labelled when set', () => {
    const { container } = render(<ReviewRecommendationBadge value={null} />);
    expect(container).toBeEmptyDOMElement();
    render(<ReviewRecommendationBadge value="no" />);
    expect(screen.getByTestId('recommendation-badge')).toHaveTextContent("Doesn't recommend");
  });

  it('static rings are non-interactive and labelled', () => {
    render(<StaticAttributeRings label="Story" value={4} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByRole('img', { name: 'Story: 4 of 5' })).toBeInTheDocument();
  });

  it('details renders nothing when empty and hides empty sections', () => {
    const { container } = render(<ReviewQuestionnaireDetails details={resolveReviewReaderDetails({}, 'movie')} />);
    expect(container).toBeEmptyDOMElement();
    render(<ReviewQuestionnaireDetails details={resolveReviewReaderDetails(env('movie', { attribute_ratings: { story: 5 } }), 'movie')} />);
    expect(screen.getByText('Details')).toBeInTheDocument();
    expect(screen.queryByText('Verdict')).toBeNull();
  });
});
