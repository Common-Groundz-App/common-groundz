import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EntityCollectionImage } from '@/components/entity/EntityCollectionImage';
import { EvidenceImage } from '@/components/admin/EvidenceImage';
import { DuplicateConfirmDialog } from '@/components/admin/entity-create/DuplicateConfirmDialog';

/** Group 6D — admin pictures by role. */
const REAL = 'https://cdn.example.com/real.jpg';
const STORED = 'https://cdn.example.com/stored.jpg';
const LEGACY = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30';

const Thumb = (p: { source: any; type?: unknown; name?: string }) => (
  <div data-testid="frame" className="w-10 h-10 rounded overflow-hidden bg-muted flex-shrink-0">
    <EntityCollectionImage source={p.source} type={p.type ?? 'book'} name={p.name ?? 'X'} imageClassName="w-full h-full object-cover" iconClassName="h-5 w-5" />
  </div>
);

describe('A — entity own thumbnail', () => {
  it('real picture shows in the unchanged frame', () => {
    render(<Thumb source={{ id: '1', image_url: REAL }} />);
    expect(screen.getByTestId('entity-collection-photo')).toHaveAttribute('src', REAL);
    expect(screen.getByTestId('frame').className).toBe('w-10 h-10 rounded overflow-hidden bg-muted flex-shrink-0');
  });
  it('missing, broken and legacy placeholder all show the icon; broken makes no second request', () => {
    const { unmount } = render(<Thumb source={{ id: '1', image_url: null }} name="Dune" />);
    expect(screen.getByRole('img', { name: 'No image available for Dune' })).toBeInTheDocument();
    unmount();
    const r = render(<Thumb source={{ id: '1', image_url: REAL }} />);
    fireEvent.error(screen.getByTestId('entity-collection-photo'));
    expect(screen.getByTestId('entity-collection-fallback')).toBeInTheDocument();
    expect(r.container.querySelectorAll('img')).toHaveLength(0);
    r.unmount();
    const l = render(<Thumb source={{ id: '1', image_url: LEGACY }} />);
    expect(screen.getByTestId('entity-collection-fallback')).toBeInTheDocument();
    expect(l.container.innerHTML).not.toContain('unsplash');
  });
  it('unknown type gets the neutral icon, no stock address', () => {
    const { container } = render(<Thumb source={null} type="spaceship" />);
    expect(screen.getByTestId('entity-collection-fallback')).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/unsplash|placeholder\.svg/);
  });
  it('switching entity resets a failure', () => {
    const { rerender } = render(<Thumb source={{ id: '1', image_url: REAL }} />);
    fireEvent.error(screen.getByTestId('entity-collection-photo'));
    rerender(<Thumb source={{ id: '2', image_url: 'https://cdn.example.com/b.jpg' }} />);
    expect(screen.getByTestId('entity-collection-photo')).toBeInTheDocument();
  });
  it('raw-source surfaces never swap to a stored photo', () => {
    render(<Thumb source={{ id: '1', image_url: REAL }} />);
    expect(screen.getByTestId('entity-collection-photo')).toHaveAttribute('src', REAL);
    expect(document.body.innerHTML).not.toContain(STORED);
  });
});

describe('Relationships — optional slot', () => {
  const Rel = ({ url }: { url: string | null }) => (
    <div data-testid="row">{url && <Thumb source={{ id: '1', image_url: url }} />}<span>name</span></div>
  );
  it('no picture → no box', () => {
    render(<Rel url={null} />);
    expect(screen.queryByTestId('frame')).toBeNull();
  });
  it('broken picture → icon inside the existing box', () => {
    render(<Rel url={REAL} />);
    fireEvent.error(screen.getByTestId('entity-collection-photo'));
    expect(screen.getByTestId('frame')).toContainElement(screen.getByTestId('entity-collection-fallback'));
  });
});

