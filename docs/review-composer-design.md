# Step 3.0 — Review composer design gate

Status: **awaiting approval**. No product behaviour, route, form or database change was made producing this document. Everything below was read from the current code (`ReviewForm.tsx`, `steps/*`, `ReviewTimelineViewer.tsx`, `services/review/*`) and the live database (functions, triggers, RLS policies) on 2026-10-04.

---

## 1. Current field matrix

Legend: **R** = review create, **RE** = review edit, **T** = timeline create, **TE** = timeline edit.

| Field | R | RE | T | TE | Stored in | Required | Default | Notes |
|---|---|---|---|---|---|---|---|---|
| Rating (1–5 rings) | Step 1 | Step 1 | yes | yes | `reviews.rating` / `review_updates.rating` | R/RE yes (blocks Next); T/TE optional | 0 / null | T omits column when unset. TE RPC accepts null. |
| Subject | Step 2 picker (locked from entity page) | locked display | hidden (implicit) | hidden | `reviews.entity_id`, `category` | R yes | from entity page or none | Identity immutable in DB for every writer. |
| Identity title / venue | derived | derived (legacy-unlinked: editable) | — | — | `reviews.title`, `venue` | derived | from subject | DB rejects any change (`review_identity_locked`). Legacy-unlinked editability is therefore UI-only today — see finding F4. |
| Subject preview + location prompt | Step 3 | Step 3 | — | — | — | — | — | Read-only. |
| Photos / video | Step 3, max 4 | Step 3 | yes, max 4 | yes | `reviews.media` (+ `image_url` = first item) / `review_updates.media` | no | [] | R from entity page with no photo copies the **entity image** into review media — finding F5. |
| Headline | Step 4 | Step 4 | — | — | `reviews.subtitle` | no | '' | |
| Written text | Step 4 "description" | Step 4 | "Update comment" | same | `reviews.description` / `review_updates.comment` | R/RE no; T/TE **yes** (trimmed, DB-checked on TE) | '' | |
| Experience date | Step 4 | Step 4 | — | — | `reviews.experience_date` | no | none | |
| Questionnaire (choices + curated tags) | Step 4 | Step 4 | — | — | `reviews.metadata.questionnaire` envelope | no | per registry | Dirty-field patching via `buildReviewMetadataForSave`. |
| Food tags | Step 4 (food) | Step 4 | — | — | `reviews.metadata.food_tags` | no | [] | |
| Visibility | Step 4 | Step 4 | — | — | `reviews.visibility` | yes (always set) | public | Editable any time (not window-limited). |
| Recommendation | — (derived from rating) | — | Yes/Maybe/No chips + "Base on rating" | same | `review_updates.would_recommend` | no | omitted | T: unset → column omitted; reset → `'auto'`. TE: see finding F2. |

Current validation entry points: Step 1 rating ≠ 0; Step 2 subject required unless legacy-optional; invalid type blocks; legacy-unlinked title required; submit re-checks auth, existing review, category. Timeline: non-empty trimmed comment.

---

## 2. Capability + step table (proposed, parity-only)

`resolveComposerMode({ entryType, operation })` → one row. Presentation is not an input.

| Capability | create-review | edit-review | create-timeline-update | edit-timeline-update |
|---|---|---|---|---|
| subject | `select` (or `locked` when `initialEntityId`) | `locked` | `locked` (shown as header) | `locked` |
| rating | `required` | `required` | `optional` | `optional` |
| recommendation | `hidden` (rating-derived, as today) | `hidden` | `timeline` (chips + reset) | `timeline` |
| text | `review` (optional) | `review` | `what-changed` (required) | `what-changed` |
| headline | yes | yes | no | no |
| media | yes (max 4) | yes | yes (max 4) | yes |
| experienceDate | yes | yes | no | no |
| questionnaire / food tags | `full` | `full` | `hidden` | `hidden` |
| visibility | yes | yes | no (inherited) | no |
| submitLabel | Publish | Save changes | Add update | Save update |
| steps | `[['rating'],['subject'],['subjectPreview','media'],['headline','text','experienceDate','questionnaire','visibility']]` | same as create | `[['rating','recommendation','text','media']]` | same as create-timeline |

Parity rule: step contents and order equal today's. Reordering is a later config change, not part of Step 3.

---

## 3. State model

- **One central form store** keyed by section ID. Steps only reference section IDs; values never live inside step components.
- Per section: `{ value, initialValue, touched, error, dirty }` plus registry metadata: stable ID, `validate(state, mode)`, `hydrate(record) → value`, `serialize(value) → payload slice`, `visible(capabilities)`, accessible label/error id.
- Form-level: `mode`, `status: loading | ready | saving | ambiguous | blocked`, `blockedReason: expired | not_latest | not_found | unauthorized | subject_not_found | existing_review`, `sessionUploads: url[]` (files uploaded this session, for Cancel cleanup), `isDirty` (any section dirty).
- Moving between steps or reordering config never remounts values; uploads continue across steps.
- Hydration: edit modes load the record by ID from the server, then hydrate; navigation-state data is only a first-paint placeholder.
- Submit lock: `saving` disables Save from first tap until the server answers; `ambiguous` after timeout (see §8).

