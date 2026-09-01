# Phase 3B — Question matrix + frozen answer schema (approval only, no UI code)

Phase 3A shipped the registry, the resolver, identity derivation and the safe
metadata merge, but every canonical type except food still has `sections: []`.
3B locks **what we ask** and **how answers are stored**, so 3C implements one
slice without moving the storage home afterwards.

**No code ships in this phase.** Deliverable = the approved matrix + schema.

## Shape every type follows

Four slots, same order everywhere, wording changes per type:

1. **Would you recommend it?** — Yes / Maybe / No
2. **Repeat intent** (type-specific wording) — Yes / Maybe / No
3. **What stood out?** — tag chips with a curated per-type vocabulary + custom tags
4. **One extra high-value question** — value, worth-the-time, trust, or none

Rating (Step 1) and subject (Step 2) remain the only required inputs. **Every
question here is optional in v1.** Nothing duplicates an entity fact (director,
author, brand, address, organizer, price).

## Universal answer controls

| Control | Display | Stored codes |
|---|---|---|
| `yesmaybeno` | Yes / Maybe / No | `yes` / `maybe` / `no` |
| `value` | Not worth it / Okay / Worth it / Great value | `not_worth_it` / `okay` / `worth_it` / `great_value` |
| `worth_time` | Yes / Mostly / No | `yes` / `mostly` / `no` |
| `trust` | Low / Medium / High | `low` / `medium` / `high` |
| `solves_problem` | Yes / Partly / No | `yes` / `partly` / `no` |
| `tags` | chip grid + custom tag input | array of strings |

Display wording never becomes the stored value, so copy can change later without
breaking aggregation.

## The 15-type matrix

| Type | Recommend | Repeat intent (`would_again`) | Tags (`stood_out`) | Extra |
|---|---|---|---|---|
| food | Would you recommend it? | Would you order it again? | existing Food Tags, unchanged | `value` |
| place | Would you recommend this place? | Would you go back? | place vocab | `best_for` tags |
| product | Would you recommend it? | Would you buy it again? | product vocab | `value` |
| brand | Would you recommend this brand? | Would you buy from them again? | brand vocab | `trust` |
| movie | Would you recommend it? | Would you rewatch it? | movie vocab | — |
| tv_show | Would you recommend it? | Would you watch more of it? | tv vocab | `worth_time` |
| book | Would you recommend it? | Would you read it again? | book vocab | `worth_time` |
| game | Would you recommend it? | Would you play it again? | game vocab | `worth_time` |
| app | Would you recommend it? | Would you keep using it? | app vocab | `solves_problem` |
| course | Would you recommend it? | Would you take another course from them? | course vocab | `worth_time` |
| service | Would you recommend it? | Would you use this service again? | service vocab | `value` |
| professional | Would you recommend them? | Would you work with them again? | professional vocab | `trust` |
| event | Would you recommend it? | Would you attend again? | event vocab | `worth_time` |
| experience | Would you recommend it? | Would you do it again? | experience vocab | `worth_time` |
| others | Would you recommend it? | Would you choose it again? | generic vocab (custom-tag first) | — |

`legacy_unlinked` keeps **zero** type-specific questions — unchanged from 3A.

## Curated tag vocabularies (locked here, verbatim)

