// ─────────────────────────────────────────────────────────────────────────────
// THE BRANDING PREVIEW'S DASHBOARD FIXTURE — DATA ONLY (Preview-1, P1/P2)
//
// The dashboard view of the branding preview mounts the REAL referrer
// `Dashboard` component. That component is prop-driven end to end, so the only
// thing it needs to render faithfully is a set of props. This file is that set.
//
// ── ⚠ DATA ONLY. NO COLOUR, NO BRAND VALUES, NO COPY THAT NAMES ANYONE ──────
// P1 rules the preview's data is invented. Everything a contractor SEES that is
// theirs — palette, fonts, logo, company name, review URL — arrives through the
// branding chain from their own draft, never from here. If a hex, a font family
// or a company name ever appears in this file, the preview has started lying
// about which half is theirs.
//
// ── ⚠ ZERO NETWORK, AND THE LEVER IS ONE OMITTED PROP ───────────────────────
// `sessionToken` is DELIBERATELY ABSENT from every variant. `Dashboard`'s
// `/about` effect and `RewardScheduleCard`'s `/schedules` effect both open with
// `if (!sessionToken) return`, so omitting it is what makes the preview silent.
// ⚠ DO NOT ADD A `sessionToken` TO A VARIANT TO "make the About card appear."
// That single prop re-arms two fetches, and one of them can open a modal —
// see the footgun below.
//
// ── ⚠ THE `aboutData` FOOTGUN, WRITTEN DOWN BECAUSE IT IS ONE WORD WIDE ─────
// `Dashboard` carries exactly one mount-time modal opener:
//
//     useEffect(() => {
//       if (aboutData && !aboutData.about_modal_seen) setShowAboutModal(true);
//     }, [aboutData]);
//
// Today `aboutData` is internal state fed ONLY by the `/about` fetch, so with no
// token it stays null and the modal is structurally unopenable. That is why the
// zero-network guarantee and the no-modals guarantee are the SAME guarantee.
//
// ⚠ IF ANYONE EVER SUPPLIES `aboutData` — as a prop, to render the About Us card
// in the preview — IT MUST CARRY `about_modal_seen: true`. Without it the modal
// auto-opens INSIDE the preview casing on mount. `PreviewFrame` sets
// `pointer-events: none` on the frame body, which stops interaction but does NOT
// stop a modal from appearing; the contractor would be looking at a preview of a
// dialog they did not open and cannot close.
//
// ── ⚠ EVERY VARIANT EXISTS TO MAKE SOMETHING VISIBLE ────────────────────────
// P4's eye test is only as good as the data behind it: a defect the sample data
// never renders cannot be eye-tested. Each variant below names the thing it
// exists to show. Deleting one silently removes a surface from the eye test.
// ─────────────────────────────────────────────────────────────────────────────

const NOOP = () => {};

// ⚠ OBVIOUSLY INVENTED, AND CHECKED AGAINST THE SEEDED CONTRACTORS. No real
// homeowner and no real contractor (P1). These are ordinary two-part names with
// no connection to any tenant in this repo's fixtures or seed data.
const PEOPLE = Object.freeze([
  'Sam Rivera', 'Casey Nguyen', 'Morgan Patel',
  'Riley Okafor', 'Devon Marsh', 'Quinn Ellis',
]);

// ── ⚠ THE DASHBOARD RENDERS AT MOST THREE PIPELINE ROWS ─────────────────────
// `Dashboard` slices: `pipeline.slice(0, 3).map(...)`. A single six-entry
// fixture therefore eye-tests THREE pills while LOOKING like it covers six —
// the shape of a fixture that reports coverage it does not have.
//
// So the seven `STATUS_CONFIG` stages are split across TWO variants of three,
// and `default` carries the priority one. Entry shape is `{ id, name, status }`,
// read from the component rather than assumed: it uses `ref.id`, `ref.name`
// (split for initials) and `ref.status` (handed to `StatusBadge`).
//
// ⚠ `lead` IS FIRST IN `default` ON PURPOSE. It was the arc's headline defect:
// `STATUS_CONFIG.lead` measured `#6b7280` on `#f3f4f6` = 4.39:1 against a 4.5
// floor, mode-blind. ⚠ **FIXED 2026-09-16 — the label is now `#4B5563` at
// 6.87:1** (ruled by Danny; the value the admin palette had already moved the
// identical pair to). It stays first anyway: it is the pair with a history, so
// it is the one a future eye test should still be able to reach without
// hunting, and it must not be the one that falls off the end of a slice.
const PIPELINE_EARLY = Object.freeze([
  Object.freeze({ id: 'pf-1', name: PEOPLE[0], status: 'lead' }),
  Object.freeze({ id: 'pf-2', name: PEOPLE[1], status: 'inspection' }),
  Object.freeze({ id: 'pf-3', name: PEOPLE[2], status: 'sold' }),
]);

