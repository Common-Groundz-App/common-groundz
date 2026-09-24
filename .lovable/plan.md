# Group 6B — retire the old entity pages v1, v2, v3 (V4 stays, untouched)

## 6A check result

6A is complete with no leftovers. The outside-result search rows and both lists in the My Stuff picker no longer contain "No Image", stock photos, `/placeholder.svg` or the old picture helper. The picker gives back a real picture, a map photo for places and food, or nothing at all. Its test file is registered and passing.

## Your main worry: the real entity page is safe

Your Isha Foundation page is the **V4 page**. All three of these addresses show it today and will keep showing it after 6B:

- `commongroundz.co/entity/isha-foundation-chikkaballapura`
- `/entity/isha-foundation-chikkaballapura`
- `/entity/isha-foundation-chikkaballapura?v=4`

This is why it is safe:

- The V4 page is stored in its own folder (`entity-v4`), away from the old pages. **6B does not delete, move or edit anything in that folder.**
- Both entity addresses (`/entity/name` and `/entity/parent/child`) point to one small "doorway" file. Today the doorway checks whether you are an internal team member who typed `?v=1/2/3`. If you are not, it opens V4. After 6B the doorway always opens V4, **whatever is typed after the address**.
- Today, anyone who is not on the internal team already sees V4 for every address, including `?v=1`. So for real users nothing changes at all.
- `?v=4`, `?v=1`, `?preview=true` and any other extra text keep working, and all of them show V4. None of them leads to an error page.

## What gets deleted (exact list)

| Item | What it is | Who can see it today |
|---|---|---|
| The v1 page (the big old block inside the doorway file) | First entity page design | Internal accounts only, with `?v=1` |
| `EntityDetailV2` page | Second design | Internal accounts only, with `?v=2` or `?preview=true` |
| `entity-v3` folder (2 files) | Third design | Internal accounts only, with `?v=3` |
| The version switch helper | Decides v1/v2/v3/v4 | Used only by the doorway |

What stays: the doorway file (made much smaller and only opening V4), the V4 folder, the V4 loading screen, the data loaders V4 uses, the old-link redirect service, and any shared piece the old pages used that other screens also use.

## Steps

1. **Proof before deleting.** List every place that points at the four items above: links, tests, notes and delayed loading. Confirm each shared piece they use (for example the "related" card, the data loader, the loading screens) is either still used by V4 or other screens, which means it stays, or is used only by the old pages, which means it is recorded and **kept for now** and not deleted in this step.
2. **Shrink the doorway** so it always opens V4 with the same loading screen as today.
3. **Delete** v1, v2, v3 and the version switch.
4. **Check these all still work exactly as today:**
   - `/entity/isha-foundation-chikkaballapura`, with `?v=4`, `?v=1`, `?v=2`, `?v=3`, `?preview=true` and `?v=junk` added. All show V4.
   - Sub-item addresses (`/entity/parent/child`)
   - Old renamed addresses that redirect to the new name
   - Addresses that use an ID instead of a name
   - The loading screen and the "not found" screen
   - Signed-in and signed-out views
   - Page title and share preview
5. Update the notes that mention the old versions (the verification documents), then stop and report to you.

## Technical details

- Keep `src/pages/EntityDetail.tsx` as the route element, reduced to: `React.lazy(() => import('@/components/entity-v4/EntityV4'))` hoisted to module scope (it is currently created inside render), wrapped in the existing `Suspense` + `EntityV4LoadingWrapper` with `formatSlugAsName` display name. `App.tsx` routes at lines 191–192 are unchanged.
- Delete: `EntityDetailOriginal` (lines ~56–999 of EntityDetail.tsx) and its now-unused imports, `src/pages/EntityDetailV2.tsx`, `src/components/entity-v3/EntityV3.tsx` + `EntityV3Header.tsx`, `src/utils/entityVersionUtils.ts`.
- Untouched: `src/components/entity-v4/**`, `use-entity-detail(-cached)`, `entityRedirectService`, `EntityV4LoadingWrapper`, `EntityDetailSkeleton`, `EntityRelatedCard` (EntitySidebar still mounts it).
- Orphans found in step 1 are recorded in the inventory for the later cleanup plan, not deleted here.
- Tests: a new route test mounting `/entity/:slug` and `/entity/:parent/:child` under MemoryRouter with each query variant, which asserts V4 renders (V4 is mocked); a zero-import check for deleted modules; full suite, typecheck and build log. Docs to update: `entity-image-fallback-inventory.md`, `roadmap.md`, and historical mentions in `phase-0-taxonomy-audit.md` and `phase-4-*` (annotated as "retired in 6B", not rewritten).

After 6B: 6C (unused product row and old recommendation form), 6D (admin, decided row by row), 6E (entity tab child cards), then the cleanup list from the Group 6 plan.
