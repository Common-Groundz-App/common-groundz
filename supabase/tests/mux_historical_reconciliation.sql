-- Read-only acceptance checks for the exact operator-authorized historical run.
-- No fixtures, worker calls, Mux requests or state mutations.
WITH run AS (
  SELECT * FROM public.mux_cleanup_audit_logs
  WHERE run_id = '340b7811-ac2f-4544-a092-334938451325'::uuid
), survivors AS (
  SELECT c.* FROM public.mux_deletion_candidates c
  JOIN run r ON r.candidate_id = c.id WHERE r.action = 'historical_requeued'
)
SELECT
  (SELECT count(*) = 68 AND bool_and(details->>'reason' = 'externally_missing_from_mux'
    AND details->>'mux_delete_issued' = 'false' AND details->>'http_method' = 'GET'
    AND details->>'http_status' = '404') FROM run WHERE action = 'reconciled_404') AS missing_audit_pass,
  (SELECT count(*) = 68 AND bool_and(c.status = 'reconciled_already_deleted'
    AND c.is_destructively_claimed AND c.destructive_claim_token IS NOT NULL)
    FROM public.mux_deletion_candidates c JOIN run r ON r.candidate_id = c.id
    WHERE r.action = 'reconciled_404') AS missing_barrier_pass,
  (SELECT count(*) = 4 AND bool_and(status = 'pending_grace'
    AND NOT is_destructively_claimed
    AND discovered_at = '2026-10-25T08:23:47.742766Z'::timestamptz
    AND eligible_at = '2026-10-26T08:23:47.742766Z'::timestamptz
    AND eligible_at - discovered_at = interval '24 hours') FROM survivors) AS fresh_grace_pass,
  (SELECT count(*) = 72 FROM run) AS exact_audit_count_pass,
  NOT EXISTS (SELECT 1 FROM run WHERE mux_asset_id IN (
    'VTO5q8FXmfTeeRkKTJY029xTn6OQScwgp01oN00ZyTV5K4',
    'Q00EpNYlqK5OtvCsZhcqoa02onvTiNgD3Hu9LG4bE2Bro')) AS exclusions_pass;