- **food** — unchanged: Spicy, Sweet, Savory, Vegetarian, Vegan, Gluten-Free, Dairy-Free, Non-Veg, Dessert, Breakfast, Lunch, Dinner, Value for Money
- **place** — Great ambience, Good service, Clean, Peaceful, Lively, Crowded, Beautiful, Convenient, Well maintained, Good location, Good value, Premium, Family-friendly, Date-friendly, Solo-friendly
- **place best_for** — Friends, Family, Couples, Solo, Groups, Work, Quick visit, Special occasion, Relaxing
- **product** — High quality, Easy to use, Durable, Reliable, Well designed, Premium feel, Good performance, Feature-rich, Convenient, Good value, Overpriced, Poor quality, Hard to use
- **brand** — Consistent quality, Trustworthy, Good design, Good customer service, Innovative, Good value, Premium, Reliable, Wide selection, Sustainable, Overpriced, Inconsistent, Poor support
- **movie** — Story, Acting, Characters, Visuals, Cinematography, Music, Direction, Writing, Action, Comedy, Emotion, Suspense, World-building, Ending
- **tv_show** — Story, Characters, Acting, Writing, Visuals, Music, Comedy, Suspense, World-building, Pacing, Character development, Ending
- **book** — Story, Writing, Characters, Ideas, World-building, Emotion, Humour, Research, Practical insights, Easy to read, Thought-provoking, Page-turner
- **game** — Gameplay, Story, Graphics, World, Characters, Combat, Exploration, Multiplayer, Progression, Sound/music, Replayability, Creativity, Difficulty
- **app** — Easy to use, Useful, Fast, Reliable, Well designed, Feature-rich, Simple, Customizable, Innovative, Good value, Too many ads, Buggy, Confusing, Expensive
- **course** — Practical, Well explained, Well structured, Engaging, Beginner-friendly, In-depth, Actionable, Good examples, Good exercises, Good instructor, Up to date, Too basic, Too advanced, Too theoretical
- **service** — High quality, Fast, Reliable, Professional, Convenient, Responsive, Thorough, Good communication, Punctual, Good value, Expensive, Slow, Poor communication, Unreliable
- **professional** — Knowledgeable, Professional, Reliable, Clear communication, Responsive, Patient, Trustworthy, Punctual, Empathetic, Detail-oriented, Efficient, Creative, Good listener
- **event** — Well organized, Great atmosphere, Great speakers, Great performances, Good crowd, Good venue, Good activities, Networking, Informative, Entertaining, Unique, Poor organization, Overcrowded
- **experience** — Unique, Fun, Exciting, Relaxing, Memorable, Well organized, Beautiful, Educational, Challenging, Beginner-friendly, Worth the money, Overrated, Crowded
- **others** — High quality, Useful, Easy, Reliable, Good value, Unique, Convenient, Enjoyable, Disappointing

Every vocabulary allows custom tags, exactly like the food selector does today.
Emoji per chip is optional and presentation-only; only the food set has emoji now.

## Frozen answer schema (v1)

Answers live under one versioned key on `reviews.metadata`. `food_tags` and
provenance keys stay at the root — not migrated just because Phase 3 exists.

```json
{
  "food_tags": ["Spicy"],
  "questionnaire": {
    "version": 1,
    "type": "course",
    "answers": {
      "would_recommend": "yes",
      "would_again": "maybe",
      "stood_out": ["Practical", "Good instructor"],
      "worth_time": "yes"
    }
  }
}
```

Contract rules, frozen here so 3C only implements them:

1. Answer **ids** are shared across types (`would_recommend`, `would_again`,
   `stood_out`, `value`, `worth_time`, `trust`, `solves_problem`, `best_for`) so
   the data aggregates across the whole catalogue.
2. Food keeps writing its chips to root `metadata.food_tags` — it is **not**
   duplicated into `answers.stood_out`. Every other type writes `stood_out`.
3. `version` is a monotonically increasing integer. A review with no
   `questionnaire.version` opens in legacy compatibility, never silently converted.
4. `type` records the canonical type the answers were given for. On a deliberate
   subject change the form switches to the new type's questions; answers whose ids
   still exist carry over, unknown ids are **preserved untouched**, never dropped.
5. Writes merge into `answers`; they never replace the object.
6. Empty answers are omitted, not stored as `""` / `null` / `[]`.
7. No DB migration, no new column, no backfill — `metadata` JSONB already exists.

## Technical notes for 3C (not built in 3B)

- `FoodTagSelector` hardcodes its 13 chips and takes only
  `selectedTags/onAddTag/onRemoveTag`, so 3C needs a **generic chip selector**
  built on the same visual pattern, driven by a vocabulary from the registry.
  Food stays routed to the existing untouched component; `tagSet` grows from
  `'food'` to the 17 named vocabularies above.
- The registry's `kind` union gains no new members: `select` covers all four
  scale controls (each with its own `options` codes), `tags` covers chips.
- Validation stays as 3A left it — no new required fields, so `required: false`
  everywhere.

## Out of scope

Any UI code or registry edit in this phase; conditional questions (paid-game
value, per-profession `best_for`); making any question required; step/layout
restructuring; Phase 2.5B remediation; changing `FoodTagSelector`.
