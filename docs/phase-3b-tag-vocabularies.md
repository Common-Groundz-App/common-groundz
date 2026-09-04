# Phase 3B — curated tag vocabularies (frozen, Stage 0 corrected)

Specification only. No registry edit, no component, no migration lands in 3B; Phase
3C Stage 2 consumes **this** corrected document — never the pre-Stage-0 revision.

## Rules that apply to every vocabulary

- **`value` is the stored code**, lowercase `snake_case`, immutable once shipped.
  Labels and emojis are presentation and may be reworded freely without a data
  migration. Nothing ever stores a label.
- **Positive tags are evaluative, not bare aspects.** Selecting "Story" says nothing
  about whether the story was good; `compelling_story` does. Any tag marked
  `positive` must carry the judgement in the id and the label itself.
- **`sentiment`** (`positive | neutral | negative`) is registry metadata only —
  never persisted in `metadata.questionnaire`. `neutral` is reserved for traits that
  are a genuine plus for some people and a minus for others (crowded, challenging,
  slow burn, fast-paced, premium pricing, subscription required). Friction that
  nobody prefers is `negative` even when mild (hard to find, limited range, hard to
  book) — it is a drawback, not a matter of taste.
- **Tag identity is composite: `(type, field id, tag id)`.** The same string in two
  vocabularies is two distinct tags. Cross-type aggregation requires an explicit
  shared-definitions map, never string reuse.
- **Selection caps** (`CuratedTagSelector`): 5 combined selected + custom, max 3
  custom, 40 chars each, NFC-normalized and trimmed before case-insensitive dedupe
  while preserving the user's casing, never blank. `FoodTagSelector` is exempt and
  stays **regression-identical in behaviour, vocabulary, styling and persistence**.
- **No preselection.** Unanswered is omitted from `answers`, never `[]`.
- Every vocabulary carries a few high-signal negatives — a wall of praise chips is
  useless as decision evidence.
- **`food` has no generic `stood_out`.** Food Tags (13 existing tags,
  `metadata.food_tags`) already are food's "what stood out". Food has **no
  additional type-specific questionnaire fields** beyond `would_recommend`,
  `repeat_intent`, the existing Food Tags and `portion`. The common review-shell
  fields (rating, headline, thoughts, media, experience date, visibility) still
  apply to food exactly as they do to every other type.


## `stood_out` vocabularies

### place (13) — `best_for` carries the audience dimension, so no audience tags here

| value | label | emoji | sentiment |
|---|---|---|---|
| `great_ambience` | Great ambience | 🕯️ | positive |
| `good_service` | Good service | 🙌 | positive |
| `very_clean` | Very clean | ✨ | positive |
| `convenient_location` | Convenient location | 📍 | positive |
| `good_value` | Good value | 💰 | positive |
| `helpful_staff` | Helpful staff | 💡 | positive |
| `quiet` | Quiet | 🤫 | neutral |
| `crowded` | Crowded | 👥 | neutral |
| `hard_to_find` | Hard to find | 🧭 | negative |
| `long_wait` | Long wait | ⏳ | negative |
| `overpriced` | Overpriced | 💸 | negative |
| `poor_upkeep` | Poorly maintained | 🧹 | negative |
| `unhelpful_service` | Unhelpful service | 🙃 | negative |

### product (12) — value moves to the `value` question, so no value tags here

| value | label | emoji | sentiment |
|---|---|---|---|
| `solid_build` | Solid build | 🔨 | positive |
| `easy_to_use` | Easy to use | 👌 | positive |
| `works_as_described` | Works as described | ✅ | positive |
| `durable` | Durable | 🛡️ | positive |
| `great_design` | Great design | 🎨 | positive |
| `packaging` | Packaging | 📦 | neutral |
| `learning_curve` | Takes getting used to | 📈 | neutral |
| `bulky` | Bulky | 🧱 | neutral |
| `stopped_working` | Stopped working | 💥 | negative |
| `flimsy` | Feels flimsy | 🥀 | negative |
| `not_as_described` | Not as described | ❓ | negative |
| `hard_to_clean` | Hard to clean | 🧼 | negative |

