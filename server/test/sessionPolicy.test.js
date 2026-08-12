'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3b — PHASE 4 — SESSION SLIDE POLICY (D7, piece 4)
//
// Governing spec: CDL_3b_BUILD_SPEC.md §6, decision D7.
//
// This file tests the PURE decision function only — no database, no HTTP. The
// wiring lives in sessionPersistence.test.js. Separated because the arithmetic
// here is the part that is easy to get subtly wrong and impossible to observe
// in production until a token outlives its welcome by two months.
//
// THREE NUMBERS, ONE POLICY, ALL THREE ROLES:
//   slide     30 days   — how far out each bump pushes expires_at
//   cap       90 days   — measured from created_at, never from the last bump
//   throttle   1 hour   — minimum gap between two writes
//
// THE THROTTLE IS INFERRED, NOT STORED, AND THAT IS THE ONE DESIGN CHOICE HERE
// WORTH ARGUING WITH. §6.2 rules Phase 4 has no schema change, so there is no
// last_bumped_at column. Instead the last bump is derived: a session slid at
// time T has expires_at = T + 30d, so T = expires_at - 30d. Exact for any
// session minted or bumped under this policy. For a LEGACY 24h session the
// inference reads far in the past, which bumps it immediately on first touch —
// the correct upgrade behaviour, arrived at by accident of the arithmetic
// rather than by a special case, so it is asserted below rather than assumed.
//
// THE CAP MUST WIN. A slide with a broken cap is an immortal token: every
// request pushes expiry 30 days out, forever, and the session never dies. That
// is the single most consequential assertion in this file.
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  computeSessionSlide,
  SESSION_SLIDE_MS,
  SESSION_ABSOLUTE_CAP_MS,
  SESSION_BUMP_THROTTLE_MS,
} = require('../utils/sessionPolicy');

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// A fixed instant. Date.now() is never called in this file — a policy that
// behaves differently depending on when the suite runs is not a policy.
const NOW = new Date('2026-06-01T12:00:00.000Z');
const at = ms => new Date(NOW.getTime() + ms);

