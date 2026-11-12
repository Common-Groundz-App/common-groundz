import React, { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CompactConnectedRingsRating from '../questionnaire/CompactConnectedRingsRating';

function Harness() {
  const [v, setV] = useState<number | undefined>(undefined);
  return (
    <>
      <CompactConnectedRingsRating label="Texture" idPrefix="t" value={v} onChange={setV} />
      <output data-testid="val">{v ?? 'none'}</output>
    </>
  );
}

describe('CompactConnectedRingsRating', () => {
  it('rates, toggles off by tapping again, and clears via Clear', () => {
    render(<Harness />);
    const four = screen.getByRole('button', { name: /Texture: 4 of 5/ });
    expect(four).toHaveAttribute('type', 'button');
    fireEvent.click(four);
    expect(screen.getByTestId('val')).toHaveTextContent('4');
    expect(screen.getByRole('button', { name: /Texture: 4 of 5/ })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: /Texture: 4 of 5/ }));
    expect(screen.getByTestId('val')).toHaveTextContent('none');

    fireEvent.click(screen.getByRole('button', { name: /Texture: 2 of 5/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear Texture rating' }));
    expect(screen.getByTestId('val')).toHaveTextContent('none');
  });

  it('Escape does not clear', () => {
    render(<Harness />);
    const three = screen.getByRole('button', { name: /Texture: 3 of 5/ });
    fireEvent.click(three);
    fireEvent.keyDown(three, { key: 'Escape' });
    expect(screen.getByTestId('val')).toHaveTextContent('3');
  });

  it('touch tap-to-clear leaves no rings lit (no sticky hover)', () => {
    render(<Harness />);
    const four = () => screen.getByRole('button', { name: /Texture: 4 of 5/ });
    fireEvent.pointerEnter(four(), { pointerType: 'touch' });
    fireEvent.mouseEnter(four());
    fireEvent.click(four());
    fireEvent.pointerEnter(four(), { pointerType: 'touch' });
    fireEvent.mouseEnter(four());
    fireEvent.click(four());
    expect(screen.getByTestId('val')).toHaveTextContent('none');
    const lit = document.querySelectorAll('circle[style*="rgb"], circle[style*="#"]');
    expect(lit.length).toBe(0);
  });
});
