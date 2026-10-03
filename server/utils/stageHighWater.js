'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// N4 COMMIT 9 — THE HIGH-WATER MARK, AND THE ONE PLACE THE LADDER IS WRITTEN DOWN
//
// Danny's ruling: a referrer whose card moves BACKWARDS sees a subtle note reading exactly
// "This job is no longer active." A rep sees the plain truth with no note, always.
//
// ⚠ A BACKWARDS MOVE IS A REAL EVENT, NOT A DEFECT TO HIDE. `classifyPipelineStatus` derives from
// whatever facts exist, and facts legitimately disappear: a quote is archived, a job is deleted, an
// invoice is voided. N4 commit 7b deliberately REJECTED a ratchet on the referrer's column — that
// would also block the genuine corrections, and the arc's own measurement found 5 of 21 sampled
// moves were real. **So the stage still moves; the note explains it.**
//
// ⚠ AND THIS COLUMN IS AN OBSERVATION, NOT A DECISION. Nothing may gate money on it. The eligibility
// rule is `evaluateReferral`'s and the ledger is `referral_conversions`; a high-water mark is a
// record of what a referrer was once SHOWN, which is a different question from what they are owed.
// A fence in `stageHighWater.test.js` forbids the column name in every money path by name.
//
// ⚠ WHY A STORED COLUMN RATHER THAN A DERIVATION FROM FACTS. The question is "what did this
// referrer already see", and no fact table answers it: the facts are exactly what went away. Deriving
// the highest stage the CURRENT facts support would return the current stage by construction, so the
// comparison could never fire — the vacuity shape this repo records as "a fixture seeded with the
// value a broken read also produces", one layer up in the design.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The PROGRESS ladder, lowest first. This array is the single source of the ordering: the SQL that
 * raises the mark takes it as a BOUND PARAMETER rather than spelling a CASE of its own, so there is
 * no second copy to drift. `stageHighWater.test.js` asserts both call sites pass this constant.
 *
 * ⚠ `not_sold` AND `app_user` ARE DELIBERATELY ABSENT, AND THEY ARE ABSENT FOR DIFFERENT REASONS.
 *   · `not_sold` IS one of the five stage values (every quote archived, no job) and it is a LOST
 *     outcome rather than a rung — so it is ALIASED to `lead`'s rank below. `inspection → not_sold`
 *     is then a backwards move (2 → 1) while `lead → not_sold` is not (1 → 1), which is Danny's
 *     "never on a true 'lead' with no prior progress" expressed as arithmetic rather than as a
 *     special case. ⚠ It is also the most likely backwards move there is, and the copy was written
 *     for it.
 *   · `app_user` is a `pipeline_cache` value that is never a stage at all. Those rows are
 *     placeholders for a signup with no Jobber client, and `deriveReferredStatus` REFUSES a
 *     non-derivable id, so the writer below can never run for one. Their mark stays NULL.
 *
 * ⚠ THE ALIAS EXISTS BECAUSE THE FIRST WRITING OF THIS FILE GOT ITS OWN ARITHMETIC WRONG, AND THE
 * COMMENT CLAIMED THE BEHAVIOUR THE CODE DID NOT HAVE. It said `not_sold` "ranks 0, tying with
 * lead" — but `lead` is ON the ladder and ranks 1, so `lead → not_sold` came out as 0 < 1 and the
 * note fired on a client whose only quote had always been archived. **Two cases caught it; the
 * prose would not have.** A client that once had a quote has MORE history than a bare lead, never
 * less, so the two tie rather than one sitting below the other.
 */
const PROGRESS_LADDER = ['lead', 'inspection', 'sold', 'paid'];

/**
 * Stages that are not rungs but share a rung's standing. `not_sold` is a LOST outcome reached from
 * a quote, and a lost quote is not less progress than never having had one.
 *
 * ⚠ KEPT AS DATA RATHER THAN AS A BRANCH so there is one place to read, and so the mark itself
 * never stores an off-ladder value: `stageRank` resolves the alias, and every writer stores the
 * stage it was given only when that raises the mark — which `not_sold` cannot do from `lead` or
 * above. The stored mark is therefore always a LADDER value or NULL, which is exactly what the
 * SQL's `array_position` over `PROGRESS_LADDER` can rank.
 */
const STAGE_RANK_ALIASES = { not_sold: 'lead' };

/**
 * The rank of a stage on the progress ladder.
 * Input: a stage string, or null/undefined.
 * Output: 1..4 for a rung, and 0 for everything else — `not_sold`, `app_user`, null, an unknown.
 *
 * ⚠ 0 IS THE FAIL-CLOSED ANSWER AND THAT DIRECTION IS CHOSEN RATHER THAN INHERITED. An unknown
 * value ranking 0 can never be GREATER than a real rank, so it cannot raise the mark; and as the
 * mark it can never be greater than the current stage, so it cannot produce a note. A value nobody
 * anticipated therefore shows nothing, which is the safe failure for a claim about someone's job.
 */
function stageRank(stage) {
  const resolved = Object.prototype.hasOwnProperty.call(STAGE_RANK_ALIASES, stage)
    ? STAGE_RANK_ALIASES[stage]
    : stage;
  const i = PROGRESS_LADDER.indexOf(resolved);
  return i < 0 ? 0 : i + 1;
}