describe('C/DL-3b Phase 4 — session slide policy (D7)', () => {

  describe('the three constants', () => {
    it('slide is 30 days, cap is 90 days, throttle is 1 hour', () => {
      assert.equal(SESSION_SLIDE_MS, 30 * DAY, 'slide must be 30 days');
      assert.equal(SESSION_ABSOLUTE_CAP_MS, 90 * DAY, 'cap must be 90 days');
      assert.equal(SESSION_BUMP_THROTTLE_MS, HOUR, 'throttle must be 1 hour');
    });

    it('the cap is strictly longer than the slide', () => {
      // If cap <= slide the cap would bind on the very first request and the
      // slide would be decorative. Guards against someone "simplifying" the
      // numbers to the same value.
      assert.ok(
        SESSION_ABSOLUTE_CAP_MS > SESSION_SLIDE_MS,
        'a cap at or below the slide makes the slide meaningless'
      );
    });
  });

  describe('the slide', () => {
    it('extends an active session that has not been bumped this hour', () => {
      // Bumped 2 hours ago: expires_at = (NOW - 2h) + 30d.
      const result = computeSessionSlide({
        createdAt: at(-10 * DAY),
        expiresAt: at(30 * DAY - 2 * HOUR),
        now: NOW,
      });

      assert.equal(result.shouldBump, true, 'a 2-hour-old bump must be re-slid');
      assert.equal(
        result.nextExpiresAt.getTime(), NOW.getTime() + SESSION_SLIDE_MS,
        'the new expiry must be exactly now + 30 days'
      );
    });

    it('upgrades a LEGACY 24-hour session on first touch', () => {
      // Every session minted before this phase carries a 24h expiry. The
      // inferred last-bump reads ~29 days in the past, so the throttle does not
      // block it and it lands on the new policy immediately.
      const result = computeSessionSlide({
        createdAt: NOW,
        expiresAt: at(DAY),
        now: NOW,
      });

      assert.equal(result.shouldBump, true, 'a legacy 24h session must be upgraded, not left short');
      assert.equal(result.nextExpiresAt.getTime(), NOW.getTime() + SESSION_SLIDE_MS);
    });
  });

  describe('the throttle', () => {
    it('suppresses a second bump within the hour', () => {
      // Bumped 10 minutes ago: expires_at = (NOW - 10m) + 30d.
      const result = computeSessionSlide({
        createdAt: at(-10 * DAY),
        expiresAt: at(30 * DAY - 10 * 60 * 1000),
        now: NOW,
      });

      assert.equal(result.shouldBump, false, 'a bump 10 minutes old must not write again');
      assert.equal(result.reason, 'throttled');
    });

    it('permits the bump once the hour has elapsed exactly', () => {
      const result = computeSessionSlide({
        createdAt: at(-10 * DAY),
        expiresAt: at(30 * DAY - SESSION_BUMP_THROTTLE_MS),
        now: NOW,
      });

      assert.equal(result.shouldBump, true, 'at exactly the throttle boundary the bump is allowed');
    });
  });

  describe('THE ABSOLUTE CAP — the assertion that matters', () => {
    it('a session continuously active past 90 days still dies', () => {
      // Created 89 days and 23 hours ago, still being used. The slide wants to
      // push expiry 30 days out. The cap says it may reach created + 90d and
      // not one millisecond further — i.e. one hour from now.
      const createdAt = at(-(90 * DAY - HOUR));
      const result = computeSessionSlide({
        createdAt,
        expiresAt: at(HOUR),
        now: NOW,
      });

      assert.equal(
        result.shouldBump, false,
        'CAP BREACH: the slide extended a session that has reached its 90-day ceiling'
      );
      // And the ceiling is where it already sits, so it dies in an hour.
      assert.equal(createdAt.getTime() + SESSION_ABSOLUTE_CAP_MS, NOW.getTime() + HOUR);
    });

    it('never proposes an expiry beyond created_at + 90 days', () => {
      // Sweep the whole lifetime at 6-hour resolution. Any single point where
      // the slide outruns the cap is an immortal token.
      const createdAt = at(-100 * DAY);
      for (let ageHours = 0; ageHours <= 100 * 24; ageHours += 6) {
        const now = new Date(createdAt.getTime() + ageHours * HOUR);
        const result = computeSessionSlide({
          createdAt,
          // Pretend the session was last bumped a day ago, so the throttle
          // never masks a cap failure.
          expiresAt: new Date(now.getTime() - DAY + SESSION_SLIDE_MS),
          now,
        });
        if (result.shouldBump) {
          assert.ok(
            result.nextExpiresAt.getTime() <= createdAt.getTime() + SESSION_ABSOLUTE_CAP_MS,
            `CAP BREACH at age ${ageHours}h: proposed ${result.nextExpiresAt.toISOString()}, ` +
            `ceiling ${new Date(createdAt.getTime() + SESSION_ABSOLUTE_CAP_MS).toISOString()}`
          );
        }
      }
    });

    it('does not resurrect a session that is already past its cap', () => {
      const result = computeSessionSlide({
        createdAt: at(-100 * DAY),
        expiresAt: at(-HOUR),
        now: NOW,
      });
      assert.equal(result.shouldBump, false, 'an expired, past-cap session must never be extended');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // THE TWO CLOCKS MEET AT THE CAP
  //
  // The cap is measured from created_at. The throttle is INFERRED from
  // expires_at - 30d. Those are different anchors, and in the final 30 days of a
  // session's life they disagree in a specific way worth pinning rather than
  // reasoning about:
  //
  // Once expires_at reaches the ceiling it stops moving, so the inferred
  // lastBump freezes at (cap - 30d) while `now` keeps advancing. By day 89 the
  // inference reads "last bumped 29 days ago" and the THROTTLE WOULD HAPPILY
  // ALLOW A WRITE. The only thing preventing one is the no_gain guard, which is
  // checked FIRST. That ordering is load-bearing and invisible — nothing about
  // reading the two `if` blocks suggests that swapping them, or relaxing
  // no_gain, uncaps every session in the system.
  //
  // So these assert the REASON, not merely the outcome. A test that only checked
  // shouldBump would stay green if the throttle became the thing doing the
  // blocking, which is a coincidence, not a cap.
  //
  // MEASURED, by swapping the two guards and re-running (Phase 4 review):
  // reordering does NOT change the answer for a session sitting exactly at its
  // ceiling — there the inference reads 29 days stale, the throttle declines to
  // fire, and no_gain blocks either way. What reordering DOES break is every
  // state where the inference lands in the FUTURE, which is why the last two
  // tests here exist and why they are the ones that go red. The ordering is
  // load-bearing, but not at the place first assumed.
  // ═══════════════════════════════════════════════════════════════════════════
  describe('the inferred throttle at the 90-day boundary', () => {
    const CREATED = at(-89 * DAY);
    const CEILING = new Date(CREATED.getTime() + SESSION_ABSOLUTE_CAP_MS);

    it('a capped session is blocked by no_gain, NOT by the throttle', () => {
      const result = computeSessionSlide({ createdAt: CREATED, expiresAt: CEILING, now: NOW });

      assert.equal(result.shouldBump, false);
      assert.equal(
        result.reason, 'no_gain',
        'the CAP must be what blocks a capped session. If this reads "throttled", the cap has ' +
        'become dependent on write timing rather than on created_at.'
      );

      // And the inference really is stale enough to have permitted a write —
      // i.e. the danger this test describes is real, not hypothetical.
      const inferredLastBump = CEILING.getTime() - SESSION_SLIDE_MS;
      assert.ok(
        NOW.getTime() - inferredLastBump >= SESSION_BUMP_THROTTLE_MS,
        'precondition: the throttle would have allowed this write on its own'
      );
    });

    it('no state in the final 30 days bumps a session already at its ceiling', () => {
      // Hourly resolution across the entire capped window — the region where the
      // two anchors disagree most.
      for (let ageHours = 60 * 24; ageHours <= 90 * 24; ageHours += 1) {
        const createdAt = at(-ageHours * HOUR);
        const ceiling = new Date(createdAt.getTime() + SESSION_ABSOLUTE_CAP_MS);
        if (ceiling.getTime() <= NOW.getTime()) continue; // already dead; not this test's case
        const result = computeSessionSlide({ createdAt, expiresAt: ceiling, now: NOW });
        assert.equal(
          result.shouldBump, false,
          `CAP BREACH at age ${(ageHours / 24).toFixed(2)}d: a session at its ceiling was extended`
        );
      }
    });

    it('a SUB-cap session in the final window gets exactly one bump, to the ceiling, then none', () => {
      // Created 79 days ago, last used 29 days ago (so expires_at sits below the
      // ceiling). It is entitled to one more extension — but only up to the cap.
      const createdAt = at(-79 * DAY);
      const ceiling = new Date(createdAt.getTime() + SESSION_ABSOLUTE_CAP_MS);
      const expiresAt = at(SESSION_SLIDE_MS - 29 * DAY);

      const first = computeSessionSlide({ createdAt, expiresAt, now: NOW });
      assert.equal(first.shouldBump, true, 'a sub-cap session must still be extendable');
      assert.equal(
        first.nextExpiresAt.getTime(), ceiling.getTime(),
        'the extension must land exactly ON the ceiling, not 30 days past it'
      );

      // Immediately afterwards, from the state it just wrote.
      const second = computeSessionSlide({ createdAt, expiresAt: first.nextExpiresAt, now: NOW });
      assert.equal(second.shouldBump, false, 'the session must not be extendable a second time');
      assert.equal(second.reason, 'no_gain');
    });

    it('the inferred lastBump is never in the FUTURE, at any age', () => {
      // A future-dated lastBump is the nonsense state: `now - lastBump` goes
      // negative, which is < the throttle and therefore reads as "just bumped".
      // Harmless today because no_gain fires first, but it would make the
      // throttle silently wrong if the ordering ever changed — so pin that the
      // arithmetic never produces it for any reachable expires_at.
      const createdAt = at(-100 * DAY);
      for (let ageHours = 0; ageHours <= 100 * 24; ageHours += 6) {
        const now = new Date(createdAt.getTime() + ageHours * HOUR);
        const ceiling = createdAt.getTime() + SESSION_ABSOLUTE_CAP_MS;
        // The furthest expires_at this policy can ever have written by `now`.
        const expiresAt = new Date(Math.min(now.getTime() + SESSION_SLIDE_MS, ceiling));
        const inferredLastBump = expiresAt.getTime() - SESSION_SLIDE_MS;
        assert.ok(
          inferredLastBump <= now.getTime(),
          `NONSENSE INFERENCE at age ${ageHours}h: lastBump resolves to the future`
        );
      }
    });

    it('a session whose expires_at was somehow written PAST the ceiling is still never bumped', () => {
      // Defensive: a bad manual UPDATE, or a row written by a future policy.
      // Both guards should decline, and the cap must not be quietly re-derived
      // from the corrupted value.
      const createdAt = at(-89 * DAY);
      const result = computeSessionSlide({
        createdAt,
        expiresAt: at(40 * DAY),   // well beyond created_at + 90d
        now: NOW,
      });
      assert.equal(result.shouldBump, false, 'an over-long expiry must never be extended further');
      assert.equal(result.reason, 'no_gain');
    });
  });

  describe('monotonicity — a slide must never SHORTEN a session', () => {
    it('declines to write when the stored expiry is already further out', () => {
      // A session whose expires_at was set beyond what the slide would give.
      // Writing here would move expiry BACKWARD and log people out early.
      const result = computeSessionSlide({
        createdAt: at(-DAY),
        expiresAt: at(60 * DAY),
        now: NOW,
      });

      assert.equal(result.shouldBump, false, 'the slide must never shorten an existing expiry');
      assert.equal(result.reason, 'no_gain');
    });
  });

  describe('defensive inputs', () => {
    it('treats a null created_at as "created now" rather than throwing', () => {
      // sessions.created_at carries a DEFAULT but is not NOT NULL. A row with a
      // null here must degrade to the shortest safe answer, not crash auth.
      const result = computeSessionSlide({
        createdAt: null,
        expiresAt: at(DAY),
        now: NOW,
      });
      assert.equal(typeof result.shouldBump, 'boolean', 'a null created_at must not throw');
    });
  });
});
