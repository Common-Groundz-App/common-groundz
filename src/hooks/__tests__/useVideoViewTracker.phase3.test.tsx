import React, { useRef } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

const observe = vi.fn();
class IO { observe = observe; disconnect() {} constructor(_cb: unknown) {} }
(globalThis as any).IntersectionObserver = IO;
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: vi.fn() } } }));

import { useVideoViewTracker } from '@/hooks/useVideoViewTracker';

function Probe({ enabled }: { enabled?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const auto = useRef(true);
  useVideoViewTracker({ videoRef: ref, sourceId: 's', mediaPath: 'p', autoplayRef: auto, enabled });
  return <video ref={ref} />;
}

describe('view tracker gate', () => {
  beforeEach(() => observe.mockClear());
  it('tracks by default (posts unchanged)', () => {
    render(<Probe />);
    expect(observe).toHaveBeenCalledTimes(1);
  });
  it('does nothing when disabled (review videos)', () => {
    render(<Probe enabled={false} />);
    expect(observe).not.toHaveBeenCalled();
  });
});
