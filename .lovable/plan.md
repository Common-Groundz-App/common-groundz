# Hide the bottom tab bar while a comment composer is focused (revised)

Both reviews are right, and the revised approach is better than my first draft. Adopting all of it: mobile-only, centralized composer-activity state instead of per-textarea boolean events, `null` render instead of visual hiding, defensive resets, and no `scrollIntoView` in the first pass.

## Why the current behaviour looks broken

`BottomNavigation` is `fixed bottom-0`. When the keyboard opens, mobile browsers expose a smaller visual viewport, so the fixed tab bar lands immediately above the keyboard and competes with the comment row (which is a normal in-flow element, not a docked composer). Three interaction layers stack up, the composer gets squeezed, and a mis-tap on a tab discards what was typed. Polished social apps prioritise the active writing surface and hide the tab bar during composition.

## Approach

### 1. One composer-activity source of truth

New `src/contexts/ComposerFocusContext.tsx` (provider mounted in `App.tsx` alongside the existing providers):

- Holds a `Set<string>` of active composer ids; exposes `isComposerActive`, plus `activate(id)` / `deactivate(id)`.
- Ref-count semantics, so main → reply → edit transitions never report "inactive" while another composer holds focus.
- Resets the set on `location.pathname` change and on provider-level cleanup.

Hook `useComposerFocusRegion(id)` returns props for the **composer container**, not each textarea: `onFocusCapture` → `activate(id)`, `onBlurCapture` → deferred check with `requestAnimationFrame`; if `document.activeElement` is still inside the container, stay active. This is what makes focus moving into the mention popup, the send button, or reply controls a no-op. `useEffect` cleanup calls `deactivate(id)` on unmount.

Mobile-only: the hook only activates when `useIsMobile()` is true, so desktop/tablet behaviour is byte-identical to today.

### 2. Wire the composer regions

`src/components/comments/InlineCommentThread.tsx` — wrap the three composer regions with the region props:

- main comment row (`id: 'comment-main'`)
- reply row (`id: 'comment-reply'`)
- edit row inside `CommentItem` (`id: 'comment-edit'`), driven from the thread since the edit state lives there

Explicit `deactivate` calls after submit, after reply cancel, and after edit cancel/save, so the nav returns even if focus is retained. `requireAuth()` stays the first statement in the existing `onFocus` handler — unchanged.

### 3. Bottom navigation consumes it

`src/components/navigation/BottomNavigation.tsx` — read `isComposerActive` and `return null` when true. Returning `null` (rather than `hidden`) also removes it from the tab order and the accessibility tree, so a screen-reader or hardware-keyboard user can't land on a tab that isn't visible. The page-level `pb-[calc(4rem+...)]` in `PostView.tsx` stays as is — removing it dynamically would make the page jump.

### 4. No scroll correction yet

iOS already scrolls a focused input into view. Adding a smooth scroll fights the keyboard animation. Deferring this; if real-device testing still shows the composer clipped, we add a conditional, measurement-gated nudge (`block: 'nearest'`, mobile only, after `requestAnimationFrame`) as a follow-up.

## Explicitly unchanged

Viewport meta, the 16px mobile textarea font fix, comment behaviour, mention autocomplete, layout widths, and padding.

## Verification (mobile Safari + iOS Chrome)

1. Tap the main comment box → tab bar disappears, composer visible above keyboard.
2. Dismiss keyboard / tap elsewhere → tab bar returns.
3. Submit a comment → tab bar returns.
4. Tap Reply, then a comment's Edit → tab bar hides in both.
5. Move between main / reply / edit fields → no flicker of the tab bar.
6. Type `@` → mention autocomplete opens and selecting a name does not restore the tab bar mid-typing.
7. Guest tap on the composer → auth prompt appears, tab bar not stuck hidden.
8. Navigate to Home while a composer was focused → tab bar present on the new page.
9. Desktop and tablet: no visible change.
