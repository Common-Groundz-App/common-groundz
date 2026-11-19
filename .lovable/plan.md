# Phase 10A — Modernized Review Cards & Detail Presentation (Read-Only Audit & Design)

Phase 9 is closed: your phone checklist passed, and the automated checks passed earlier.

## Goal
Show everything the new review form now saves, clearly, on every place a review appears. That covers the recommendation, the type-specific answers, Best For, "Your experience", detail ratings, food tags and spoiler protection. Nothing in the form changes.

## What this audit will do (no code changes)
1. **Card inventory:** list every place a review is shown: the entity page review card, the profile review card, the Timeline card, the Timeline viewer and the search result row. For each one, note what it shows today and what saved data it leaves out.
2. **Data gap map:** compare what the form saves for each of the 15 types with what each card shows.
3. **Presentation design:** suggest a modern card with this order:
   - who wrote it, the main Connected Rings rating and the date
   - the recommendation
   - the text
   - 2–4 key highlights (liked / could be better, Best For)
   - small detail ratings (shown read-only, reusing the existing compact rings)
   - media
   - an expanded detail view for the rest, including "Your experience", which is shown as the reviewer's own description and not as verified credibility.
4. **Rules kept:** spoiler protection stays (anything that could give the story away stays hidden until revealed), Timeline Updates stay the same, the original Connected Rings stay untouched, and old reviews with missing or retired answers still display cleanly.
5. **Mobile and accessibility:** density on small screens, tap targets and screen-reader labels.
6. **Bounded sub-phases:** split the work into 10B.1, 10B.2 and so on. Each will have acceptance criteria, and I'll mark what must ship together versus what can wait.

## Out of scope
Form changes, saving or database changes, Timeline Update authoring, changes to the original Connected Rings, and Phase 11.

## Output
A findings report and a phased design proposal for your approval before any build.