---

## 4. Exact save mappings (preserved from today)

**create-review → `createReview`** (insert `reviews`)
`{ title, subtitle, venue, description, rating, image_url, media, category, visibility, entity_id, experience_date, metadata, user_id }`
- `title`/`venue` from `resolveReviewIdentity`; `category` from persisted-category rules; `metadata` from `buildReviewMetadataForSave` (merge, never replace).
- `image_url` = first media URL; if none and opened from an entity page, currently the entity image (F5 — parity keeps it unless you decide otherwise).
- 23505 on `reviews_one_per_user_entity` → existing-review recovery, never a plain error.

**edit-review → `updateReview(id, …)`**
`{ title, subtitle, venue, description, rating, image_url, media, visibility, experience_date, metadata }` — `entity_id`/`category` never sent.
- `title`/`venue` are sent unchanged (DB rejects any change).
- `review_edit_window_closed` → blocked `expired` state with "add as timeline update" offer (as today).

**create-timeline-update → `addReviewUpdate`** (insert `review_updates`)
`{ review_id, user_id, comment (trimmed), media ([] if none), rating? (omitted if null), would_recommend? }`
- `would_recommend`: untouched/cleared → **omitted**; Yes/Maybe/No → value; reset → `'auto'`.

**edit-timeline-update → `editLatestReviewUpdate` RPC**
`(review_id, update_id, rating|null, comment (trimmed), media, would_recommend yes|maybe|no|null)`
- Full replace of the row's author fields; result `ok | expired | not_latest | unauthorized | conflict | error`.
- Reset/'auto' cannot be expressed today (F2).

"Left alone vs cleared": review edits send every field (full replace, as today); questionnaire is the only field-level patch (touched set). Timeline create distinguishes omitted (no statement) from explicit values only for `rating` and `would_recommend`.

---

## 5. Route, checks, Save / Cancel

| Address | Mode | Server checks (verified, §9) |
|---|---|---|
| `/review` | create-review | signed in; RLS `auth.uid() = user_id`; subject trigger; unique index |
| `/review?entityId=<uuid>` | create-review, subject locked | same; bad/unknown id → `subject_not_found`, "Pick another" replaces URL with `/review` |
| `/review/:reviewId/edit` | edit-review | owner via RLS; one-hour trigger; identity locked; admin see F1 |
| `/review/:reviewId/timeline/new` | create-timeline-update | RLS: inserter is review owner; no one-hour limit |
| `/review/:reviewId/timeline/:updateId/edit` | edit-timeline-update | RPC: owner, latest-only (under lock), own one-hour window |

| Mode | Save → | Cancel → |
|---|---|---|
| create-review | entity page | validated origin, else Home |
| edit-review | entity page | validated origin, else entity page |
| create/edit timeline | entity page + one-time `reopenTimeline` | entity page + one-time `reopenTimeline` |

Entity page URL is always built from persisted entity + parent slugs. `?compose=update`: unchanged until 3D; after cutover, owner → `/review/:id/timeline/new`, others → entity page.

---

## 6. Timeline-answer storage (write-up only, not built)

- Each update records only the structured answers it **changed** (patch keyed by field ID, versioned like the questionnaire envelope).
- The review holds the **current effective** answers (materialised on write, recomputed on edit/undo by the same locked recompute path).
- Untouched answers carry forward; history renders each update's patch.
- Open questions: edit/undo recompute order; unknown future field IDs; category/type compatibility; stats/aggregation source (current vs initial); recommendation precedence vs structured answers; legacy timelines with no patches. Requires its own approved migration.

---

## 7. Migration, rollback, retirement

1. 3A: new sections/store/registry/step engine alongside — legacy files untouched.
2. 3B: page + review modes; switch installed with release default `legacy` (requires adding `reviews.composer_page_enabled` to `get_public_flags` — F6 — and to admin `ALLOWED_KEYS`); test loaded on/off, loading, failure, direct routes.
3. 3C: timeline modes on the page; in-timeline form unchanged.
4. 3D: after all four pass: release default `page`, switch on; entry points route via one helper; viewer read-only while on.
5. Rollback: switch off → legacy popup + inline form exactly as today; direct routes keep working.
6. 3E (after your signed-in approval, target ≤ 2 weeks): delete legacy popup, inline form, switch, release default.

---

## 8. Safeguards (honest scope)

