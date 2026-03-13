

# Final Verdict

**Disagree with ChatGPT on this one.** Keep `resize-none`.

**Why:**

- `resize-y` adds a visible drag handle in the corner that breaks the clean pill/bar aesthetic we're building
- The textarea already auto-expands with content up to `max-h-[120px]` — users don't need to manually resize
- Every modern comment composer (Instagram, YouTube, Discord, Slack) uses auto-expanding textareas without manual resize handles
- A resize handle on a `rounded-xl` input looks visually awkward

**The plan is complete as approved. No changes needed.** Ready to implement.

