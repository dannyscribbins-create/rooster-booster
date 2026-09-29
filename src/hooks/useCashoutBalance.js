import { useState, useEffect } from 'react';
import { BACKEND_URL } from '../config/contractor';

// ── THE ONE PLACE `src/` LEARNS A REFERRER'S BALANCE ─────────────────────────
//
// ⚠ IT EXISTS BECAUSE THREE SCREENS ANSWERED THE SAME QUESTION THREE DIFFERENT WAYS, AND
// TWO OF THEM WERE WRONG. Cash Out summed the speculative `500 + boost` ladder client-side;
// Profile summed `conversion_bonus ?? payout`; the Dashboard rendered `data.balance` — the
// server's speculative pipeline total — handed down as a PROP from App.jsx. None of the
// three subtracted a single cash-out. One account read $500 on the Dashboard and $0 on the
// other two on the same day.
//
// ⚠ AND THE DASHBOARD IS WHY THIS IS A HOOK RATHER THAN A FENCE ON ARITHMETIC. The earlier
// fence forbade a client-side SUM (`reduce(` beside `payout`), which caught Cash Out and
// Profile because they CALCULATED. The Dashboard calculates nothing — it renders a number
// that arrived ready-made from an API field — so a fence for the shape of a calculation was
// structurally blind to it. **A value that arrives already wrong is still wrong.** The fix is
// a single SOURCE, and `src/components/referrer/balanceRenderSites.test.jsx` fences every
// render site against it.
//
// ⚠ THE SERVER'S FIGURE IS THE TRUE ONE, NEGATIVE INCLUDED. `GET /api/cashout/balance`
// returns `earned − every non-denied cash-out` from `server/utils/cashoutBalance.js`, the
// same function the cash-out gate uses. It is never clamped at the source: the admin panel
// needs the real figure, and clamping would destroy the evidence the policy-B write-off
// needs (PRE_LAUNCH_CHECKLIST.md, money-phase gate).
//
// ⚠ `known` IS NOT `available !== 0`. A balance that has not loaded yet is a different state
// from a balance of zero, and rendering "$0" while the request is in flight states a figure
// the screen has no basis for. Every caller branches on `known` before showing anything.

/**
 * Reads the referrer's true available balance from the server.
 *
 * Input:  token — the referrer's bearer token. Absent means "do not ask yet".
 * Output: { available, earned, deducted, known, error }
 *   available — dollars, MAY BE ZERO OR NEGATIVE and is deliberately not clamped here.
 *               Clamping belongs to the DISPLAY, and only where a ruling says so.
 *   known     — false until a well-formed answer has arrived. Never infer it from a value.
 *   error     — true if the request failed or returned something unusable.
 */
export function useCashoutBalance(token) {
  const [state, setState] = useState({
    available: null, earned: null, deducted: null, known: false, error: false,
  });

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function fetchBalance() {
      try {
        const r = await fetch(`${BACKEND_URL}/api/cashout/balance`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await r.json();
        if (cancelled) return;
        // ⚠ Number.isFinite, NOT `d.available ||` AND NOT `!= null`. `available` is
        // legitimately 0 and legitimately NEGATIVE, so a truthiness check discards the two
        // answers that matter most; `!= null` admits a string, and "$" + "lots" renders
        // "$lots". This is CLAUDE.md's "the predicate matches its own VALUE's shape".
        if (Number.isFinite(d?.available)) {
          setState({
            available: d.available,
            earned: Number.isFinite(d?.earned) ? d.earned : null,
            deducted: Number.isFinite(d?.deducted) ? d.deducted : null,
            known: true,
            error: false,
          });
        } else {
          setState(s => ({ ...s, known: false, error: true }));
        }
      } catch {
        // ⚠ FAIL CLOSED, NOT TO ZERO. If the balance cannot be read the screen says so and
        // the request stays blocked; inventing a number here is how the defect this replaces
        // came to exist in the first place.
        if (!cancelled) setState(s => ({ ...s, known: false, error: true }));
      }
    }
    fetchBalance();
    return () => { cancelled = true; };
  }, [token]);

  return state;
}
