# Hide the bottom tab bar while a comment composer is focused (v3)

Both follow-up reviews are right on all counts. Folding in the breakpoint mismatch, the submit-with-retained-focus problem, instance-safe ids, and the guest-auth ordering detail.

## Why the current behaviour looks broken

`BottomNavigation` is `fixed bottom-0`. When the keyboard opens, the browser exposes a smaller visual viewport, so the tab bar lands directly above the keyboard and competes with the in-flow comment row. Three layers stack, the composer is squeezed, and a mis-tap on a tab discards what was typed. Polished social apps prioritise the active writing surface and hide the tab bar during composition.

## Approach

### 1. Router-scoped composer-activity context

New `src/contexts/ComposerFocusContext.tsx`, mounted in `App.tsx` **inside** `<Router>` (it uses `useLocation`) and around the routes:

- Holds a `Set<string>` of active composer region ids — active-source semantics, idempotent `activate(id)` / `deactivate(id)`, not a counter.
- Exposes `isComposerActive` plus the two actions.
- Clears the whole set on `location.pathname` change (defensive, so the nav can never stay hidden across navigation).

Hook `useComposerFocusRegion(id)` returns props for the **composer container**:

- `onFocusCapture` → `activate(id)`, but only when the focus target is an actual editable element inside the region, so a click on a wrapper doesn't activate.
- `onBlurCapture` → deferred check via `requestAnimationFrame`; if `document.activeElement` is still inside the container ref, stay active, otherwise `deactivate(id)`. This is what makes focus moving into the send button or reply controls a no-op.
- `useEffect` cleanup → `deactivate(id)` on unmount, which is how reply/edit rows (removed from the DOM on cancel/save) release naturally.

### 2. No viewport gate — align with the nav's own breakpoint

Dropping `useIsMobile()`: it flips at 768px while `BottomNavigation` is `xl:hidden` (1280px), which would leave 768–1279px tablets with the original awkward behaviour. The context tracks focus with no viewport logic; `BottomNavigation` alone decides, and since it is already CSS-hidden above `xl`, no extra gate is needed.

### 3. Genuinely instance-safe region ids

Database ids alone aren't enough — the same thread can mount twice (page + dialog). And the component's prop is `itemId` (it serves posts *and* recommendations), not `postId`. So each mounted `InlineCommentThread` generates a `useId()` instance prefix and composes:

- main: `${instanceId}:${itemType}:${itemId}:main`
- reply: `${instanceId}:${itemType}:${itemId}:reply:${parentCommentId}`
- edit: `${instanceId}:${itemType}:${itemId}:edit:${comment.id}`

### 4. Submit keeps the region active while the textarea stays focused

The main submit path clears the text but does not blur. Deactivating there would pop the tab bar back above a still-open keyboard, and since no new focus event fires it would never re-hide. So there is no explicit deactivate on submit — the region stays active while focus stays inside, which also lets the user post a second comment without reopening the keyboard. Reply/edit cancel and save release naturally through unmount cleanup.

### 5. Guest gating via a generic hook option, not auth knowledge


The hook stays auth-agnostic: it takes `enabled` and simply never activates when `enabled` is false. `InlineCommentThread` passes `enabled: Boolean(user)`, so a guest's transient focus never hides the nav and the hook stays reusable for other composers.

For accuracy: the existing textarea `onFocus` does *not* call `requireAuth()` first — it currently clears the draft, calls `requireAuth(...)`, then blurs the textarea. That handler is left exactly as is; the `enabled` gate is what protects the nav.


### 6. Consume it in the nav

`src/components/navigation/BottomNavigation.tsx` reads `isComposerActive` and returns `null` when true — this also removes it from pointer, tab order, and the accessibility tree, unlike a visual `hidden`. The page-level `pb-[calc(4rem+...)]` in `PostView.tsx` stays, so nothing jumps.

### 7. No scroll correction in this pass

iOS already scrolls the focused input into view; an extra smooth scroll fights the keyboard animation. If real-device testing still shows clipping, we add a measurement-gated nudge (`block: 'nearest'`, after `requestAnimationFrame`) as a follow-up.

## Files touched

- `src/contexts/ComposerFocusContext.tsx` (new — provider + `useComposerFocusRegion`)
- `src/App.tsx` (mount provider inside `<Router>`)
- `src/components/comments/InlineCommentThread.tsx` (wire main / reply / edit regions)
- `src/components/comments/CommentItem.tsx` (accept region props for the edit row)
- `src/components/navigation/BottomNavigation.tsx` (return `null` while active)
- Tests — context reducer tests are not enough, so add hook/component integration tests (Testing Library) covering: capture-phase focus activation, deferred blur with an explicitly flushed `requestAnimationFrame`, unmount cleanup, retained focus after submit, `enabled: false` guest regions, route reset, two overlapping thread instances, and `BottomNavigation` rendering `null` while active.

## Scope note: this tracks focus, not the keyboard

The model is composer *focus*, which is the right first-pass tradeoff. Detecting actual software-keyboard visibility would need a separate `visualViewport` mechanism with many more edge cases. So the promise is "blur the composer → nav returns", not "any keyboard-dismissal gesture → nav returns"; some browser/keyboard combinations retain element focus. If device testing shows dismissal frequently retains focus, keyboard-visibility detection becomes a follow-up.

## Explicitly unchanged

Viewport meta, the 16px mobile textarea font fix, comment behaviour, mention autocomplete, layout widths, and padding.

## Verification (physical iOS/iPadOS, Safari + Chrome)

1. Tap the main comment box → tab bar disappears; composer visible above keyboard.
2. Blur the composer by tapping elsewhere on the page → tab bar returns.
3. Submit a comment with focus retained → tab bar stays hidden, keyboard stays open, typing again works; blurring restores the nav.
4. Reply composer and a comment's Edit composer → tab bar hides in both; cancel restores it.
5. Move between main / reply / edit regions → no flicker.
6. Type `@` → autocomplete opens and selecting a name does not restore the tab bar.
7. Guest tap on the composer → auth prompt appears and the tab bar is never hidden.
8. Navigate to Home while a composer was focused → tab bar present on the new page.
9. iPad at ~1024px width → same suppression as phone (this is the breakpoint fix).
10. Desktop above `xl` → no change.
