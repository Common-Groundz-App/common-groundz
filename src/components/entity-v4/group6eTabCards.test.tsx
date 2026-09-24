import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChildCardImage } from './EntityTabsContent';

const REAL = 'https://cdn.example.com/child.jpg';
const OTHER = 'https://cdn.example.com/other.jpg';
const LEGACY = 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?auto=format';
const LEGIT = 'https://images.unsplash.com/photo-a-real-entity-photo?auto=format';
const c = (image_url: any, extra: any = {}) => ({ id: '1', name: 'Dosa', type: 'food', image_url, ...extra }) as any;
const photo = () => screen.queryByTestId('entity-collection-photo');
const icon = () => screen.queryByTestId('entity-collection-fallback');

describe('Group 6E — child card picture', () => {
  it.each([null, undefined, '', '   '])('no usable link (%s) → no wrapper', (v) => {
    const { container } = render(<ChildCardImage child={c(v)} />);
    expect(container.innerHTML).toBe('');
  });
  it('padded link renders trimmed; real link keeps src and classes', () => {
    const { container } = render(<ChildCardImage child={c(`  ${REAL}  `)} />);
    expect(photo()).toHaveAttribute('src', REAL);
    expect(photo()!.className).toBe('w-full h-full object-cover');
    expect((container.firstChild as HTMLElement).className).toBe('w-full h-32 rounded-md overflow-hidden bg-muted mb-3');
  });
  it('broken → icon inside the existing wrapper, no second request', () => {
    const { container } = render(<ChildCardImage child={c(REAL)} />);
    fireEvent.error(photo()!);
    expect(icon()).toBeInTheDocument();
    expect(container.querySelectorAll('img')).toHaveLength(0);
    expect((container.firstChild as HTMLElement).className).toContain('h-32');
  });
  it('registered placeholder → icon; legitimate Unsplash → real image', () => {
    const a = render(<ChildCardImage child={c(LEGACY)} />);
    expect(icon()).toBeInTheDocument();
    expect(a.container.innerHTML).not.toContain('photo-1560769629');
    a.unmount();
    render(<ChildCardImage child={c(LEGIT)} />);
    expect(photo()).toHaveAttribute('src', LEGIT);
  });
  it('unknown type → neutral icon, no placeholder.svg or remote fallback', () => {
    const { container } = render(<ChildCardImage child={c(REAL, { type: 'weird' })} />);
    fireEvent.error(photo()!);
    expect(icon()).toBeInTheDocument();
    expect(container.innerHTML.replace(/http:\/\/www\.w3\.org[^"]*/g, "")).not.toMatch(/placeholder\.svg|https?:/);
  });
  it('failure resets for a different child and for the same id with a new link', () => {
    const r = render(<ChildCardImage child={c(REAL)} />);
    fireEvent.error(photo()!);
    r.rerender(<ChildCardImage child={c(REAL, { id: '2' })} />);
    expect(photo()).toHaveAttribute('src', REAL);
    fireEvent.error(photo()!);
    r.rerender(<ChildCardImage child={c(OTHER, { id: '2' })} />);
    expect(photo()).toHaveAttribute('src', OTHER);
  });
  it('stored metadata photo never overrides raw image_url', () => {
    render(<ChildCardImage child={c(REAL, { metadata: { stored_photo_urls: [OTHER] } })} />);
    expect(photo()).toHaveAttribute('src', REAL);
  });
});
