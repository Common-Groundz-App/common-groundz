# Project architecture rules

- Resolve update destinations from persisted entity and parent slugs during the signed-in existing-review lookup, and consume one-time modal navigation state on the destination; this avoids intermediate ID/query URLs without changing durable deep links.