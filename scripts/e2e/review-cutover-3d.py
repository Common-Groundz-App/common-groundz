"""
Step 3D cutover browser check (switch on and off).

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
OUT = Path("/tmp/browser/cutover3d"); OUT.mkdir(parents=True, exist_ok=True)
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
def iso(minutes_ago): return (datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(minutes=minutes_ago)).isoformat() + "Z"
REVIEW = {"id": REVIEW_ID, "user_id": UID, "entity_id": PLACE_ID, "category": "place", "title": "Ambur", "venue": None,
          "subtitle": "", "description": "first", "rating": 4, "media": [], "image_url": None, "visibility": "public",
          "experience_date": None, "metadata": {}, "status": "published", "created_at": iso(600),
          "has_timeline": True, "timeline_count": 1}
S = {"flag": False, "update": None, "latest": None, "updates_error": False, "rpc": {"status": "ok"}, "hang": False}
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
            if S["hang"]: await asyncio.sleep(23)
            return await r.fulfill(json=S["rpc"])
        return await r.fulfill(json={"reviews": {"composer_page_enabled": S["flag"]}} if name == "get_public_flags" else None)
    if req.method not in ("GET", "HEAD", "OPTIONS"):
        blocked_writes.append(f"{req.method} {url.split('?')[0]}")
        if S["hang"]: await asyncio.sleep(23)
        return await r.fulfill(status=403, body='{"message":"blocked by e2e"}', content_type="application/json")
    if "/rest/v1/review_updates" in url:
        if S["updates_error"]: return await r.fulfill(status=500, json={"message": "down"})
        row = S["latest"] if "limit=1" in url else S["update"]
        return await r.fulfill(json=row if single else ([row] if row else []))
    if "/rest/v1/reviews" in url: return await r.fulfill(json=REVIEW if single else [REVIEW])
    if "/rest/v1/entities" in url and (PLACE_ID in url or "ambur" in url): return await r.fulfill(json=PLACE if single else [PLACE])
    if "/rest/v1/profiles" in url: return await r.fulfill(json=PROFILE if single else [PROFILE])
    if "/rest/v1/" in url:
        return await r.fulfill(status=406 if single else 200, json={"code":"PGRST116"} if single else [])
    if "/storage/v1/" in url or "/functions/v1/" in url:
        blocked_writes.append(f"{req.method} {url}")
        return await r.fulfill(status=403, body="{}", content_type="application/json")
    return await r.continue_()


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail else ""))

async def fresh(ctx):
    page = await ctx.new_page()
    await page.goto(BASE + "/", wait_until="domcontentloaded")
    await page.evaluate(f"localStorage.setItem('sb-{REF}-auth-token', {json.dumps(json.dumps(SESSION))})")
    return page

async def go(page, path, wait=1500):
    await page.goto(BASE + path, wait_until="domcontentloaded"); await page.wait_for_timeout(wait)
    return await page.inner_text("body")

async def home_review(page):
    await go(page, "/home", 2500)
    await page.get_by_role("button", name="Create").first.click(); await page.wait_for_timeout(400)
    await page.get_by_role("button", name="Review").click(); await page.wait_for_timeout(1500)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        for width in (390, 1280):
            t = f"@{width}"
            for flag in (False, True):
                S["flag"] = flag
                ctx = await b.new_context(viewport={"width": width, "height": 1800})
                await ctx.route("**/*.supabase.co/**", route)
                page = await fresh(ctx)
                tag = f"{'ON' if flag else 'OFF'} {t}"
                body = await go(page, "/review", 2500)
                check(f"/review gate {tag}", ("Not available yet" in body) != flag, page.url)
                if width == 1280:
                    try:
                        await home_review(page)
                        dialogs = await page.get_by_role("dialog").count()
                        if flag: check(f"home Create→Review opens the page {tag}", page.url.endswith("/review") and dialogs == 0, page.url)
                        else: check(f"home Create→Review opens the popup {tag}", "/home" in page.url and dialogs >= 1, page.url)
                        await page.screenshot(path=str(OUT / f"home-review-{tag.replace(' ','_')}.png"))
                    except Exception as e:
                        check(f"home Create→Review {tag}", False, str(e)[:160])
                await go(page, "/entity/ambur?compose=update", 4000)
                if flag: check(f"?compose=update owner → timeline page {tag}", f"/review/{REVIEW_ID}/timeline/new" in page.url, page.url)
                else: check(f"?compose=update stays on entity page {tag}", "/entity/" in page.url, page.url)
                await page.screenshot(path=str(OUT / f"compose-update-{tag.replace(' ','_')}.png"))
                await ctx.close()
        await b.close()
    print("writes blocked:", len(blocked_writes))
    failed = [r for r in results if not r[1]]
    print(f"{len(results)-len(failed)}/{len(results)} passed")
    sys.exit(1 if failed else 0)

asyncio.run(main())
