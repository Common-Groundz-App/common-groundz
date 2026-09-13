-- Remove the temporary verification job; it has served its purpose (three successful
-- end-to-end runs confirmed via net._http_response, HTTP 200, rowsWritten 21).
SELECT cron.unschedule('refresh-social-influence-v2-verify');