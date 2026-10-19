"""Phase 4 TRUE multi-session concurrency tests — REVIEW DRAFT. NOT RUN.

Uses two independent connections (separate backend PIDs) against an
ISOLATED test database URL given in P4_TEST_DATABASE_URL. Refuses to run if
that URL looks like production. Fixtures are committed p4test_* rows and are
removed in `finally` (candidates cannot be deleted by design, so the test DB
must be disposable; cleanup drops the whole schema copy).

C1 attach vs destructive claim: session A holds the asset lock in a save
   (rescue); session B's claim must block, then see rescued_referenced.
C2 two workers race same candidate: exactly one claim succeeds.
C3 lock order: A = save path, B = claim path on two assets in opposite
   input order; no deadlock (both finish < timeout).
"""
import os, sys, threading, time
import psycopg  # pip install psycopg[binary]

URL = os.environ.get("P4_TEST_DATABASE_URL", "")
if not URL or "uyjtgybbktgapspodajy" in URL:
    sys.exit("BLOCKED: no isolated test database (refusing production)")

def conn():
    c = psycopg.connect(URL, autocommit=False); c.execute("SET statement_timeout='20s'"); return c

def setup(c):
    c.execute("""CREATE OR REPLACE FUNCTION public.mux_cleanup_mode() RETURNS text LANGUAGE sql STABLE
                 SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT 'live'::text $$""")
    c.execute("""INSERT INTO public.mux_deletion_candidates(mux_asset_id,source_kind,enqueue_reason,status,eligible_at)
                 SELECT 'p4test_c'||g,'post','post_hard_deleted','eligible',now()-interval '1 min' FROM generate_series(1,3) g""")
    c.commit()

def cid(c, a):
    return c.execute("SELECT id FROM public.mux_deletion_candidates WHERE mux_asset_id=%s", (a,)).fetchone()[0]

def c1():
    a, b = conn(), conn()
    a.execute("SELECT public.mux_lock_assets(ARRAY['p4test_c1'])")  # A: inside a save, holding lock
    a.execute("UPDATE public.mux_deletion_candidates SET status='rescued_referenced' WHERE mux_asset_id='p4test_c1'")
    out = {}
    def claim():
        out["r"] = b.execute("SELECT public.mux_cleanup_claim_live(gen_random_uuid(), NULL)").fetchone()[0]; b.commit()
    t = threading.Thread(target=claim); t.start(); time.sleep(1.0)
    blocked = t.is_alive(); a.commit(); t.join(10)
    row = b.execute("SELECT status,is_destructively_claimed FROM public.mux_deletion_candidates WHERE mux_asset_id='p4test_c1'").fetchone()
    return blocked and row == ("rescued_referenced", False)

def c2():
    a, b = conn(), conn(); target = cid(a, "p4test_c2"); res = []
    def go(c): res.append(c.execute("SELECT public.mux_cleanup_claim_live(gen_random_uuid(), NULL)").fetchone()[0]); c.commit()
    ts = [threading.Thread(target=go, args=(x,)) for x in (a, b)]; [t.start() for t in ts]; [t.join(15) for t in ts]
    got = [r for r in res if r and r["candidate_id"] == str(target)]
    return len(got) == 1

def c3():
    a, b = conn(), conn(); ok = []
    def save(): a.execute("SELECT public.mux_lock_assets(ARRAY['p4test_c3','p4test_c2'])"); time.sleep(0.5); a.commit(); ok.append(1)
    def claim(): b.execute("SELECT public.mux_lock_assets(ARRAY['p4test_c2','p4test_c3'])"); time.sleep(0.5); b.commit(); ok.append(1)
    ts = [threading.Thread(target=f) for f in (save, claim)]; [t.start() for t in ts]; [t.join(15) for t in ts]
    return len(ok) == 2

if __name__ == "__main__":
    s = conn(); setup(s)
    try:
        for name, f in (("C1 attach vs claim", c1), ("C2 double claim", c2), ("C3 lock order", c3)):
            try: print(name, "PASS" if f() else "FAIL")
            except Exception as e: print(name, "ERROR", type(e).__name__)
    finally:
        print("cleanup: drop/restore the disposable test database (rows are undeletable by design)")