describe('C — evidence image', () => {
  const cls = 'h-12 w-12 rounded object-cover bg-muted shrink-0';
  it('tries the exact link', () => {
    render(<EvidenceImage src={REAL} name="A" className={cls} />);
    expect(screen.getByTestId('evidence-image')).toHaveAttribute('src', REAL);
  });
  it('failure shows "Image failed to load", never an entity icon or stock photo', () => {
    const { container } = render(<EvidenceImage src={LEGACY} name="A" className={cls} />);
    expect(screen.getByTestId('evidence-image')).toHaveAttribute('src', LEGACY);
    fireEvent.error(screen.getByTestId('evidence-image'));
    expect(screen.getByRole('img', { name: 'Image failed to load for A' })).toHaveClass('h-12', 'w-12');
    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect(screen.queryByTestId('entity-collection-fallback')).toBeNull();
  });
  it.each([null, undefined, '', '   '])('no link (%s) → "No image provided", no request', (src) => {
    const { container } = render(<EvidenceImage src={src as any} name="A" className={cls} />);
    expect(screen.getByRole('img', { name: 'No image provided for A' })).toBeInTheDocument();
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });
  it('changing the link clears the old failure', () => {
    const { rerender } = render(<EvidenceImage src={REAL} name="A" className={cls} />);
    fireEvent.error(screen.getByTestId('evidence-image'));
    rerender(<EvidenceImage src="https://cdn.example.com/new.jpg" name="A" className={cls} />);
    expect(screen.getByTestId('evidence-image')).toHaveAttribute('src', 'https://cdn.example.com/new.jpg');
  });
  it('duplicate window keeps its 48px box and shows the truthful states', () => {
    const base = { slug: null, parent_name: null, score: 1, reasons: [], type: 'book' };
    render(<DuplicateConfirmDialog open onCancel={() => {}} onUseExisting={() => {}} onContinueNew={() => {}}
      candidates={[{ ...base, id: '1', name: 'NoPic', image_url: null }, { ...base, id: '2', name: 'Pic', image_url: REAL }]} />);
    expect(screen.getByRole('img', { name: 'No image provided for NoPic' })).toHaveClass('h-12', 'w-12');
    expect(screen.getByAltText('Pic')).toHaveAttribute('src', REAL);
    expect(document.body.innerHTML).not.toMatch(/unsplash|placeholder\.svg/);
  });
});

import { ExactUrlDuplicateDialog } from '@/components/admin/entity-create/ExactUrlDuplicateDialog';

describe('6D addendum', () => {
  const cand = (id: string, image_url: string | null) => ({ id, name: `E${id}`, slug: null, image_url, type: 'book', parent_name: null, score: 1, reasons: [] });
  const noop = () => {};
  it('exact-URL window shows truthful states, isolates rows, never icon/stock', () => {
    render(<ExactUrlDuplicateDialog open candidates={[cand('1', REAL), cand('2', STORED), cand('3', null), cand('4', LEGACY)]} onCancel={noop} onOpenExisting={noop} onContinueAnyway={noop} />);
    const imgs = screen.getAllByTestId('evidence-image');
    expect(imgs.map(i => i.getAttribute('src'))).toEqual([REAL, STORED, LEGACY]);
    fireEvent.error(imgs[1]);
    expect(screen.getByRole('img', { name: 'Image failed to load for E2' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'No image provided for E3' })).toBeInTheDocument();
    expect(screen.getAllByTestId('evidence-image').map(i => i.getAttribute('src'))).toEqual([REAL, LEGACY]);
    expect(screen.queryByTestId('entity-collection-fallback')).toBeNull();
  });
  it('suggestion thumbnail resets failure when the entity changes', () => {
    const T = ({ id, url }: { id: string; url: string }) => (
      <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0">
        <EntityCollectionImage key={id} source={{ id, image_url: url }} type="book" name="S" imageClassName="w-16 h-16 rounded object-cover" iconClassName="h-6 w-6" />
      </div>
    );
    const r = render(<T id="a" url={REAL} />);
    fireEvent.error(screen.getByTestId('entity-collection-photo'));
    expect(screen.getByTestId('entity-collection-fallback')).toBeInTheDocument();
    r.rerender(<T id="b" url={STORED} />);
    expect(screen.getByTestId('entity-collection-photo')).toHaveAttribute('src', STORED);
  });
  it('evidence image resets when its source changes', () => {
    const r = render(<EvidenceImage src={REAL} name="D" className="h-12 w-12" />);
    fireEvent.error(screen.getByTestId('evidence-image'));
    r.rerender(<EvidenceImage src={STORED} name="D" className="h-12 w-12" />);
    expect(screen.getByTestId('evidence-image')).toHaveAttribute('src', STORED);
  });
});
