"""
Timeline-update page browser check (3C).

Run against the dev server:  python3 scripts/e2e/review-timeline-3c.py
Sign-in is FAKED (a stored fake session + intercepted auth/profile reads) and
EVERY non-GET request to the backend is blocked before the page loads, so
nothing can reach the database or storage. Exits non-zero when a required
acceptance case fails; the rapid double-Back case is reported separately.
"""
import asyncio, base64, json, sys, time
from pathlib import Path
from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
REF = "uyjtgybbktgapspodajy"
OUT = Path("/tmp/browser/timeline3c"); OUT.mkdir(parents=True, exist_ok=True)
UID = "00000000-0000-4000-8000-00000000e2e0"

def b64(o): return base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip("=")
exp = int(time.time()) + 3600
jwt = f"{b64({'alg':'HS256','typ':'JWT'})}.{b64({'sub':UID,'exp':exp,'role':'authenticated','aud':'authenticated'})}.sig"
USER = {"id": UID, "aud": "authenticated", "role": "authenticated", "email": "e2e@example.test",
        "app_metadata": {"provider": "email", "providers": ["email"]}, "user_metadata": {}, "created_at": "2026-01-01T00:00:00Z"}
SESSION = {"access_token": jwt, "refresh_token": "r", "token_type": "bearer", "expires_in": 3600, "expires_at": exp, "user": USER}
PROFILE = {"id": UID, "username": "e2e", "first_name": "E2E", "last_name": "Test", "display_name": "E2E",
           "avatar_url": None, "bio": None, "location": None, "is_deleted": False, "deleted_at": None,
           "created_at": "2026-01-01T00:00:00Z", "updated_at": "2026-01-01T00:00:00Z", "profile_completed": True}

PLACE_ID = "11111111-1111-4111-8111-111111111111"
PLACE = {"id": PLACE_ID, "name": "Ambur", "type": "place", "slug": "ambur", "is_deleted": False, "image_url": None,
         "venue": "Ambur, Tamil Nadu, India", "description": "Ambur, Tamil Nadu, India", "parent_id": None,
         "metadata": {}, "category_id": None, "api_source": None, "api_ref": None, "created_at": "2026-01-01T00:00:00Z"}


import datetime
REVIEW_ID = "33333333-3333-4333-8333-333333333333"
UPDATE_ID = "44444444-4444-4444-8444-444444444444"
OTHER_ID = "55555555-5555-4555-8555-555555555555"
def iso(minutes_ago): return (datetime.datetime.utcnow() - datetime.timedelta(minutes=minutes_ago)).isoformat() + "Z"
REVIEW = {"id": REVIEW_ID, "user_id": UID, "entity_id": PLACE_ID, "category": "place", "title": "Ambur", "venue": None,
          "subtitle": "", "description": "first", "rating": 4, "media": [], "image_url": None, "visibility": "public",
          "experience_date": None, "metadata": {}, "status": "published", "created_at": iso(600),
          "has_timeline": True, "timeline_count": 1}
S = {"update": None, "latest": None, "updates_error": False, "rpc": {"status": "ok"}}
def upd(**o):
    d = {"id": UPDATE_ID, "review_id": REVIEW_ID, "user_id": UID, "rating": 3, "comment": "earlier note",
         "media": [], "would_recommend": "auto", "created_at": iso(10), "updated_at": iso(10)}
    d.update(o); return d

blocked_writes = []
results = []

async def route(r):
    req = r.request; url = req.url
    single = "vnd.pgrst.object" in (req.headers.get("accept") or "")
    if "/auth/v1/user" in url: return await r.fulfill(json=USER)
    if "/auth/v1/" in url: return await r.fulfill(json=SESSION)
    if "/rpc/" in url:
        name = url.split("/rpc/")[1].split("?")[0]
        if name == "has_role": return await r.fulfill(json=True)
        if name == "edit_latest_review_update":
            blocked_writes.append(f"RPC {name} (answered by the test, never sent)")
            return await r.fulfill(json=S["rpc"])
        return await r.fulfill(json={} if name == "get_public_flags" else None)
    if req.method not in ("GET", "HEAD", "OPTIONS"):
        blocked_writes.append(f"{req.method} {url.split('?')[0]}")
        return await r.fulfill(status=403, body='{"message":"blocked by e2e"}', content_type="application/json")
    if "/rest/v1/review_updates" in url:
        if S["updates_error"]: return await r.fulfill(status=500, json={"message": "down"})
        row = S["latest"] if "limit=1" in url else S["update"]
        return await r.fulfill(json=row) if row else await r.fulfill(status=406, json={"code": "PGRST116"})
    if "/rest/v1/reviews" in url: return await r.fulfill(json=REVIEW if single else [REVIEW])
    if "/rest/v1/entities" in url and PLACE_ID in url: return await r.fulfill(json=PLACE if single else [PLACE])
    if "/rest/v1/profiles" in url: return await r.fulfill(json=PROFILE if single else [PROFILE])
    if "/rest/v1/" in url:
        return await r.fulfill(status=406 if single else 200, json={"code":"PGRST116"} if single else [])
    if "/storage/v1/" in url or "/functions/v1/" in url:
        blocked_writes.append(f"{req.method} {url}")
        return await r.fulfill(status=403, body="{}", content_type="application/json")
    return await r.continue_()