/**
 * Is this card's stage genuinely LOWER than the highest it previously reached?
 * Inputs: the current stage, the stored high-water mark (either may be null).
 * Output: boolean.
 *
 * ⚠ STRICTLY `<`, NEVER `<=`. At `<=` every card would carry the note, because the mark equals the
 * current stage on every row that has never moved — which is all 20 live rows the day this ships.
 * A guard-proof injects `<=` and a never-moved card then shows it.
 */
function isStageRegressed(currentStage, highWaterStage) {
  return stageRank(currentStage) < stageRank(highWaterStage);
}

/**
 * The two values a caller must bind for the raise: the incoming stage's RANK, and the value to
 * STORE if it wins.
 * Input: the stage being written (may be null when a capture failed).
 * Output: { rank, mark } — `mark` is always a LADDER value or null, never `not_sold`.
 *
 * ⚠ THE RANK IS COMPUTED HERE, IN JS, AND BOUND AS AN INTEGER — the alias cannot be expressed by
 * `array_position` alone, and writing it as a SQL CASE would put a second copy of the ordering in
 * every statement. Only the STORED side is ranked in SQL, and that is safe precisely because `mark`
 * normalises `not_sold` away, so the stored mark is always something the ladder contains.
 *
 * ⚠ A NULL STAGE RANKS 0 AND STORES NULL, so a failed capture cannot move the mark in either
 * direction.
 */
function highWaterParams(stage) {
  const rank = stageRank(stage);
  if (rank === 0) return { rank: 0, mark: null };
  return { rank, mark: PROGRESS_LADDER[rank - 1] };
}

/**
 * The SQL fragment that RAISES the mark, for use inside an UPDATE's or an upsert's SET list.
 * Inputs (as placeholder TEXT, so a caller can position its own parameters):
 *   rankParam   — the incoming stage's rank, as int (from `highWaterParams`)
 *   markParam   — the ladder value to store if it wins, as text (from `highWaterParams`)
 *   ladderParam — PROGRESS_LADDER, as text[], used to rank the STORED mark
 *   storedRef   — how to refer to the EXISTING mark. ⚠ REQUIRED RATHER THAN DEFAULTED, because the
 *     two call sites genuinely differ: a plain `UPDATE` reads it as `stage_high_water`, while an
 *     upsert's `ON CONFLICT DO UPDATE` must say `pipeline_cache.stage_high_water` to be
 *     unambiguous beside the excluded row. Defaulting one of the two would make the other silently
 *     correct-looking, and this file's own rule is that a default is a claim its absence is fine.
 * Output: a SQL string assigning `stage_high_water`.
 *
 * ⚠ IT RAISES AND NEVER LOWERS, which is the entire property. Written as a plain assignment the
 * mark would track the status and the comparison would be permanently false — a mechanism reporting
 * a state it cannot observe, which is this repo's most-recorded defect class.
 *
 * ⚠ STRICTLY GREATER THAN, SO AN EQUAL RANK IS NOT REWRITTEN. That is what keeps `not_sold` from
 * overwriting a `lead` mark with its own alias and back again on every sync.
 */
function highWaterRaiseSql(rankParam, markParam, ladderParam, storedRef) {
  if (!storedRef) {
    throw new Error('highWaterRaiseSql: storedRef is required — say how the existing mark is named');
  }
  return `stage_high_water = CASE
              WHEN ${rankParam}::int
                 > COALESCE(array_position(${ladderParam}::text[], ${storedRef}), 0)
              THEN ${markParam}::text
              ELSE ${storedRef}
            END`;
}

/**
 * The columns a referrer-pipeline payload builder must SELECT for the note to be computable.
 * Exported as a constant so the two builders cannot select different sets — the shape of defect
 * this repo records as "a writer reading a field no query selects stores NULL, and NULL reads as an
 * answer rather than as 'nobody looked'", here with the reader being a payload rather than a writer.
 */
const HIGH_WATER_SELECT_COLUMNS = ['pipeline_status', 'stage_high_water'];

/**
 * The one thing a referrer's card is told about a backwards move.
 * Input: a `pipeline_cache` row carrying `pipeline_status` and `stage_high_water`.
 * Output: boolean — true when the stage is genuinely lower than the highest reached.
 *
 * ⚠ THE SERVER DECIDES AND SENDS A BOOLEAN; THE CLIENT NEVER RECEIVES `stage_high_water`. That is
 * CD-7's precedent applied to a second field — "the server omits the value rather than the client
 * hiding it" — and it buys two things here. The mark cannot be read by any client-side code that
 * might later grow a money opinion about it, and the note's condition has exactly one
 * implementation rather than one per surface.
 *
 * ⚠ AND BOTH PAYLOAD BUILDERS MUST CALL THIS, WHICH IS FENCED RATHER THAN TRUSTED. The referrer
 * pipeline is assembled in TWO places — the adapter and `GET /api/pipeline`'s stale-cache fallback
 * — and N4 commit 7a records that the second one is "the one that would have been missed", because
 * it runs precisely when the adapter has just failed and nobody is checking the figures.
 */
function stageRegressedFromRow(row) {
  if (!row) return false;
  return isStageRegressed(row.pipeline_status, row.stage_high_water);
}

module.exports = {
  PROGRESS_LADDER,
  STAGE_RANK_ALIASES,
  stageRank,
  isStageRegressed,
  highWaterParams,
  highWaterRaiseSql,
  stageRegressedFromRow,
  HIGH_WATER_SELECT_COLUMNS,
};