const PIPELINE_LATE = Object.freeze([
  Object.freeze({ id: 'pf-4', name: PEOPLE[3], status: 'booking_pending' }),
  Object.freeze({ id: 'pf-5', name: PEOPLE[4], status: 'app_user' }),
  Object.freeze({ id: 'pf-6', name: PEOPLE[5], status: 'complete' }),
]);

// ⚠ `closed` ("Not Sold") IS THE SEVENTH STAGE AND HAS ITS OWN VARIANT, because
// it is the only one whose colours are RAW LITERALS in `STATUS_CONFIG`
// (`#b91c1c` / `#ef4444` / `#fee2e2`) rather than `R` keys — a different defect
// class from its six siblings, and invisible unless it renders.
const PIPELINE_CLOSED = Object.freeze([
  Object.freeze({ id: 'pf-7', name: PEOPLE[0], status: 'closed' }),
  Object.freeze({ id: 'pf-8', name: PEOPLE[1], status: 'lead' }),
  Object.freeze({ id: 'pf-9', name: PEOPLE[2], status: 'complete' }),
]);

// ⚠ SUPPLIED AS A PROP SO `RewardScheduleCard` MAKES NO FETCH.
//
// ⚠ THE SHAPE IS READ FROM THE REAL PRODUCER, NOT IMAGINED. It mirrors the
// SELECT in `GET /api/referrer/schedules` exactly — `id, name, payout_model,
// minimum_invoice, reset_period, escalating_steps, tier_brackets, flat_amount,
// percentage_rate, percentage_max_cap, job_type_labels`. A first draft of this
// file invented `{ label, amount }` steps and would have rendered NOTHING:
// `SchedulePane` dispatches on `payout_model` and returns null for a shape it
// does not recognise, so the card would have looked empty rather than broken.
// **Building a fixture against an imagined response shape is the same defect as
// building a screen against one** — it just fails more quietly.
//
// TWO schedules, so the card's TAB STRIP renders (`schedules.length > 1`), and
// two DIFFERENT payout models, so both table layouts are eye-testable.
const SCHEDULES = Object.freeze([
  Object.freeze({
    id: 'pf-sched-1',
    name: 'Standard',
    payout_model: 'escalating',
    minimum_invoice: 500,
    reset_period: 'annual',
    escalating_steps: Object.freeze([
      Object.freeze({ referral_number: 1, payout_amount: 50 }),
      Object.freeze({ referral_number: 2, payout_amount: 75 }),
      Object.freeze({ referral_number: 3, payout_amount: 125 }),
    ]),
    tier_brackets: null,
    flat_amount: null,
    percentage_rate: null,
    percentage_max_cap: null,
    job_type_labels: Object.freeze(['Roof Replacement', 'Roof Repair']),
  }),
  Object.freeze({
    id: 'pf-sched-2',
    name: 'Seasonal',
    payout_model: 'flat',
    minimum_invoice: null,
    reset_period: null,
    escalating_steps: null,
    tier_brackets: null,
    flat_amount: 100,
    percentage_rate: null,
    percentage_max_cap: null,
    job_type_labels: Object.freeze(['Gutter Installation']),
  }),
]);