### brand (10)

| value | label | emoji | sentiment |
|---|---|---|---|
| `consistent_quality` | Consistent quality | 🎯 | positive |
| `good_support` | Good support | 🎧 | positive |
| `honest_claims` | Honest claims | 🤝 | positive |
| `easy_returns` | Easy returns | ↩️ | positive |
| `wide_range` | Wide range | 🧺 | positive |
| `premium_pricing` | Premium pricing | 💎 | neutral |
| `limited_range` | Limited range | 📉 | negative |
| `inconsistent_quality` | Inconsistent quality | 🎲 | negative |
| `slow_support` | Slow support | 🐢 | negative |
| `misleading_claims` | Misleading claims | 🚩 | negative |

### movie (12)

| value | label | emoji | sentiment |
|---|---|---|---|
| `compelling_story` | Compelling story | 📖 | positive |
| `strong_acting` | Strong acting | 🎭 | positive |
| `striking_cinematography` | Striking cinematography | 🎥 | positive |
| `great_soundtrack` | Great soundtrack | 🎵 | positive |
| `strong_direction` | Strong direction | 🎬 | positive |
| `strong_ending` | Strong ending | 🏁 | positive |
| `memorable_visuals` | Memorable visuals | 🖼️ | positive |
| `slow_pacing` | Slow pacing | 🐢 | neutral |
| `heavy_themes` | Heavy themes | 🌧️ | neutral |
| `predictable` | Predictable | 🔮 | negative |
| `weak_writing` | Weak writing | ✍️ | negative |
| `overhyped` | Overhyped | 📣 | negative |

### tv_show (11)

| value | label | emoji | sentiment |
|---|---|---|---|
| `compelling_story` | Compelling story | 📖 | positive |
| `strong_acting` | Strong acting | 🎭 | positive |
| `binge_worthy` | Binge-worthy | 🍿 | positive |
| `strong_start` | Strong start | 🚀 | positive |
| `strong_finish` | Sticks the landing | 🏁 | positive |
| `slow_burn` | Slow burn | 🕯️ | neutral |
| `episodic` | Watch in any order | 🔀 | neutral |
| `heavy_themes` | Heavy themes | 🌧️ | neutral |
| `filler_episodes` | Filler episodes | 🧵 | negative |
| `drops_off_later` | Drops off later | 📉 | negative |
| `unresolved_ending` | Unresolved ending | ❔ | negative |

### book (11)

| value | label | emoji | sentiment |
|---|---|---|---|
| `strong_writing` | Strong writing | ✍️ | positive |
| `memorable_characters` | Memorable characters | 🧑‍🤝‍🧑 | positive |
| `insightful` | Insightful | 💡 | positive |
| `practical` | Practical | 🛠️ | positive |
| `hard_to_put_down` | Hard to put down | 🔖 | positive |
| `dense` | Dense | 🧱 | neutral |
| `long` | Long | 📚 | neutral |
| `technical` | Technical | 🔬 | neutral |
| `repetitive` | Repetitive | 🔁 | negative |
| `thin_on_substance` | Thin on substance | 🫧 | negative |
| `dated` | Dated | 🕰️ | negative |

### game (12)

| value | label | emoji | sentiment |
|---|---|---|---|
| `engaging_gameplay` | Engaging gameplay | 🎮 | positive |
| `compelling_story` | Compelling story | 📖 | positive |
| `striking_visuals` | Striking visuals | 🖼️ | positive |
| `great_sound_design` | Great sound design | 🎧 | positive |
| `replayable` | Replayable | 🔄 | positive |
| `great_with_friends` | Great with friends | 🧑‍🤝‍🧑 | positive |
| `challenging` | Challenging | ⚔️ | neutral |
| `long_playtime` | Long playtime | ⏱️ | neutral |
| `steep_learning_curve` | Steep learning curve | 📈 | neutral |
| `buggy` | Buggy | 🐛 | negative |
| `grindy` | Grindy | ⛏️ | negative |
| `aggressive_monetisation` | Pushy purchases | 💳 | negative |

### app (12)

