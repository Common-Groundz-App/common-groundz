import React from 'react';
import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate, type Location, type NavigateFunction } from 'react-router-dom';
import { useHistoryGuard } from '../screen/useHistoryGuard';
import { guardSessionOf, type GuardMode } from '../screen/historyGuard';

type Probe = { loc: Location; nav: NavigateFunction; release: () => Promise<boolean>; blocked: string[] };

function Composer({ mode, probe, fromKnown = false }: { mode: GuardMode; probe: Probe; fromKnown?: boolean }) {
  const loc = useLocation();
  const nav = useNavigate();
  const { release } = useHistoryGuard({
    mode,
    sessionId: 's1',
    fromKnown,
    fallback: '/home',
    onBlocked: (m) => probe.blocked.push(m),
  });
  probe.loc = loc;
  probe.nav = nav;
  probe.release = release;
  return <div data-testid="composer">composer</div>;
}
function Other({ probe }: { probe: Probe }) {
  probe.loc = useLocation();
  probe.nav = useNavigate();
  return <div>other</div>;
}

function setup(mode: GuardMode, opts: { strict?: boolean; fromKnown?: boolean; entries?: string[] } = {}) {
  const probe = { blocked: [] as string[] } as unknown as Probe;
  const tree = (m: GuardMode) => (
    <MemoryRouter initialEntries={opts.entries ?? ['/home', '/review']} initialIndex={(opts.entries ?? ['/home', '/review']).length - 1}>
      <Routes>
        <Route path="/review" element={<Composer mode={m} probe={probe} fromKnown={opts.fromKnown} />} />
        <Route path="*" element={<Other probe={probe} />} />
      </Routes>
    </MemoryRouter>
  );
  const wrap = (el: React.ReactElement) => (opts.strict ? <React.StrictMode>{el}</React.StrictMode> : el);
  const r = render(wrap(tree(mode)));
  return { probe, setMode: (m: GuardMode) => r.rerender(wrap(tree(m))), ...r };
}
const back = (p: Probe) => act(() => p.nav(-1));
const fwd = (p: Probe) => act(() => p.nav(1));

describe('useHistoryGuard with a real router', () => {
  it('clean: no guard entry; Back leaves normally', () => {
    const { probe, queryByTestId } = setup('clean');
    expect(guardSessionOf(probe.loc.state)).toBeNull();
    back(probe);
    expect(queryByTestId('composer')).toBeNull();
  });

  it('dirty: adds one guard; Back is blocked, repeated Back → Keep three times stays', () => {
    const { probe, queryByTestId, setMode } = setup('clean');
    setMode('dirty');
    expect(guardSessionOf(probe.loc.state)).toBe('s1');
    setMode('dirty');
    for (let i = 0; i < 3; i++) {
      back(probe);
      expect(queryByTestId('composer')).not.toBeNull();
      expect(guardSessionOf(probe.loc.state)).toBe('s1');
    }
    expect(probe.blocked).toEqual(['dirty', 'dirty', 'dirty']);
  });

  it('dirty → clean → Back: one press leaves (fallback replace when origin unknown)', () => {
    const { probe, queryByTestId, setMode } = setup('clean');
    setMode('dirty');
    setMode('clean');
    back(probe);
    expect(queryByTestId('composer')).toBeNull();
    expect(probe.loc.pathname).toBe('/home');
    expect(probe.blocked).toEqual([]);
  });

  it('dirty → clean → Back with a known origin steps back once more', () => {
    const { probe, queryByTestId, setMode } = setup('clean', { fromKnown: true, entries: ['/a', '/review'] });
    setMode('dirty');
    setMode('clean');
    back(probe);
    expect(queryByTestId('composer')).toBeNull();
    expect(probe.loc.pathname).toBe('/a');
  });

  it('Discard / Save / Cancel: release waits for the base entry, then replace', async () => {
    const { probe, queryByTestId, setMode } = setup('clean', { entries: ['/a', '/review'] });
    setMode('dirty');
    let ok = false;
    await act(async () => {
      ok = await probe.release();
    });
    expect(ok).toBe(true);
    expect(guardSessionOf(probe.loc.state)).toBeNull();
    act(() => probe.nav('/home', { replace: true }));
    expect(queryByTestId('composer')).toBeNull();
    // history: /a → /home (base replaced). Back reaches /a.
    back(probe);
    expect(probe.loc.pathname).toBe('/a');
    // Forward goes to /home, then the old guard entry: a fresh form, no dialog.
    fwd(probe);
    expect(probe.loc.pathname).toBe('/home');
    fwd(probe);
    expect(queryByTestId('composer')).not.toBeNull();
    expect(probe.blocked).toEqual([]);
  });

  it('saving and ambiguous are protected too', () => {
    const { probe, queryByTestId, setMode } = setup('clean');
    setMode('saving');
    back(probe);
    setMode('ambiguous');
    back(probe);
    expect(queryByTestId('composer')).not.toBeNull();
    expect(probe.blocked).toEqual(['saving', 'ambiguous']);
  });

  it('Strict Mode: double setup still leaves exactly one guard', () => {
    const { probe, setMode, queryByTestId } = setup('clean', { strict: true });
    setMode('dirty');
    expect(guardSessionOf(probe.loc.state)).toBe('s1');
    back(probe);
    expect(queryByTestId('composer')).not.toBeNull();
    // one more Back from the guard is blocked again, not a second stacked guard
    back(probe);
    expect(queryByTestId('composer')).not.toBeNull();
  });

  it('leftover marker from another session opens as a normal page', () => {
    const probe = { blocked: [] as string[] } as unknown as Probe;
    render(
      <MemoryRouter initialEntries={['/home', { pathname: '/review', state: { __reviewGuard: { sessionId: 'old' } } }]} initialIndex={1}>
        <Routes>
          <Route path="/review" element={<Composer mode="clean" probe={probe} />} />
          <Route path="*" element={<Other probe={probe} />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(probe.blocked).toEqual([]);
    back(probe);
    expect(probe.loc.pathname).toBe('/home');
  });

  it('release fails safely when not on the expected entry', async () => {
    const { probe, setMode } = setup('clean');
    setMode('dirty');
    // user is on the guard; simulate an unexpected forward-history push
    act(() => probe.nav('/review?x=1', { state: probe.loc.state }));
    let ok = true;
    await act(async () => {
      ok = await probe.release();
    });
    expect(ok).toBe(false);
  });
});
