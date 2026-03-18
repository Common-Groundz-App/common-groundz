# Phase 2 Plan — Final Assessment

Both of ChatGPT's suggestions are valid and easy to incorporate. Neither requires structural changes — they're styling and copy decisions.

## What to add

**1. OfflineInlineState stays compact and non-blocking**
Already implied by the "calm muted card" design, but worth making explicit: the component should be a single-line banner-style element (not a large card), rendered above content — never replacing it. Think toast-height, not alert-height. No padding-heavy card layout.

**2. Standardized copy across all surfaces**
Define one canonical message pattern used everywhere:

- Feed: "You're offline — showing last updated posts"
- Notifications: "You're offline — showing recent notifications"
- Explore/Discovery: "You're offline — showing recent results"

Same structure, same tone, surface-specific noun. This is just a copy convention applied during implementation.

## Verdict

Both items are small refinements to the existing plan — no new files, no architectural changes. They should be noted as implementation guidelines when building `OfflineInlineState.tsx` and wiring it into each surface.

**No other additions needed. The Phase 2 plan is complete and ready to implement.**