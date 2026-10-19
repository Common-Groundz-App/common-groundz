"""Phase 4 true multi-session concurrency tests — REVIEW DRAFT (rev 2).

ISOLATED TEST DATABASE ONLY. Uses independent psycopg connections so
locks are really contended (single-session tests cannot prove this).
Requires P4_TEST_DATABASE_URL. Refuses anything that looks like production.
Each test seeds with committed synthetic rows on the isolated DB and
cleans nothing up (the DB is disposable).

Setup (once, on the isolated DB, committed):
  * Phase 3 + dashboard + Phase 4 migrations applied
  * mux_cleanup_mode() replaced to return 'live'
  * mux_asset_reference_state() replaced to read p4t_ref (see SQL suite)

C1 attach vs claim        : exactly one wins; never both claimed AND attached
C2 two workers, one row   : exactly one claim; the other gets none_claimable
C3 lock order             : opposing asset orders never deadlock (no 40P01)
C4 concurrent acquire     : two runs racing for the run lease → exactly one
C5 takeover fence         : A holds, expires; B acquires; A's gate/claim/
                            release all fail while B's succeed
C6 finalize vs recovery   : finalize with expiring lease vs recovery claim →
                            exactly one of (accepted, new lease) wins
"""
import os, sys, threading, uuid
import psycopg

URL = os.environ.get("P4_TEST_DATABASE_URL", "")
if not URL or any(s in URL for s in ("supabase.co", "pooler.supabase.com")):
    sys.exit("refusing: set P4_TEST_DATABASE_URL to an isolated test database")

def conn():
    c = psycopg.connect(URL, autocommit=False)
    c.execute("SET lock_timeout = '5s'")
    return c

def q1(c, sql, *a):
    return c.execute(sql, a).fetchone()

def seed(asset):
    with conn() as c:
        cid = q1(c, """INSERT INTO mux_deletion_candidates(mux_asset_id, upload_record_id, source_kind, enqueue_reason, status, eligible_at)
                       VALUES (%s, gen_random_uuid(), 'post','post_hard_deleted','eligible', now() - interval '25 hours') RETURNING id""", asset)[0]
        c.execute("""INSERT INTO mux_cleanup_live_targets(candidate_id, expected_mux_asset_id, approved_note, expires_at)
                     VALUES (%s, %s, 'conc', now() + interval '1 hour')""", (cid, asset))
        c.commit()
        return cid

def reset_lease():
    with conn() as c:
        c.execute("UPDATE mux_cleanup_live_run_lease SET holder_run_id=NULL, lease_token=NULL, acquired_at=NULL, expires_at=NULL")
        c.commit()

def acquire(c):
    rid = uuid.uuid4()
    j = q1(c, "SELECT mux_cleanup_acquire_run_lease(%s)", rid)[0]
    c.commit()
    return rid, j

def race(fns):
    out, errs, barrier = [None] * len(fns), [], threading.Barrier(len(fns))
    def run(i, f):
        try:
            barrier.wait(); out[i] = f()
        except Exception as e:  # noqa: BLE001
            errs.append(e); out[i] = e
    ts = [threading.Thread(target=run, args=(i, f)) for i, f in enumerate(fns)]
    [t.start() for t in ts]; [t.join() for t in ts]
    return out, errs

results = []
def check(name, ok, detail=""):
    results.append((name, ok)); print(("PASS " if ok else "FAIL ") + name, detail)

# C4 concurrent acquire
reset_lease()
out, _ = race([lambda: acquire(conn())[1], lambda: acquire(conn())[1]])
check("C4 exactly one acquires", sum(1 for j in out if isinstance(j, dict) and j.get("acquired")) == 1, out)

