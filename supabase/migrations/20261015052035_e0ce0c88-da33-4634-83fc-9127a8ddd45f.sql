CREATE TABLE public._p4_txn_probe2 (pid int, tx bigint);
INSERT INTO public._p4_txn_probe2 VALUES (pg_backend_pid(), txid_current());
SELECT 1;
INSERT INTO public._p4_txn_probe2 VALUES (pg_backend_pid(), txid_current());
DO $$ BEGIN
  IF (SELECT count(DISTINCT (pid, tx)) FROM public._p4_txn_probe2) <> 1 THEN
    RAISE EXCEPTION 'probe_split_detected';
  END IF;
END $$;
DROP TABLE public._p4_txn_probe2;