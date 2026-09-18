-- ─────────────────────────────────────────────────────────────────────────────
-- CANVASS-4 · A34.4's D4 CLAUSE — THE MEMBERSHIP AMBIGUITY, MEASURED
--
-- READ-ONLY. No INSERT, UPDATE, DELETE or DDL. Safe to run on Railway.
--
-- Answers: of the clients in a rep's book, how many fall in each of the four
-- states A24.5 / Canvass-0 S1 established?
--
-- ⚠ THE BRIDGE IS users.jobber_client_id, CONTRACTOR-SCOPED. A24.5 rejects the
-- email bridge: users.email is UNIQUE PER CONTRACTOR, not globally, so an email
-- join without a contractor_id predicate is a CROSS-TENANT JOIN.
--
-- ⚠ SET THE TWO PARAMETERS BELOW BEFORE RUNNING.
--   :contractor  — the contractor id
--   :member      — the team_members.id whose book to measure
--                  (pass NULL to measure EVERY assigned client for the tenant)
-- ─────────────────────────────────────────────────────────────────────────────

WITH params AS (
  SELECT
    'REPLACE_CONTRACTOR_ID'::text AS contractor_id,
    NULL::int                     AS member_id      -- NULL = the whole tenant's assigned book
),

-- The rep's book: the own-book predicate, exactly as the route will use it.
book AS (
  SELECT cra.jobber_client_id
  FROM client_rep_assignments cra, params p
  WHERE cra.contractor_id = p.contractor_id
    AND (
      p.member_id IS NULL
      OR COALESCE(cra.sticky_rep_id, cra.provisional_rep_id) = p.member_id
    )
    AND COALESCE(cra.sticky_rep_id, cra.provisional_rep_id) IS NOT NULL
),

classified AS (
  SELECT
    b.jobber_client_id,
    -- (1) AUTHORITATIVE LINK — a users row on THIS tenant carries this client id.
    EXISTS (
      SELECT 1 FROM users u, params p
      WHERE u.contractor_id   = p.contractor_id
        AND u.jobber_client_id = b.jobber_client_id
    ) AS user_linked,
    -- (4) CONTACT-LEVEL MATCH — a contact for this client is flagged is_app_user
    --     while no users row links. Reached two ways: the denormalised column, and
    --     the real link table. Both are checked, because contact_jobber_links is
    --     the one the Contact Matching Standard pass actually writes.
    EXISTS (
      SELECT 1 FROM contacts c, params p
      WHERE c.contractor_id    = p.contractor_id
        AND c.jobber_client_id = b.jobber_client_id
        AND c.is_app_user IS TRUE
    ) OR EXISTS (
      SELECT 1
      FROM contact_jobber_links l
      JOIN contacts c2 ON c2.id = l.contact_id
      , params p
      WHERE l.contractor_id    = p.contractor_id
        AND l.jobber_client_id = b.jobber_client_id
        AND c2.is_app_user IS TRUE
    ) AS contact_says_app_user,
    -- Any contact at all for this client, app user or not.
    EXISTS (
      SELECT 1 FROM contacts c, params p
      WHERE c.contractor_id    = p.contractor_id
        AND c.jobber_client_id = b.jobber_client_id
    ) OR EXISTS (
      SELECT 1 FROM contact_jobber_links l, params p
      WHERE l.contractor_id    = p.contractor_id
        AND l.jobber_client_id = b.jobber_client_id
    ) AS any_contact
  FROM book b
)

SELECT
  CASE
    WHEN user_linked            THEN '1_LINKED_APP_USER      (confirmed member)'
    WHEN contact_says_app_user  THEN '4_CONTACT_LEVEL_ONLY   (app user, users link absent - AMBIGUOUS)'
    WHEN any_contact            THEN '3_KNOWN_CONTACT_NOT_APP (contact exists, not flagged app user)'
    ELSE                             '2_NOTHING_KNOWN        (no contact at all)'
  END AS membership_state,
  COUNT(*) AS clients
FROM classified
GROUP BY 1
ORDER BY 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- THE SECOND NUMBER, AND IT IS THE ONE THAT DECIDES THE COPY.
--
-- Peer signups: app users on this tenant carrying NO jobber_client_id. Every one
-- of them COULD be a homeowner sitting in states 2, 3 or 4 above — signed up, never
-- matched. They are why "not signed up" cannot be asserted about any client outside
-- state 1, and A34.4 forbids asserting it.
--
-- ⚠ IF THIS IS ZERO, the ambiguity is theoretical today and the copy can be
-- tighter. IF IT IS NON-ZERO, states 2/3/4 provably contain unknowns.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  COUNT(*) FILTER (WHERE jobber_client_id IS NULL)     AS peer_signups_unmatched,
  COUNT(*) FILTER (WHERE jobber_client_id IS NOT NULL) AS app_users_matched,
  COUNT(*)                                             AS app_users_total
FROM users
WHERE contractor_id = 'REPLACE_CONTRACTOR_ID'
  AND deleted_at IS NULL;
