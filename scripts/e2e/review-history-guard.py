"""
Review composer Back-guard browser check (3B close-out).

Run against the dev server:  python3 scripts/e2e/review-history-guard.py
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
OUT = Path("/tmp/browser/review-guard"); OUT.mkdir(parents=True, exist_ok=True)
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

blocked_writes = []
results = []

async def route(r):
    req = r.request; url = req.url
    if req.method not in ("GET", "HEAD", "OPTIONS") and "/rpc/" not in url and "/auth/v1/" not in url:
        blocked_writes.append(f"{req.method} {url}")
        return await r.fulfill(status=403, body='{"message":"blocked by e2e"}', content_type="application/json")
    if "/auth/v1/user" in url: return await r.fulfill(json=USER)
    if "/auth/v1/" in url: return await r.fulfill(json=SESSION)
    if "/rpc/has_role" in url: return await r.fulfill(json=True)
    if "/rpc/" in url:
        name = url.split("/rpc/")[1].split("?")[0]
        if name in ("get_public_flags",): return await r.fulfill(json={})
        if req.method != "GET" and name not in ("get_public_flags","has_role","is_admin"):
            pass
        return await r.fulfill(json=None)
    if "/rest/v1/profiles" in url:
        single = "vnd.pgrst.object" in (req.headers.get("accept") or "")
        return await r.fulfill(json=PROFILE if single else [PROFILE])
    if "/rest/v1/" in url:
        single = "vnd.pgrst.object" in (req.headers.get("accept") or "")
        return await r.fulfill(status=406 if single else 200, json={"code":"PGRST116"} if single else [])
    if "/storage/v1/" in url or "/functions/v1/" in url:
        blocked_writes.append(f"{req.method} {url}")
        return await r.fulfill(status=403, body="{}", content_type="application/json")
    return await r.continue_()

def check(name, ok, detail="", required=True):
    results.append((name, bool(ok), detail, required))
    print(("PASS " if ok else ("FAIL " if required else "NOTE ")) + name + (f" — {detail}" if detail else ""))

async def composer_visible(page):
    return await page.get_by_role("heading", name="Write a review").count() > 0

async def make_dirty(page):
    # rating step: pick a rating so the form has something to lose
    btn = page.locator("#composer-section-rating svg g[style*=transform-origin]").nth(3)
    await btn.click(force=True)
    await page.wait_for_timeout(200)

async def dialog_text(page):
    d = page.get_by_role("alertdialog")
    if await d.count() == 0: d = page.get_by_role("dialog")
    return (await d.inner_text()) if await d.count() else ""

async def fresh(ctx, start="/home"):
    page = await ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    await page.goto(BASE + "/", wait_until="domcontentloaded")
    await page.evaluate(f"localStorage.setItem('sb-{REF}-auth-token', {json.dumps(json.dumps(SESSION))})")
    await page.goto(BASE + start, wait_until="networkidle")
    return page, errors

async def open_in_app(page):
    # in-app navigation to the composer (no reload)
    await page.evaluate("window.history.pushState({usr:null,key:'e2e',idx:1},'', '/review'); window.dispatchEvent(new PopStateEvent('popstate'))")
    await page.wait_for_timeout(1200)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        for width in (390, 1280):
            ctx = await b.new_context(viewport={"width": width, "height": 1800})
            await ctx.route("**/*.supabase.co/**", route)
            tag = f"@{width}"

            # 1. typed address, clean → Back leaves
            page, errs = await fresh(ctx, "/home")
            await page.goto(BASE + "/review", wait_until="networkidle")
            await page.screenshot(path=str(OUT / f"open{width}.png"))
            check(f"composer opens {tag}", await composer_visible(page), page.url)
            if not await composer_visible(page):
                await ctx.close(); continue
            await page.go_back(); await page.wait_for_timeout(600)
            check(f"clean Back leaves {tag}", not await composer_visible(page), page.url)

            # 2. dirty → Back → Keep x3
            await page.goto(BASE + "/review", wait_until="networkidle")
            await make_dirty(page)
            ok = True
            for i in range(3):
                await page.go_back(); await page.wait_for_timeout(500)
                txt = await dialog_text(page)
                vis = await composer_visible(page)
                print(f"   keep-iter {i}: visible={vis} url={page.url} dialog={txt[:40]!r}")
                ok = ok and vis and "Discard your draft?" in txt
                if i == 0: await page.screenshot(path=str(OUT / f"dirty-dialog{width}.png"))
                await page.get_by_role("button", name="Keep editing").click(); await page.wait_for_timeout(300)
            check(f"dirty Back → Keep ×3 stays {tag}", ok, page.url)

            # 3. Back → Discard leaves, no review entry ahead of Back
            await page.go_back(); await page.wait_for_timeout(500)
            await page.get_by_role("button", name="Discard").click(); await page.wait_for_timeout(1500)
            check(f"Back → Discard leaves {tag}", not await composer_visible(page), page.url)
            # Forward into the old guard entry: fresh form, no dialog
            await page.go_forward(); await page.wait_for_timeout(800)
            fwd_ok = (not await composer_visible(page)) or (await dialog_text(page)) == ""
            check(f"Forward after Discard shows no stale dialog {tag}", fwd_ok, page.url)

            # 4. Cancel while dirty → confirm
            await page.goto(BASE + "/review", wait_until="networkidle")
            await make_dirty(page)
            await page.get_by_role("button", name="Cancel").first.click(); await page.wait_for_timeout(300)
            check(f"Cancel while dirty asks first {tag}", "Discard your draft?" in await dialog_text(page))
            await page.get_by_role("button", name="Discard").click(); await page.wait_for_timeout(1500)
            check(f"Cancel → Discard leaves {tag}", not await composer_visible(page), page.url)

            # 5. dirty → clean again → single Back leaves
            await page.goto(BASE + "/review", wait_until="networkidle")
            await make_dirty(page)
            # reload drops the form (beforeunload is auto-accepted in headless)
            page.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
            await page.reload(wait_until="networkidle")
            check(f"reload keeps page usable {tag}", await composer_visible(page), page.url)

            # 6. rapid double Back (reported, required by plan as its own case)
            await make_dirty(page)
            await page.evaluate("history.back(); history.back();")
            await page.wait_for_timeout(1200)
            await page.screenshot(path=str(OUT / f"rapid{width}.png"))
            print("   rapid dialog:", (await dialog_text(page))[:60])
            check(f"rapid double Back stays on the form {tag}", await composer_visible(page), page.url, required=False)

            check(f"no page errors {tag}", not errs, "; ".join(errs[:2]))
            await ctx.close()
        await b.close()

    print("\nBlocked writes:", len(blocked_writes))
    for w in blocked_writes[:10]: print("  ", w)
    failed = [r for r in results if r[3] and not r[1]]
    rapid = [r for r in results if not r[3]]
    print(f"\nRequired: {len([r for r in results if r[3]]) - len(failed)} passed, {len(failed)} failed")
    for r in rapid: print("Rapid double-Back:", "protected" if r[1] else "ESCAPES (failing acceptance case)", r[0])
    sys.exit(1 if failed or any(not r[1] for r in rapid) else 0)

asyncio.run(main())