def check(name, ok, detail="", required=True):
    results.append((name, bool(ok), detail, required))
    print(("PASS " if ok else ("FAIL " if required else "NOTE ")) + name + (f" — {detail}" if detail else ""))

async def dialog_text(page):
    d = page.get_by_role("alertdialog")
    if await d.count() == 0: d = page.get_by_role("dialog")
    return (await d.inner_text()) if await d.count() else ""

async def fresh(ctx):
    page = await ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    await page.goto(BASE + "/", wait_until="domcontentloaded")
    await page.evaluate(f"localStorage.setItem('sb-{REF}-auth-token', {json.dumps(json.dumps(SESSION))})")
    await page.goto(BASE + "/home", wait_until="networkidle")
    return page, errors

async def go(page, path):
    await page.goto(BASE + path, wait_until="networkidle"); await page.wait_for_timeout(500)
    return await page.inner_text("body")

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        for width in (390, 1280):
            ctx = await b.new_context(viewport={"width": width, "height": 1800})
            await ctx.route("**/*.supabase.co/**", route)
            t = f"@{width}"
            page, errs = await fresh(ctx)
            NEW = f"/review/{REVIEW_ID}/timeline/new"; EDIT = f"/review/{REVIEW_ID}/timeline/{UPDATE_ID}/edit"

            S.update(update=None, latest=None, updates_error=False)
            body = await go(page, NEW)
            await page.screenshot(path=str(OUT / f"new{width}.png"))
            check(f"add page opens with subject {t}", "Add timeline update" in body and "Ambur" in body)
            save = page.get_by_role("button", name="Add update")
            check(f"Save disabled while comment empty {t}", await save.is_disabled())
            await page.fill("#timeline-comment", "it got better")
            await page.go_back(); await page.wait_for_timeout(600)
            check(f"dirty Back asks first {t}", "Discard your draft?" in await dialog_text(page))
            await page.get_by_role("button", name="Keep editing").click(); await page.wait_for_timeout(300)
            await page.get_by_role("button", name="Add update").click(); await page.wait_for_timeout(1500)
            body = await page.inner_text("body")
            check(f"failed add keeps the form and says so {t}", "Could not add the timeline update." in body and await page.input_value("#timeline-comment") == "it got better")
            await page.get_by_role("button", name="Cancel").first.click(); await page.wait_for_timeout(300)
            await page.get_by_role("button", name="Discard").click(); await page.wait_for_timeout(1500)
            check(f"Cancel → Discard leaves the page {t}", "/review/" not in page.url, page.url)

            S.update(update=upd(), latest=upd())
            body = await go(page, EDIT)
            await page.screenshot(path=str(OUT / f"edit{width}.png"))
            check(f"edit prefills the update {t}", await page.input_value("#timeline-comment") == "earlier note")
            check(f"auto recommendation shown as selected {t}", await page.get_by_role("button", name="Base recommendation on rating").count() > 0)
            S["rpc"] = {"status": "not_latest"}
            await page.fill("#timeline-comment", "edited")
            await page.get_by_role("button", name="Save update").click(); await page.wait_for_timeout(1200)
            body = await page.inner_text("body")
            check(f"save-time not-latest keeps draft {t}", "Cannot edit — A newer update exists." in body and await page.input_value("#timeline-comment") == "edited")
            S["rpc"] = {"status": "expired"}
            body = await go(page, EDIT)
            await page.fill("#timeline-comment", "edited again")
            await page.get_by_role("button", name="Save update").click(); await page.wait_for_timeout(1200)
            body = await page.inner_text("body")
            check(f"save-time expiry keeps draft {t}", "Edit window closed (1 hour limit)" in body and await page.input_value("#timeline-comment") == "edited again")
            page.on("dialog", lambda d: asyncio.ensure_future(d.accept()))

            S.update(update=upd(created_at=iso(120)), latest=upd(created_at=iso(120)))
            body = await go(page, EDIT)
            check(f"device-clock expiry is advisory only {t}", "may be past its 1-hour edit window" in body and await page.locator("#timeline-comment").count() == 1)

            S.update(update=upd(), latest=upd(id=OTHER_ID))
            body = await go(page, EDIT)
            check(f"open: newer update exists {t}", "Cannot edit — A newer update exists." in body)
            S.update(update=upd(review_id=OTHER_ID), latest=upd())
            body = await go(page, EDIT)
            check(f"open: update from another review {t}", "different review" in body)
            S.update(update=upd(user_id=OTHER_ID), latest=upd())
            body = await go(page, EDIT)
            check(f"open: someone else's update {t}", "You can only edit your own update" in body)
            S.update(update=None, latest=None)
            body = await go(page, EDIT)
            check(f"open: missing update {t}", "Update not found" in body)
            S.update(updates_error=True)
            body = await go(page, EDIT)
            check(f"open: network failure → Retry {t}", "Retry" in body and "not found" not in body.lower())
            S.update(updates_error=False)

            check(f"no page errors {t}", not errs, "; ".join(errs[:2]))
            await ctx.close()
        await b.close()
    print("\nIntercepted write attempts (none reached the server):", len(blocked_writes))
    for w in blocked_writes[:12]: print("  ", w)
    failed = [r for r in results if r[3] and not r[1]]
    print(f"\nRequired: {len(results) - len(failed)} passed, {len(failed)} failed")
    sys.exit(1 if failed else 0)

asyncio.run(main())