| value | label | emoji | sentiment |
|---|---|---|---|
| `easy_to_use` | Easy to use | 👌 | positive |
| `fast` | Fast | ⚡ | positive |
| `reliable` | Reliable | 🛡️ | positive |
| `good_design` | Good design | 🎨 | positive |
| `offline_support` | Works offline | 📴 | positive |
| `syncs_well` | Syncs well | 🔄 | positive |
| `feature_heavy` | Feature-heavy | 🧰 | neutral |
| `subscription_required` | Subscription required | 🔐 | neutral |
| `buggy` | Buggy | 🐛 | negative |
| `too_many_ads` | Too many ads | 📢 | negative |
| `battery_drain` | Battery drain | 🔋 | negative |
| `privacy_concerns` | Privacy concerns | 🕵️ | negative |

### course (11) — pairs with `worth_time` and `best_for`

| value | label | emoji | sentiment |
|---|---|---|---|
| `clear_teaching` | Clear teaching | 🧑‍🏫 | positive |
| `well_structured` | Well structured | 🧱 | positive |
| `hands_on` | Hands-on | 🛠️ | positive |
| `good_materials` | Good materials | 📄 | positive |
| `responsive_instructor` | Responsive instructor | 💬 | positive |
| `fast_paced` | Fast-paced | 🏃 | neutral |
| `theory_heavy` | Theory-heavy | 📐 | neutral |
| `needs_prior_knowledge` | Needs prior knowledge | 🔑 | neutral |
| `outdated_content` | Outdated content | 🕰️ | negative |
| `shallow_coverage` | Shallow coverage | 🫧 | negative |
| `poor_audio_video` | Poor audio/video | 🔇 | negative |

### service (11)

| value | label | emoji | sentiment |
|---|---|---|---|
| `on_time` | On time | ⏰ | positive |
| `quality_work` | Quality work | 🏅 | positive |
| `clear_pricing` | Clear pricing | 🧾 | positive |
| `good_communication` | Good communication | 💬 | positive |
| `left_it_tidy` | Left it tidy | 🧽 | positive |
| `easy_to_book` | Easy to book | 📅 | positive |
| `limited_availability` | Limited availability | 🗓️ | neutral |
| `delayed` | Delayed | 🐌 | negative |
| `surprise_charges` | Surprise charges | 💸 | negative |
| `rushed_work` | Rushed work | 🌀 | negative |
| `had_to_follow_up` | Had to chase them | 🔁 | negative |

### professional (11) — behaviour only; no character or misconduct labels

| value | label | emoji | sentiment |
|---|---|---|---|
| `knowledgeable` | Knowledgeable | 💡 | positive |
| `listens_well` | Listens well | 👂 | positive |
| `explains_clearly` | Explains clearly | 🗣️ | positive |
| `responsive` | Responsive | ⚡ | positive |
| `thorough` | Thorough | 🔍 | positive |
| `respects_time` | Respects your time | ⏰ | positive |
| `direct_style` | Very direct | ➡️ | neutral |
| `hard_to_book` | Hard to book | 🗓️ | negative |
| `slow_to_respond` | Slow to respond | 🐢 | negative |
| `unclear_communication` | Unclear communication | 🌫️ | negative |
| `didnt_follow_through` | Didn't follow through | 📆 | negative |

### event (11)

| value | label | emoji | sentiment |
|---|---|---|---|
| `great_atmosphere` | Great atmosphere | 🎉 | positive |
| `well_organised` | Well organised | 🗂️ | positive |
| `good_venue` | Good venue | 🏟️ | positive |
| `good_lineup` | Good lineup | 🎤 | positive |
| `worth_the_price` | Worth the price | 💰 | positive |
| `loud` | Loud | 🔊 | neutral |
| `crowded` | Crowded | 👥 | neutral |
| `long_day` | Long day | 🕗 | neutral |
| `long_queues` | Long queues | ⏳ | negative |
| `poor_sound` | Poor sound | 🔇 | negative |
| `overpriced_extras` | Overpriced extras | 💸 | negative |

### experience (11)

