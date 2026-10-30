/**
 * Phase 4B.1 — shared tag selector via the questionnaire adapter.
 * stood_out: 5 total, all 5 may be custom. best_for: 5 total, 3 custom.
 */
import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import CuratedTagSelector from '@/components/profile/reviews/questionnaire/CuratedTagSelector';
import type { CuratedTagAnswer } from '@/components/profile/reviews/questionnaire/curatedTagInput';
import type { CuratedTagSet } from '@/components/profile/reviews/questionnaire/vocabularies';

let latest: CuratedTagAnswer = { selected: [], custom: [] };

function Harness({ tagSet, initial }: { tagSet: CuratedTagSet; initial?: CuratedTagAnswer }) {
  const [value, setValue] = useState<CuratedTagAnswer>(initial ?? { selected: [], custom: [] });
  latest = value;
  return (
    <form onSubmit={() => { throw new Error('form submitted'); }}>
      <CuratedTagSelector tagSet={tagSet} label="What stood out?" value={value} onChange={(v) => { latest = v; setValue(v); }} />
    </form>
  );
}

const input = () => screen.getByRole('textbox', { name: /Add your own tag/ });
const addCustom = (text: string) => {
  fireEvent.change(input(), { target: { value: text } });
  fireEvent.keyDown(input(), { key: 'Enter' });
};
const selectedList = () => screen.queryByRole('list', { name: /Selected tags/ });

afterEach(() => { cleanup(); latest = { selected: [], custom: [] }; });

describe('UnifiedTagSelector (curated adapter)', () => {
  it('hides Selected tags until something is selected, then syncs both ways', () => {
    render(<Harness tagSet="stood_out:place" />);
    expect(selectedList()).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Great ambience/, pressed: false }));
    expect(latest.selected).toEqual(['great_ambience']);
    expect(within(selectedList()!).getByText('Great ambience')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Great ambience' }));
    expect(latest.selected).toEqual([]);
    expect(screen.getByRole('button', { name: /Great ambience/ }).getAttribute('aria-pressed')).toBe('false');
    expect(selectedList()).toBeNull();
  });

  it('adds custom tags with Enter without submitting the form, and removes them', () => {
    render(<Harness tagSet="stood_out:place" />);
    addCustom('  Lack of AC  ');
    expect(latest.custom).toEqual(['Lack of AC']);
    expect((input() as HTMLInputElement).value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Lack of AC' }));
    expect(latest.custom).toEqual([]);
  });

  it('adds via the plus button', () => {
    render(<Harness tagSet="stood_out:place" />);
    fireEvent.change(input(), { target: { value: 'Rooftop' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    expect(latest.custom).toEqual(['Rooftop']);
  });

  it('typing a suggestion label selects the suggestion (stored code kept, no duplicate)', () => {
    render(<Harness tagSet="stood_out:place" />);
    addCustom('great AMBIENCE');
    expect(latest).toEqual({ selected: ['great_ambience'], custom: [] });
    addCustom('Great ambience');
    expect(latest).toEqual({ selected: ['great_ambience'], custom: [] });
    expect(screen.getByRole('status').textContent).toMatch(/already added/);
  });

  it('stood_out allows all 5 slots to be custom, then blocks new picks but allows removal', () => {
    render(<Harness tagSet="stood_out:place" />);
    for (const t of ['a1', 'a2', 'a3', 'a4', 'a5']) addCustom(t);
    expect(latest.custom).toHaveLength(5);
    expect((input() as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /Great ambience/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Remove a3' }));
    expect(latest.custom).toEqual(['a1', 'a2', 'a4', 'a5']);
    expect((input() as HTMLInputElement).disabled).toBe(false);
  });

  it('best_for keeps its existing 3-custom cap', () => {
    render(<Harness tagSet="best_for:place" />);
    for (const t of ['b1', 'b2', 'b3']) addCustom(t);
    expect(latest.custom).toHaveLength(3);
    expect((input() as HTMLInputElement).disabled).toBe(true);
  });

  it('preserves the typed draft across chip interactions', () => {
    render(<Harness tagSet="stood_out:place" />);
    fireEvent.change(input(), { target: { value: 'half typed' } });
    fireEvent.click(screen.getByRole('button', { name: /Good service/ }));
    expect((input() as HTMLInputElement).value).toBe('half typed');
  });

  it('hydrates saved answers into Selected tags and pressed suggestions', () => {
    render(<Harness tagSet="stood_out:place" initial={{ selected: ['good_service'], custom: ['Old custom'] }} />);
    const list = selectedList()!;
    expect(within(list).getByText('Good service')).toBeTruthy();
    expect(within(list).getByText('Old custom')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Good service/, pressed: true })).toBeTruthy();
  });
});
