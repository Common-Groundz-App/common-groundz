# Phase 11.3 — Profile and Review Details Helpful

## Scope delivered
- Both Profile Review card layouts replace legacy Heart, dummy comment count and dead Share with the existing Helpful control. View Details, Timeline entry points and owner actions are unchanged.
- Details displays exactly one root-review Helpful control; Timeline Updates have no votes.
- Public authors see passive counts including zero; Private reviews render no Helpful; guests use the existing authentication prompt.
- Both installed `fetchUserReviews` implementations use the existing secured read helper, including guest aggregate reads and authenticated-only viewer selection. RPCs/RLS are unchanged.
- `performHelpfulToggle` remains the only mutation orchestrator. A QueryClient-scoped session coordinator shares pending state across cards, providers and portals. One snapshot assignment updates the canonical Helpful query and matching initiating-viewer Entity/Profile partitions, never another viewer's selection.
- Details seeds from the current viewer's cache, reconciles with authoritative reads, and shows a skeleton if unknown. Cancellation plus session epoch/root revision guards reject stale reads; reader-summary/intent requests are also scoped to the current modal opening/review/account.
- The app-level coordinator cancels/removes previous viewer partitions on account change even away from Entity/Profile pages. A → B → A callbacks cannot restore the old selection.
- No Helpful change events are emitted, so broad rating/trust invalidation is not used for voting and no notification bridge can independently increment the count.

## Automated evidence
- New focused suites: 18 tests covering guest aggregate RPC reads, viewer-scoped cache assignment, Public/Private author/reader/guest rules, both profile card layouts, root Details integration, immediate shared counts/pending locks, single optimistic increments, rejection/timeout reconciliation, missing initial data, modal closure/review changes, auth resolution and account-switch isolation.
- Existing Phase 11.2 control/orchestration, Timeline and review suites remain in the full regression gate.
- Full-suite final result: awaiting final run below.
- Automatic preview compilation/typecheck feedback: latest build log reports `build OK` after correcting test-interface errors. Separate manual TypeScript and production-build commands are prohibited by this environment; no independent production-build pass is claimed.

## Browser evidence and limitations
- Real guest: `/entity/nandi-hills` → View Details → Helpful displays one root control → tapping opens the existing “Sign up to continue” prompt; no runtime errors observed.
- Details checked at 963×851, mobile 390×844 and desktop 1280×900; Helpful target remains 44px high and no horizontal page overflow was detected. Light/dark screenshots captured. The existing Details content has legacy dark-theme styling; no unrelated theme refactor was made.
- Real guest profile `/u/rishab.devp?tab=reviews` currently displays the existing sign-in gate rather than Profile Review cards. This gate was preserved. Guest counts/auth behavior on the cards is proven by executable fixtures, not a real guest profile browsing claim.
- **BLOCKED:** real signed-in Profile vote/unvote, author counts, Private details, cross-account live vote/readback and signed-in mobile/desktop theme acceptance. `lovable auth-session --json --self` refused because this user-managed Supabase project cannot receive minted Lovable sessions. No credentials requested; no fixture claimed as a real authenticated test.
- **PENDING:** independent production build and standalone TypeScript evidence; real overlapping database-session concurrency remains the earlier Phase 11.5 gate, not passed here.

## Stop boundary
Phase 11.4 sorting, Review comments, named voters, Circle proof and new badges were not started. Connected Rings, recommendation signals, visibility architecture, edit rules and Mux/media pipelines were not changed.