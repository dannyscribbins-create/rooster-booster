-- ─────────────────────────────────────────────────────────────────────────────
-- CANVASS-4b · WHY A REP'S BOOK SHOWS FEWER ROWS THAN THE DATABASE HOLDS
--
-- READ-ONLY. No INSERT, UPDATE, DELETE or DDL. Safe to run on Railway.
--
-- Observed 2026-09-18: 39 assignments for team member 5, roughly 30 rows on screen.
-- This partitions every assignment in the rep's book into "renders" and "does not,
-- because X", so the gap is MEASURED rather than inferred.
--
-- ⚠ SET THE TWO PARAMETERS ON THE FIRST LINE OF EACH QUERY BEFORE RUNNING.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Q1. THE PARTITION ────────────────────────────────────────────────────────
-- The route's list query INNER JOINs jobber_clients. Any assignment whose client
-- has no mirror row in jobber_clients is dropped by that join and is invisible to
-- the rep, while the separate COUNT query (which does not join) still counts it.
--
-- ⚠ THIS STATE IS REACHABLE BY CONSTRUCTION, NOT AN ANOMALY. The request-driven
-- attribution path (the REQUEST_CREATE/REQUEST_UPDATE webhooks and the hourly
-- sweep) writes client_rep_assignments and NEVER writes jobber_clients — the only
-- writers of that table are the daily 2am incremental sync, the full import, and
-- the client webhooks. So a client attributed by the sweep is unnameable to this
-- screen until one of those next touches it.
SELECT
  CASE
    WHEN jc.jobber_client_id IS NULL THEN 'DROPPED — no jobber_clients row (the inner join)'
    ELSE                                  'RENDERS'
  END AS outcome,
  COUNT(*) AS assignments
FROM client_rep_assignments cra
LEFT JOIN jobber_clients jc
  ON jc.contractor_id = cra.contractor_id
 AND jc.jobber_client_id = cra.jobber_client_id
WHERE cra.contractor_id = 'REPLACE_CONTRACTOR_ID'
  AND COALESCE(cra.sticky_rep_id, cra.provisional_rep_id) = REPLACE_MEMBER_ID
GROUP BY 1
ORDER BY 1;

-- ── Q2. THE DROPPED ROWS THEMSELVES ──────────────────────────────────────────
-- What is actually lost: the assignment metadata survives, only the NAME is absent.
-- That is the evidence for rendering these rather than dropping them.
SELECT
  cra.jobber_client_id,
  COALESCE(cra.sticky_source, cra.provisional_source) AS assignment_source,
  (cra.sticky_rep_id IS NOT NULL)                     AS is_sticky,
  COALESCE(cra.sticky_set_at, cra.provisional_set_at) AS assigned_at,
  pc.pipeline_status                                  AS stage_if_referred
FROM client_rep_assignments cra
LEFT JOIN jobber_clients jc
  ON jc.contractor_id = cra.contractor_id AND jc.jobber_client_id = cra.jobber_client_id
LEFT JOIN pipeline_cache pc
  ON pc.contractor_id = cra.contractor_id AND pc.jobber_client_id = cra.jobber_client_id
WHERE cra.contractor_id = 'REPLACE_CONTRACTOR_ID'
  AND COALESCE(cra.sticky_rep_id, cra.provisional_rep_id) = REPLACE_MEMBER_ID
  AND jc.jobber_client_id IS NULL
ORDER BY COALESCE(cra.sticky_set_at, cra.provisional_set_at) DESC;

-- ── Q3. THE OTHER CANDIDATES, RULED IN OR OUT BY MEASUREMENT ─────────────────
-- ⚠ CHECKED RATHER THAN ASSUMED AWAY. Three things other than the client join
-- could change the row count, and each is counted here so a zero is a measured
-- zero rather than an untested assumption.
SELECT
  -- (a) MIS-TENANTED: the assignment names this contractor while the rep belongs to
  --     another. Nothing in the schema forbids it — client_rep_assignments carries
  --     sticky_rep_id REFERENCES team_members(id) with no contractor consistency
  --     constraint. The route's contractor predicate excludes these.
  COUNT(*) FILTER (WHERE tm.id IS NULL OR tm.contractor_id <> cra.contractor_id)
    AS mis_tenanted_or_missing_rep,
  -- (b) FLAG MULTIPLICATION: more than one OPEN co-assignment flag naming this rep
  --     for the same client would duplicate that client's row, not drop it.
  COUNT(*) FILTER (WHERE fa.flags > 1)          AS clients_with_multiple_open_flags,
  -- (c) DUPLICATE CLIENT MIRROR ROWS: two jobber_clients rows for one key would also
  --     multiply. The table's unique constraint should make this zero.
  COUNT(*) FILTER (WHERE jcdup.n > 1)           AS clients_with_duplicate_mirror_rows,
  COUNT(*)                                      AS assignments_examined
FROM client_rep_assignments cra
LEFT JOIN team_members tm ON tm.id = COALESCE(cra.sticky_rep_id, cra.provisional_rep_id)
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS flags FROM flagged_assignments f
   WHERE f.contractor_id = cra.contractor_id
     AND f.jobber_client_id = cra.jobber_client_id
     AND f.status = 'open'
     AND f.flag_reason = 'rep_co_assignment'
     AND f.reps_involved @> to_jsonb(REPLACE_MEMBER_ID)
) fa ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS n FROM jobber_clients j
   WHERE j.contractor_id = cra.contractor_id AND j.jobber_client_id = cra.jobber_client_id
) jcdup ON TRUE
WHERE cra.contractor_id = 'REPLACE_CONTRACTOR_ID'
  AND COALESCE(cra.sticky_rep_id, cra.provisional_rep_id) = REPLACE_MEMBER_ID;

-- ── Q4. THE HEADLINE NUMBERS, SO THE SCREEN CAN BE COMPARED AGAINST THEM ─────
SELECT
  (SELECT COUNT(*) FROM client_rep_assignments cra
    WHERE cra.contractor_id = 'REPLACE_CONTRACTOR_ID'
      AND COALESCE(cra.sticky_rep_id, cra.provisional_rep_id) = REPLACE_MEMBER_ID)
    AS total_assignments,
  (SELECT COUNT(*) FROM client_rep_assignments cra
     JOIN jobber_clients jc
       ON jc.contractor_id = cra.contractor_id AND jc.jobber_client_id = cra.jobber_client_id
    WHERE cra.contractor_id = 'REPLACE_CONTRACTOR_ID'
      AND COALESCE(cra.sticky_rep_id, cra.provisional_rep_id) = REPLACE_MEMBER_ID)
    AS renders_before_this_fix;
