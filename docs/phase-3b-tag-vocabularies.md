# Phase 3B — curated tag vocabularies (frozen)

Specification only. No registry edit, no component, no migration lands in 3B; Phase
3C consumes this document verbatim.

## Rules that apply to every vocabulary

- **`value` is the stored code**, lowercase `snake_case`, immutable once shipped.
  Labels and emojis are presentation and may be reworded freely without a data
  migration. Nothing ever stores a label.
- **`sentiment`** (`positive | neutral | negative`) is registry metadata only —
  never persisted in `metadata.questionnaire`. `neutral` is for
  preference-dependent traits (crowded, challenging, slow-paced) that are a plus
  for some readers and a minus for others.
- **Selection caps** (`CuratedTagSelector`): 5 combined selected + custom, max 3
  custom, 40 chars each, NFC-normalized and trimmed before case-insensitive dedupe
  while preserving the user's casing, never blank. `FoodTagSelector` is exempt and
  keeps its current behaviour byte-identically.
- **No preselection.** Unanswered is omitted from `answers`, never `[]`.
- Every vocabulary carries a few high-signal negatives — a wall of praise chips is
  useless as decision evidence.
- `food` is unchanged and not restated here (13 existing tags, `metadata.food_tags`).

## `stood_out` vocabularies

### place (13) — `best_for` carries the audience dimension, so no audience tags here

| value | label | emoji | sentiment |
|---|---|---|---|
| `ambience` | Ambience | 🕯️ | positive |
| `service` | Service | 🙌 | positive |
| `cleanliness` | Cleanliness | ✨ | positive |
| `location` | Location | 📍 | positive |
| `value` | Value | 💰 | positive |
| `staff_knowledge` | Helpful staff | 💡 | positive |
| `quiet` | Quiet | 🤫 | neutral |
| `crowded` | Crowded | 👥 | neutral |
| `hard_to_find` | Hard to find | 🧭 | neutral |
| `long_wait` | Long wait | ⏳ | negative |
| `overpriced` | Overpriced | 💸 | negative |
| `poor_upkeep` | Poorly maintained | 🧹 | negative |
| `rude_service` | Unhelpful service | 🙃 | negative |

### product (12) — value moves to the `value` question, so no value tags here

| value | label | emoji | sentiment |
|---|---|---|---|
| `build_quality` | Build quality | 🔨 | positive |
| `easy_to_use` | Easy to use | 👌 | positive |
| `works_as_described` | Works as described | ✅ | positive |
| `durable` | Durable | 🛡️ | positive |
| `design` | Design | 🎨 | positive |
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
| `support` | Good support | 🎧 | positive |
| `honest_claims` | Honest claims | 🤝 | positive |
| `easy_returns` | Easy returns | ↩️ | positive |
| `fast_delivery` | Fast delivery | 🚚 | positive |
| `premium_pricing` | Premium pricing | 💎 | neutral |
| `limited_range` | Limited range | 📉 | neutral |
| `inconsistent_quality` | Inconsistent quality | 🎲 | negative |
| `slow_support` | Slow support | 🐢 | negative |
| `misleading_claims` | Misleading claims | 🚩 | negative |

### movie (12)

| value | label | emoji | sentiment |
|---|---|---|---|
| `story` | Story | 📖 | positive |
| `acting` | Acting | 🎭 | positive |
| `cinematography` | Cinematography | 🎥 | positive |
| `soundtrack` | Soundtrack | 🎵 | positive |
| `direction` | Direction | 🎬 | positive |
| `ending` | Ending | 🏁 | positive |
| `slow_pacing` | Slow pacing | 🐢 | neutral |
| `heavy_themes` | Heavy themes | 🌧️ | neutral |
| `subtitles_needed` | Best with subtitles | 💬 | neutral |
| `predictable` | Predictable | 🔮 | negative |
| `weak_writing` | Weak writing | ✍️ | negative |
| `overhyped` | Overhyped | 📣 | negative |

### tv_show (11)

| value | label | emoji | sentiment |
|---|---|---|---|
| `story` | Story | 📖 | positive |
| `acting` | Acting | 🎭 | positive |
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
| `writing` | Writing | ✍️ | positive |
| `characters` | Characters | 🧑‍🤝‍🧑 | positive |
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
| `gameplay` | Gameplay | 🎮 | positive |
| `story` | Story | 📖 | positive |
| `visuals` | Visuals | 🖼️ | positive |
| `sound_design` | Sound design | 🎧 | positive |
| `replayable` | Replayable | 🔄 | positive |
| `multiplayer` | Great with friends | 🧑‍🤝‍🧑 | positive |
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
| `tidy` | Left it tidy | 🧽 | positive |
| `booking_ease` | Easy to book | 📅 | positive |
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
| `hard_to_book` | Hard to book | 🗓️ | neutral |
| `slow_to_respond` | Slow to respond | 🐢 | negative |
| `unclear_communication` | Unclear communication | 🌫️ | negative |
| `missed_deadlines` | Missed deadlines | 📆 | negative |

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
| `good_guide` | Good guide | 🧭 | positive |
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
| `quality` | Quality | 🏅 | positive |
| `value` | Value | 💰 | positive |
| `easy_to_use` | Easy to use | 👌 | positive |
| `good_support` | Good support | 🎧 | positive |
| `as_described` | As described | ✅ | positive |
| `niche` | Niche | 🔎 | neutral |
| `takes_effort` | Takes effort | 🧗 | neutral |
| `overpriced` | Overpriced | 💸 | negative |
| `unreliable` | Unreliable | ⚠️ | negative |

## `best_for` vocabularies

Only `place` and `course` declare `best_for`. Same caps and rules; audience tags are
`neutral` throughout — an audience fit is never praise or criticism.

### place (8)

| value | label | emoji |
|---|---|---|
| `solo` | Solo | 🚶 |
| `couples` | Couples | 💞 |
| `family` | Family | 👨‍👩‍👧 |
| `friends` | Friends | 🧑‍🤝‍🧑 |
| `kids` | Kids | 🧒 |
| `work` | Working | 💻 |
| `celebrations` | Celebrations | 🎂 |
| `quick_stop` | A quick stop | ⏱️ |

### course (6)

| value | label | emoji |
|---|---|---|
| `complete_beginners` | Complete beginners | 🌱 |
| `some_experience` | Some experience | 📗 |
| `advanced` | Advanced learners | 🎓 |
| `career_switchers` | Career switchers | 🔀 |
| `interview_prep` | Interview prep | 🎯 |
| `refresher` | A refresher | 🔁 |

## Overlap removed (deliberate, per the frozen matrix)

- `product.stood_out` drops all value/price praise — the `value` question owns it.
- `food` gains no `value` question because "Value for Money" is already a food tag.
- `place.stood_out` drops family/couples/solo — `best_for` owns audience.
- `course.stood_out` drops "worth the time" — the `worth_time` question owns it.
- `brand` and `professional` drop trust praise — the `trust` question owns it.
- `app` drops "solves my problem" — the `solves_problem` question owns it.

Repeated ids across types (`value`, `easy_to_use`, `crowded`, `worth_the_price`,
`story`, `buggy`) are intentional: identical meaning, so cross-type aggregation of a
tag id stays sound.
