# Project architecture rules

- Resolve update destinations from persisted entity and parent slugs during the signed-in existing-review lookup, and consume one-time modal navigation state on the destination; this avoids intermediate ID/query URLs without changing durable deep links.
- Review and timeline-update Mux videos are validated, made trustworthy and linked by database triggers inside the same save, and only the trusted-server patch may write Mux state; this removes the two-step registration failure window posts have and keeps client-supplied playback data out.