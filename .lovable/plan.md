

# Assessment

Both reviewers approve. Here's what to adopt:

**Codex's `clearTimeout` cleanup — Yes, adopt.** Store timeout IDs in refs and clear them explicitly on unmount/reset. The `cycleRef` guard prevents stale *state updates*, but stale timers still fire uselessly. Cleaning them up is proper hygiene and costs two lines.

**ChatGPT's 100-200ms delay before "still-offline" — No, skip.** The user already waits 800ms watching "Reconnecting...". Adding another artificial delay before showing the result makes it feel *slower*, not smoother. The transition from spinner to "Still offline" should feel immediate and decisive.

**Nothing else to add.** The plan is complete. Three rounds of review from two external models have converged on the same architecture. Ship it.

## Final Plan — `src/components/OfflineBanner.tsx`

Single file change. Everything from the previous approved plan, plus:

```typescript
const cooldownTimerRef = useRef<ReturnType<typeof setTimeout>>();
const revertTimerRef = useRef<ReturnType<typeof setTimeout>>();
```

Store timeout IDs when setting cooldown and "still-offline" revert timers. Clear them in:
- The `useEffect` unmount cleanup
- The `isOnline` reset effect
- The start of each new retry cycle

That's it. Ready to implement.

