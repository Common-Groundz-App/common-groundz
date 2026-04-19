

## Verdict: Try one quick targeted fix, then move on if it doesn't work

ChatGPT is right that you shouldn't sink more time into this. But the proposed fixes are mostly off-target for our specific situation. Let me explain what's actually happening and what the minimal correct fix is.

### What the console log actually means

The error `"HTML5 Audio pool exhausted, returning potentially locked audio object"` is firing **4 times on page load** — before any sign-in. That's our `preloadSounds()` running on app boot, hitting Howler's default HTML5 audio pool limit.

Looking at `feedbackService.ts`:
- We use `html5: true` for every Howl (mobile compatibility)
- Default Howler HTML5 pool size is 10
- We preload 4 sounds + each play creates additional audio nodes
- On iOS especially, the pool gets exhausted and Howler returns "locked" objects that won't play

### What's wrong with ChatGPT's suggestions

- **Fix 1 (`Howler.pool = 5`)** — Wrong direction. Lowering the pool makes exhaustion *worse*. Should *increase* it.
- **Fix 2 (reuse instances)** — We already do this. `soundCache` Map caches every Howl by src.
- **Fix 5 (MP3 instead of WAV)** — Possible but requires re-uploading 4 files. Not worth it as first try.

### The actual minimal fix

Two small changes in `src/services/feedbackService.ts`:

**Change 1: Increase Howler's HTML5 audio pool**
At the top of the file (after the Howler import), add:
```ts
// Default pool of 10 gets exhausted quickly with html5:true on iOS.
// Bump to 20 to prevent "Audio pool exhausted" errors.
Howler.html5PoolSize = 20;
```

**Change 2: Don't keep `html5: true` for the deferred signin sound path**

The root cause of the "locked audio object" warning is `html5: true` combined with iOS's strict gesture requirements. For the signin sound specifically (which now fires inside a `pointerdown` handler — a guaranteed user gesture), we can use Web Audio instead, which is more reliable post-gesture.

Simplest approach: keep current behavior for all sounds, just bump the pool. If that alone fixes it, done. If not, we accept the limitation for Google OAuth signin sound only.

### What I'm NOT going to do
- Convert WAV → MP3 (no evidence the files are bad — post/comment/email signin all work)
- Refactor the sound architecture
- Add visual fallback ("Welcome back" toast) — out of scope, you already declined this earlier
- Touch any other sound flow (post, comment, email signin, logout all work)

### One-line change, then verify

Just add `Howler.html5PoolSize = 20;` near the top of `feedbackService.ts`. That's the entire change.

### Verification
1. Reload the app — console should show fewer or no "Audio pool exhausted" warnings
2. Sign in with Google → tap anywhere → listen for signin sound
3. Confirm post/comment/email signin/logout sounds still work (no regression)
4. If Google signin sound still silent after this → **stop here, accept it, move on.** ChatGPT's mindset advice is correct: this is polish, not core product. The pending-flag + deferred-interaction architecture is sound; if iOS Chrome still won't cooperate, that's a browser limitation, not an architecture problem.