- Save locked while pending (all modes).
- Ambiguous timeout: keep form, show latest timeline entry, ask user to confirm before re-saving; **no** automatic retry. `addReviewUpdate` returns only a boolean (no id), confirming duplicate protection needs a server submission key — separate work.
- Cancel cleanup: best-effort delete of `sessionUploads` only, via existing owned-media cleanup; never pre-existing, kept, or cross-referenced media, external URLs or entity images. Tab close/crash needs a later scheduled sweep.

---

## 9. Verification of existing server rules

| Rule | Status | Where |
|---|---|---|
| Review one-hour edit window (owner) | ✅ | `enforce_review_edit_window` trigger, from `OLD.created_at` |
| Identity locked (user, entity, category, title, venue) | ✅ all writers | same trigger |
| System fields locked; metadata only `questionnaire`/`food_tags` writable | ✅ | same trigger |
| Status change only admin/moderator | ✅ | same trigger |
| Admin window bypass | ⚠️ partial — F1 | trigger allows; RLS UPDATE blocks non-owners |
| One review per user + subject | ✅ | `reviews_one_per_user_entity` |
| Timeline create = owner only | ✅ | RLS insert policy on `review_updates` |
| Timeline chronology server-owned, serialized | ✅ | `review_updates_before_insert` (advisory lock, `now()`) |
| Recommendation recompute on add/edit/undo | ✅ | after-insert trigger; RPCs call `recompute_review_timeline_state` |
| Timeline edit: owner, latest-only, own hour | ✅ | `edit_latest_review_update` |
| Timeline undo: owner, latest-only, lock | ✅ | `delete_latest_review_update` |
| Whole-thread delete, atomic, safe media list | ✅ | `delete_review_thread` (owner or admin) |
| No direct client UPDATE/DELETE on `review_updates` | ✅ | no such policies |

### Findings (reported, not fixed — your call)

- **F1 Admin edit bypass is incomplete.** The trigger exempts admins from the hour, but RLS UPDATE on `reviews` is `auth.uid() = user_id`, so an admin cannot edit another person's review from the app. The Step 2 menu shows admins an enabled Edit that would fail on others' reviews. Options: add an admin UPDATE policy (server change), or show admin Edit only on their own reviews.
- **F2 Timeline edit drops "Base recommendation on rating".** Today's edit sends `null` when reset is chosen, and the RPC rejects `'auto'`, so editing an update saved with the reset turns it into "no statement" — the previous explicit Yes/Maybe/No becomes authoritative again. Parity would preserve this bug; fixing needs the RPC to accept `'auto'` (server change).
- **F3 Timeline updates are readable by everyone.** `review_updates` SELECT policy is `true`, so updates on private / Circle-only reviews are readable by anyone with the review id. Privacy fix needs an RLS change mirroring the parent review's visibility.
- **F4 Legacy-unlinked title/venue editing is UI-only.** The form offers it, but the trigger rejects any title/venue change for every review. Saving such an edit fails. Recommend the new composer show them read-only.
- **F5 Entity photo copied into review media.** Creating from an entity page with no photos stores the entity image as the review's media/`image_url`. Parity keeps it unless you choose to drop it.
- **F6 Switch needs a DB change.** `get_public_flags` returns a fixed list; exposing `reviews.composer_page_enabled` requires extending it (small, approved at 3B).
- **F7 (minor)** Review form photo uploader regenerates its session id on every render (`sessionId={uuidv4()}`); harmless today, but the new page will use one stable session id for Cancel cleanup.

---

## 10. Parity checklist

- [ ] create from Home/Profile: pick, change, clear, background-create subject — URL stays `/review`
- [ ] create from entity page: locked subject; refresh keeps it; bad id → recover to `/review`
- [ ] existing-review notice + 23505 race recovery
- [ ] edit: hydration of every field incl. questionnaire/food tags; metadata keys preserved; identity unchanged
- [ ] edit at/after one hour → expired state with timeline offer; admin behaviour per F1 decision
- [ ] timeline add: comment required, rating optional, Yes/Maybe/No, tap-to-clear, reset → `'auto'`, omitted when untouched
- [ ] timeline edit: latest-only, own hour, not_latest/expired/conflict messages; F2 decision applied
- [ ] media: max 4, video limits, first image → `image_url`, F5 decision
- [ ] recommendation and live entity stats update after every save/undo
- [ ] Save/Cancel destinations and one-time timeline reopen (Back/Forward don't reopen)
- [ ] refresh and sign-in redirect on every route
- [ ] Save lock, ambiguous-timeout prompt, Cancel cleanup of session uploads only
- [ ] switch: loaded on/off, loading, failure, rollback restores legacy exactly
- [ ] mobile keyboard, desktop, keyboard-only navigation, labels/errors announced
