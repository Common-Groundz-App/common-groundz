

# Phase 2: Circle Trust Layer + Smart Ranking — FINAL

## Changes

### File 1: `src/components/comments/CommentItem.tsx`
- Import `Users` from lucide-react
- After username/time row, render "From your circle" when `comment.is_from_circle` — `text-xs text-muted-foreground flex items-center gap-1`
- When `isReply && comment.is_from_circle`, use `border-primary/40` instead of `border-muted`

### File 2: `src/components/comments/InlineCommentThread.tsx`
- Replace current sort with precomputed 5-tier ranking:

```text
const scored = groups.map(g => {
  const hasCircleReply = g.replies.some(r => r.is_from_circle);
  const replyLikes = g.replies.reduce((s, r) => s + (r.like_count || 0), 0);
  return {
    ...g,
    _hasReplies: g.replies.length > 0 ? 1 : 0,
    _circle: g.comment.is_from_circle || hasCircleReply ? 1 : 0,
    _likeScore: Math.min((g.comment.like_count || 0) + Math.floor(replyLikes * 0.5), 20),
    _time: g.comment.created_at ? new Date(g.comment.created_at).getTime() : 0,
  };
});

scored.sort((a, b) => {
  if (b._hasReplies !== a._hasReplies) return b._hasReplies - a._hasReplies;
  if (b._circle !== a._circle) return b._circle - a._circle;
  if (b._likeScore !== a._likeScore) return b._likeScore - a._likeScore;
  if (b._time !== a._time) return b._time - a._time;
  return b.comment.id.localeCompare(a.comment.id);
});

return scored.map(({ _hasReplies, _circle, _likeScore, _time, ...group }) => group);
```

- Add "Sorted by relevance" muted text near comment count when 2+ top-level comments

### Files modified
1. `src/components/comments/CommentItem.tsx`
2. `src/components/comments/InlineCommentThread.tsx`

No database or service changes.

### Build error
The `aws s3 cp exit 127` error is a transient infrastructure issue — not code-related. A retry will fix it.