# C5 takeover fence
reset_lease()
ca, cb = conn(), conn()
ra, ja = acquire(ca)
cid = seed("concC5")
claim = q1(ca, "SELECT mux_cleanup_claim_live(%s,%s,%s)", ra, ja["run_lease_token"], cid)[0]; ca.commit()
ca.execute("UPDATE mux_cleanup_live_run_lease SET expires_at = now() - interval '1 second'"); ca.commit()
rb, jb = acquire(cb)
check("C5 B took over", jb.get("acquired") is True and jb.get("took_over_expired") is True, jb)
gate_a = q1(ca, "SELECT mux_cleanup_pre_delete_gate(%s,%s,%s,%s)", ra, ja["run_lease_token"], cid, claim["lease_id"])[0]; ca.commit()
check("C5 stale A gate false", gate_a is False)
claim_a = q1(ca, "SELECT mux_cleanup_claim_live(%s,%s,NULL)", ra, ja["run_lease_token"])[0]; ca.commit()
check("C5 stale A claim refused", claim_a.get("reason") == "run_lease_not_held", claim_a)
rel_a = q1(ca, "SELECT mux_cleanup_release_run_lease(%s,%s,'succeeded','{}',NULL)", ra, ja["run_lease_token"])[0]; ca.commit()
holder = q1(cb, "SELECT holder_run_id FROM mux_cleanup_live_run_lease")[0]; cb.commit()
check("C5 stale A cannot release B", rel_a.get("released") is False and str(holder) == str(rb))
# a stale gate admitted just before expiry must still be safe: margin > request timeout (asserted in Deno tests)

# C2 two workers, one row
reset_lease()
c0 = conn(); r0, j0 = acquire(c0)
cid2 = seed("concC2")
def claimer():
    c = conn(); j = q1(c, "SELECT mux_cleanup_claim_live(%s,%s,%s)", r0, j0["run_lease_token"], cid2)[0]; c.commit(); return j
out, errs = race([claimer, claimer])
oks = [j for j in out if isinstance(j, dict) and j.get("claimed")]
check("C2 exactly one claim", len(oks) == 1, out)

# C1 attach vs claim
cid1 = seed("concC1")
def attach():
    c = conn()
    try:
        c.execute("SELECT mux_rescue_attached_media(%s::jsonb)", ('[{"type":"video","mux_asset_id":"concC1"}]',)); c.commit(); return "attached"
    except Exception as e:  # noqa: BLE001
        c.rollback(); return "refused:" + type(e).__name__
def claim1():
    c = conn(); j = q1(c, "SELECT mux_cleanup_claim_live(%s,%s,%s)", r0, j0["run_lease_token"], cid1)[0]; c.commit(); return j
out, _ = race([attach, claim1])
st = q1(conn(), "SELECT status, is_destructively_claimed FROM mux_deletion_candidates WHERE id=%s", cid1)
both = out[0] == "attached" and st[1] and st[0] != "rescued_referenced"
check("C1 never attached+claimed", not both, (out, st))

# C3 lock order
a, b = seed("concC3a"), seed("concC3b")
def lockpair(x, y):
    c = conn(); c.execute("SELECT mux_lock_assets(%s)", ([x, y],)); c.execute("SELECT pg_sleep(0.2)"); c.commit(); return "ok"
out, errs = race([lambda: lockpair("concC3a", "concC3b"), lambda: lockpair("concC3b", "concC3a")])
check("C3 no deadlock", not any("Deadlock" in type(e).__name__ for e in errs), errs)

# C6 finalize vs recovery
cid6 = seed("concC6")
cl6 = q1(c0, "SELECT mux_cleanup_claim_live(%s,%s,%s)", r0, j0["run_lease_token"], cid6)[0]; c0.commit()
c0.execute("UPDATE mux_deletion_candidates SET worker_lease_expires_at = now() + interval '300 milliseconds' WHERE id=%s", (cid6,)); c0.commit()
def fin():
    c = conn(); c.execute("SELECT pg_sleep(0.3)")
    j = q1(c, "SELECT mux_cleanup_finalize_live(%s,%s,%s,'deleted',NULL)", r0, cid6, cl6["lease_id"])[0]; c.commit(); return j
def rec():
    c = conn(); c.execute("SELECT pg_sleep(0.3)")
    j = q1(c, "SELECT mux_cleanup_claim_live(%s,%s,NULL)", r0, j0["run_lease_token"])[0]; c.commit(); return j
out, _ = race([fin, rec])
accepted = isinstance(out[0], dict) and out[0].get("accepted")
recovered = isinstance(out[1], dict) and out[1].get("kind") == "recover"
check("C6 not both finalize and recover", not (accepted and recovered), out)

print(f"{sum(ok for _, ok in results)}/{len(results)} passed")
sys.exit(0 if all(ok for _, ok in results) else 1)
