import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ImageWithFallback, isRenderableImageSrc } from './ImageWithFallback';

vi.mock('@/utils/imageUtils', () => ({
  getProxyUrlForImage: (u: string) => (u.includes('books.example') ? `https://relay.example/p?url=${encodeURIComponent(u)}` : u),
}));

const DIRECT = 'https://cdn.example.com/a.jpg';
const RELAYED = 'https://books.example/cover.jpg';
const FB = 'https://cdn.example.com/fallback.jpg';
const Failed = () => <span data-testid="failed" />;
const imgs = (c: HTMLElement) => c.querySelectorAll('img');

describe('Post-6 Step 2 — ImageWithFallback', () => {
  it('empty src and no fallback → nothing', () => {
    const { container } = render(<ImageWithFallback src="" alt="" failedContent={<Failed />} />);
    expect(container.innerHTML).toBe('');
  });

  it('real image keeps src and classes', () => {
    const { container } = render(<ImageWithFallback src={DIRECT} alt="x" className="h-full w-full object-cover" />);
    expect(imgs(container)[0]).toHaveAttribute('src', DIRECT);
    expect(imgs(container)[0].className).toBe('h-full w-full object-cover');
  });

  it('direct failure, no fallback → panel, no retry, onError + onFailure once each', () => {
    const onError = vi.fn(); const onFailure = vi.fn();
    const { container, getByTestId } = render(<ImageWithFallback src={DIRECT} alt="" onError={onError} onFailure={onFailure} failedContent={<Failed />} />);
    fireEvent.error(imgs(container)[0]);
    expect(getByTestId('failed')).toBeInTheDocument();
    expect(imgs(container)).toHaveLength(0);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith('load');
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  it('relay failure → one direct retry with no callback, then terminal failure fires each once', () => {
    const onError = vi.fn(); const onFailure = vi.fn();
    const { container } = render(<ImageWithFallback src={RELAYED} alt="" onError={onError} onFailure={onFailure} failedContent={<Failed />} />);
    expect(imgs(container)[0].getAttribute('src')).toContain('relay.example');
    fireEvent.error(imgs(container)[0]);
    expect(imgs(container)[0]).toHaveAttribute('src', RELAYED);
    expect(onError).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
    fireEvent.error(imgs(container)[0]);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(imgs(container)).toHaveLength(0);
  });

  it('fallback used once; its failure causes no loop and no second callback', () => {
    const onError = vi.fn(); const onFailure = vi.fn();
    const { container, getByTestId } = render(<ImageWithFallback src={DIRECT} fallbackSrc={FB} alt="" onError={onError} onFailure={onFailure} failedContent={<Failed />} />);
    fireEvent.error(imgs(container)[0]);
    expect(imgs(container)[0]).toHaveAttribute('src', FB);
    fireEvent.error(imgs(container)[0]);
    expect(getByTestId('failed')).toBeInTheDocument();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  it.each([DIRECT, DIRECT.replace('https', 'http'), `  ${DIRECT} `])('fallback equivalent to source (%s) is skipped', (fb) => {
    const { container, getByTestId } = render(<ImageWithFallback src={DIRECT} fallbackSrc={fb} alt="" failedContent={<Failed />} />);
    fireEvent.error(imgs(container)[0]);
    expect(getByTestId('failed')).toBeInTheDocument();
  });

  it('invalid primary, no fallback → panel, no request, onFailure("invalid") once, no onError', () => {
    const onError = vi.fn(); const onFailure = vi.fn();
    const { container, getByTestId } = render(<ImageWithFallback src="ftp://x/y.jpg" alt="" onError={onError} onFailure={onFailure} failedContent={<Failed />} />);
    expect(imgs(container)).toHaveLength(0);
    expect(getByTestId('failed')).toBeInTheDocument();
    expect(onFailure).toHaveBeenCalledWith('invalid');
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('invalid primary with fallback → fallback once', () => {
    const { container } = render(<ImageWithFallback src="not a url" fallbackSrc={FB} alt="" />);
    expect(imgs(container)[0]).toHaveAttribute('src', FB);
  });

  it('no src with fallback → fallback, no onFailure; fallback failure → panel, still no callback', () => {
    const onFailure = vi.fn();
    const { container, getByTestId } = render(<ImageWithFallback src="" fallbackSrc={FB} alt="" onFailure={onFailure} failedContent={<Failed />} />);
    expect(imgs(container)[0]).toHaveAttribute('src', FB);
    fireEvent.error(imgs(container)[0]);
    expect(getByTestId('failed')).toBeInTheDocument();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('source formats: blob, data:image, /local render directly; unsafe rejected', () => {
    for (const u of ['blob:http://localhost/abc', 'data:image/png;base64,AA', '/local.png']) {
      const { container, unmount } = render(<ImageWithFallback src={u} alt="" />);
      expect(imgs(container)[0]).toHaveAttribute('src', u);
      unmount();
    }
    const { container } = render(<ImageWithFallback src="" fallbackSrc="/default.png" alt="" />);
    expect(imgs(container)[0]).toHaveAttribute('src', '/default.png');
    for (const u of ['ftp://a/b', 'javascript:alert(1)', 'data:text/html,x', '//evil.com/a.png', 'garbage']) {
      expect(isRenderableImageSrc(u)).toBe(false);
    }
  });

  it('source change resets; immediate error on new relayed source still retries once', () => {
    const onFailure = vi.fn();
    const r = render(<ImageWithFallback src={RELAYED} alt="" onFailure={onFailure} />);
    fireEvent.error(imgs(r.container)[0]); // now in direct phase
    const NEW = 'https://books.example/other.jpg';
    r.rerender(<ImageWithFallback src={NEW} alt="" onFailure={onFailure} />);
    expect(imgs(r.container)[0].getAttribute('src')).toContain('relay.example');
    fireEvent.error(imgs(r.container)[0]);
    expect(imgs(r.container)[0]).toHaveAttribute('src', NEW);
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('failed state clears when a new good link arrives; first-render error is current', () => {
    const onFailure = vi.fn();
    const r = render(<ImageWithFallback src={DIRECT} alt="" onFailure={onFailure} failedContent={<Failed />} />);
    fireEvent.error(imgs(r.container)[0]);
    expect(onFailure).toHaveBeenCalledTimes(1);
    r.rerender(<ImageWithFallback src={FB} alt="" onFailure={onFailure} failedContent={<Failed />} />);
    expect(imgs(r.container)[0]).toHaveAttribute('src', FB);
  });

  it('stale error from a replaced image is ignored', () => {
    const onFailure = vi.fn();
    const r = render(<ImageWithFallback src={DIRECT} alt="" onFailure={onFailure} />);
    const old = imgs(r.container)[0];
    r.rerender(<ImageWithFallback src={FB} alt="" onFailure={onFailure} />);
    fireEvent.error(old);
    expect(onFailure).not.toHaveBeenCalled();
    expect(imgs(r.container)[0]).toHaveAttribute('src', FB);
  });

  it('no Unsplash or placeholder.svg is ever introduced', () => {
    const { container } = render(<ImageWithFallback src={DIRECT} alt="" failedContent={<Failed />} />);
    fireEvent.error(imgs(container)[0]);
    expect(container.innerHTML).not.toMatch(/unsplash|placeholder\.svg/);
  });
});
