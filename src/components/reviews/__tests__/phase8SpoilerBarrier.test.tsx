import React, { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpoilerBarrier } from '../SpoilerBarrier';
import { hasSpoilerFlag } from '@/utils/spoilers';

// Mirrors how every review surface uses the barrier: conditional render, per-card state.
const Card = ({ id, metadata }: { id: string; metadata: unknown }) => {
  const [revealed, setRevealed] = useState(false);
  const hidden = hasSpoilerFlag(metadata) && !revealed;
  return (
    <div data-testid={id}>
      <span>Reviewer {id}</span>
      {hidden ? <SpoilerBarrier onReveal={() => setRevealed(true)} /> : <p>Secret text {id}</p>}
    </div>
  );
};

describe('SpoilerBarrier', () => {
  it('protected text is not mounted until reveal; reveal is per card', () => {
    render(<><Card id="a" metadata={{ contains_spoilers: true }} /><Card id="b" metadata={{ contains_spoilers: true }} /></>);
    expect(screen.queryByText('Secret text a')).toBeNull();
    expect(screen.getByText('Reviewer a')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Show review' })[0]);
    expect(screen.getByText('Secret text a')).toBeTruthy();
    expect(screen.queryByText('Secret text b')).toBeNull();
  });
  it('ordinary reviews show no barrier', () => {
    render(<Card id="c" metadata={{}} />);
    expect(screen.queryByRole('button', { name: 'Show review' })).toBeNull();
    expect(screen.getByText('Secret text c')).toBeTruthy();
  });
  it('reveal click does not bubble to the card', () => {
    let cardClicks = 0;
    render(<div onClick={() => cardClicks++}><SpoilerBarrier onReveal={() => {}} /></div>);
    fireEvent.click(screen.getByRole('button', { name: 'Show review' }));
    expect(cardClicks).toBe(0);
  });
});