// The shared base. Variants below override only what they need to expose.
//
// ⚠ `profilePhoto: null` IS LOAD-BEARING, NOT AN OMISSION. It forces
// `AvatarCircle`'s INITIALS path.
// ⚠ AND THE REASON GIVEN HERE WAS WRONG — it said this is "where the second
// 4.39:1 pair was alleged". It is not: `AvatarCircle` reads neither `R.grayText`
// nor `STATUS_CONFIG`, verified by a needle validated against its own known
// positive. AD-3 listed "avatar initials, same pair" among six defects and that
// entry was already mistaken; Canvass-0 S13 reached the same conclusion from the
// other direction. The initials path is still worth rendering — it is what a
// referrer without a photo sees — but not for the reason once written here.
//
// ⚠ `balance` IS DELIBERATELY NOT ROUND. A round number reads as a placeholder
// and tells a contractor nothing about how their money tone sits on their fill.
const BASE = Object.freeze({
  setTab: NOOP,
  pipeline: PIPELINE_EARLY,
  loading: false,
  pipelineRateLimited: false,
  pipelineStale: false,
  pipelineStaleSince: null,
  pipelineUnavailable: false,
  userName: 'Jordan Avery',
  balance: 275,
  paidCount: 3,
  profilePhoto: null,
  showReviewCard: true,
  onDismissReview: NOOP,
  // ⚠ ABSENT ON PURPOSE — see the zero-network note at the top.
  // sessionToken: undefined,
  onViewAllReferrals: NOOP,
  bankStatus: Object.freeze({ connected: false }),
  onOpenBankSetup: NOOP,
  schedules: SCHEDULES,
});

/**
 * The named fixture variants, each existing to make one thing visible.
 *
 * ⚠ THE KEYS ARE THE UI's OWN VALUES. The variant picker in `BrandingPreview`
 * renders one control per entry of `PREVIEW_FIXTURE_VARIANTS` and selects by
 * key, so adding a variant here adds it to the panel with no other edit — and
 * a hand-maintained list somewhere else cannot drift out of step with this one.
 *
 * @type {Readonly<Record<string, Readonly<object>>>}
 */
export const PREVIEW_FIXTURE = Object.freeze({
  // The ordinary loaded state.
  // SHOWS: the "Lead Submitted" (now 6.87:1), "Inspection Completed" and
  //        "Sold ✓" pills · the muted body copy · the card hairlines · the reward
  //        schedule TAB STRIP and the escalating table · the bank banner.
  default: BASE,

  // SHOWS: the three LATE stages — "Booking Sent", "In App", "Complete ✓".
  // Exists because the dashboard slices to three rows, so these are
  // unreachable from `default` no matter how many entries it carries.
  'late-stages': Object.freeze({ ...BASE, pipeline: PIPELINE_LATE }),

  // SHOWS: "Not Sold" — the one stage whose colours are raw literals rather
  //        than `R` keys, so it moves independently of every other pill.
  'closed-stage': Object.freeze({ ...BASE, pipeline: PIPELINE_CLOSED }),

  // SHOWS: the `statusVar('warning')` / `warningText` stale banner.
  stale: Object.freeze({
    ...BASE,
    pipelineStale: true,
    pipelineStaleSince: '2026-09-15T09:00:00.000Z',
  }),

  // SHOWS: the rate-limit banner, the second `warning` pairing.
  'rate-limited': Object.freeze({ ...BASE, pipelineRateLimited: true }),

  // SHOWS: the `statusVar('danger')` / `dangerText` pairing — the only place
  //        the danger tones appear on this tab.
  unavailable: Object.freeze({ ...BASE, pipelineUnavailable: true }),

  // SHOWS: the INLINE empty state ("No referrals yet — start sending names…").
  // ⚠ THIS IS NOT `StateCard`. Checked, not assumed: `StateCard` is not reached
  // from `Dashboard` at all, so the shared empty-state primitive cannot be
  // eye-tested from this surface and must not be listed as though it can.
  'empty-pipeline': Object.freeze({ ...BASE, pipeline: Object.freeze([]) }),
});

/**
 * Variant keys in the order the picker shows them.
 * Derived from the object above so the two cannot disagree.
 * @type {readonly string[]}
 */
export const PREVIEW_FIXTURE_VARIANTS = Object.freeze(Object.keys(PREVIEW_FIXTURE));

/** The variant selected when the dashboard view is first opened. */
export const PREVIEW_FIXTURE_DEFAULT = 'default';