| value | label | emoji | sentiment |
|---|---|---|---|
| `memorable` | Memorable | 🌟 | positive |
| `well_organised` | Well organised | 🧭 | positive |
| `felt_safe` | Felt safe | 🦺 | positive |
| `scenic` | Scenic | 🏞️ | positive |
| `worth_the_price` | Worth the price | 💰 | positive |
| `physically_demanding` | Physically demanding | 🥵 | neutral |
| `weather_dependent` | Weather dependent | 🌦️ | neutral |
| `long_travel` | Long travel to get there | 🚌 | neutral |
| `rushed` | Felt rushed | ⏩ | negative |
| `touristy` | Very touristy | 🎟️ | negative |
| `poorly_run` | Poorly run | 🌀 | negative |

### others (9) — deliberately generic; no domain vocabulary to lean on

| value | label | emoji | sentiment |
|---|---|---|---|
| `high_quality` | High quality | 🏅 | positive |
| `good_value` | Good value | 💰 | positive |
| `easy_to_use` | Easy to use | 👌 | positive |
| `good_support` | Good support | 🎧 | positive |
| `as_described` | As described | ✅ | positive |
| `niche` | Niche | 🔎 | neutral |
| `takes_effort` | Takes effort | 🧗 | neutral |
| `overpriced` | Overpriced | 💸 | negative |
| `unreliable` | Unreliable | ⚠️ | negative |

## `best_for` vocabularies

Only `place` and `course` declare `best_for`. Same caps and rules; every audience
tag carries `sentiment: 'neutral'` explicitly in the registry data — an audience fit
is never praise or criticism.

### place (8)

| value | label | emoji | sentiment |
|---|---|---|---|
| `solo` | Solo | 🚶 | neutral |
| `couples` | Couples | 💞 | neutral |
| `family` | Family | 👨‍👩‍👧 | neutral |
| `friends` | Friends | 🧑‍🤝‍🧑 | neutral |
| `kids` | Kids | 🧒 | neutral |
| `work` | Working | 💻 | neutral |
| `celebrations` | Celebrations | 🎂 | neutral |
| `quick_stop` | A quick stop | ⏱️ | neutral |

### course (6)

| value | label | emoji | sentiment |
|---|---|---|---|
| `complete_beginners` | Complete beginners | 🌱 | neutral |
| `some_experience` | Some experience | 📗 | neutral |
| `advanced` | Advanced learners | 🎓 | neutral |
| `career_switchers` | Career switchers | 🔀 | neutral |
| `interview_prep` | Interview prep | 🎯 | neutral |
| `refresher` | A refresher | 🔁 | neutral |

## Overlap removed (deliberate, per the frozen matrix)

- `product.stood_out` drops all value/price praise — the `value` question owns it.
- `food` has no `stood_out` at all and no `value` question — Food Tags already cover
  both ("Value for Money" is an existing food tag).
- `place.stood_out` drops family/couples/solo — `best_for` owns audience.
- `course.stood_out` drops "worth the time" — the `worth_time` question owns it.
- `brand` and `professional` drop trust praise — the `trust` question owns it.
- `app` drops "solves my problem" — the `solves_problem` question owns it.

Ids repeated across types (`easy_to_use`, `crowded`, `worth_the_price`,
`compelling_story`, `strong_acting`, `buggy`, `good_support`, `well_organised`) are
convenient for readers but carry **no** cross-type meaning on their own: identity
stays `(type, field id, tag id)`, and any deliberate cross-type rollup must be
declared in the shared-definitions map.

## Freeze and validation

- **Stage 0 freezes this specification manually.** No docs validator exists and none
  will be built: this file is the source of truth as written, from the moment Stage 0
  is declared complete.
- **Stage 2 proves the implementation matches it.** A registry lint test lands with
  the registry entries and asserts the shipped vocabularies match **this** document
  exactly — every tag id, every sentiment, and the per-type tag count in each
  heading.
- **Any divergence found by that test is a Stage 2 implementation bug**, not a licence
  to edit this file. Changing a shipped id requires a data migration and an explicit
  new decision; labels and emojis remain freely reworded.

