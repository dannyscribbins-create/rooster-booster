// ─────────────────────────────────────────────────────────────────────────────
// 7c-3 — THE DEFAULT SCHEDULE CONTROL, MOUNTED
//
// Danny's ruling: a clear control in the Referral Program settings to pick the default ("No bonus"
// or one of their schedules), with plain copy explaining when it applies.
//
// ⚠ THE MOUNT TEST DANNY NAMED. It renders the real `ReferralProgramSettings` against a stubbed
// fetch and asserts what a contractor actually sees and sends — not that the component returned.
// A component that throws during render leaves an EMPTY container rather than raising out of
// `render()`, so "it did not throw" is satisfied by the crash itself; every case below waits for
// real text first.
//
// ⚠ AND THE COPY IS ASSERTED TO NAME ALL THREE TRIGGERS. "When a job has no category" would cover
// one of them, and the UNMAPPED case is the one that actually surprises people — a new option added
// in Jobber and never assigned to a schedule.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import ReferralProgramSettings from './ReferralProgramSettings';

const SRC_ROOT = path.join(process.cwd(), 'src');
const read = (rel) => fs.readFileSync(path.join(SRC_ROOT, rel), 'utf8');

const SCHEDULES = [
  { id: 11, name: 'Full Roof', is_active: true, payout_model: 'escalating', job_types: ['Full Roof'],
    minimum_invoice: 1000, reset_period: 'annual', escalating_steps: [], invoice_window_days: 20 },
  { id: 12, name: 'Repair', is_active: true, payout_model: 'flat', job_types: ['Repair'],
    flat_amount: 250, reset_period: 'none', invoice_window_days: 20 },
  { id: 13, name: 'Retired One', is_active: false, payout_model: 'flat', job_types: [],
    flat_amount: 100, reset_period: 'none', invoice_window_days: 20 },
];

let patched;

function installFetch({ defaultId = null, patchFails = false } = {}) {
  patched = [];
  return vi.fn(async (url, opts = {}) => {
    const u = String(url);
    if (u.includes('/api/admin/schedules/default')) {
      patched.push(JSON.parse(opts.body));
      if (patchFails) return { ok: false, status: 500, json: async () => ({ error: 'nope' }) };
      return {
        ok: true,
        json: async () => ({ default_schedule_id: JSON.parse(opts.body).default_schedule_id }),
      };
    }
    if (u.includes('/api/admin/schedules')) {
      return {
        ok: true,
        json: async () => ({
          schedules: SCHEDULES,
          all_labels: ['Full Roof', 'Repair', 'Gutter Cleaning'],
          unassigned_labels: ['Gutter Cleaning'],
          options_known: true,
          default_schedule_id: defaultId,
          category_field_label: 'Job Type (Job)',
          category_field_entity: 'ALL_JOBS',
        }),
      };
    }
    return { ok: true, json: async () => ({}) };
  });
}

beforeEach(() => {
  localStorage.setItem('rm_admin_token', 'tok-7c3');
});
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

const card = () => document.querySelector('[data-default-schedule-card]');

describe('7c-3 — the control a contractor sees', () => {
  it('renders the card, and the page rendered its own content first', async () => {
    global.fetch = installFetch();
    render(<ReferralProgramSettings />);
    // ⚠ WAIT FOR REAL TEXT. An empty container is what a crashed render leaves behind, so asserting
    // the card alone could be satisfied by a page that never painted.
    await waitFor(() => expect(screen.getByText('Default schedule')).toBeTruthy());
    expect(card(), 'the card must be in the tree').toBeTruthy();
    // ⚠ THIS ASSERTION WAS `getByText('Full Roof')` AND IT THREW ON MULTIPLE MATCHES — because the
    // control THIS COMMIT ADDS renders "Full Roof" as a select option, so a query that was correct
    // yesterday now matches the schedule card, its job-type pill AND the option. That is this
    // repo's recorded rule arriving exactly as stated: re-check the queries near copy you ADD, not
    // only near copy you change, and anchor on structure rather than on a distinctive-sounding
    // fragment. The section heading is unique; "Inactive" does not match it under getByText's
    // exact-string semantics.
    expect(screen.getByText('Active'), 'and the rest of the page rendered too').toBeTruthy();
    expect(
      screen.getAllByText('Full Roof').length, 'the schedule appears in the list AND in the select'
    ).toBeGreaterThan(1);
  });

  it('the copy names ALL THREE triggers — blank, missing, and UNMAPPED', async () => {
    global.fetch = installFetch();
    render(<ReferralProgramSettings />);
    await waitFor(() => expect(screen.getByText('Default schedule')).toBeTruthy());
    const text = card().textContent;
    expect(text, 'blank').toMatch(/blank/i);
    expect(text, 'missing').toMatch(/missing/i);
    // ⚠ THE ONE THAT ACTUALLY SURPRISES PEOPLE: an option added in Jobber and never assigned.
    expect(text, 'the unmapped case').toMatch(/haven.t assigned to any schedule/i);
    expect(text, 'and what No bonus means').toMatch(/earn nothing/i);
  });

  it('defaults to "No bonus" when none is set, as a CHOSEN option rather than an empty control',
    async () => {
      global.fetch = installFetch({ defaultId: null });
      render(<ReferralProgramSettings />);
      await waitFor(() => expect(screen.getByText('Default schedule')).toBeTruthy());
      const select = screen.getByLabelText(/Applies when nothing matches/i);
      expect(select.value).toBe('');
      const chosen = [...select.options].find((o) => o.selected);
      expect(chosen.textContent, '"No bonus" is the visible, selected answer').toBe('No bonus');
    });

  it('offers ONLY active schedules, matching the server’s own check', async () => {
    global.fetch = installFetch();
    render(<ReferralProgramSettings />);
    await waitFor(() => expect(screen.getByText('Default schedule')).toBeTruthy());
    const select = screen.getByLabelText(/Applies when nothing matches/i);
    const labels = [...select.options].map((o) => o.textContent);
    expect(labels).toEqual(['No bonus', 'Full Roof', 'Repair']);
    expect(labels, 'a retired schedule must not be offerable').not.toContain('Retired One');
  });

  it('shows the contractor’s existing choice', async () => {
    global.fetch = installFetch({ defaultId: 12 });
    render(<ReferralProgramSettings />);
    await waitFor(() => expect(screen.getByText('Default schedule')).toBeTruthy());
    const select = screen.getByLabelText(/Applies when nothing matches/i);
    expect(select.value).toBe('12');
  });

  it('PICKING a schedule sends its integer id', async () => {
    global.fetch = installFetch({ defaultId: null });
    render(<ReferralProgramSettings />);
    await waitFor(() => expect(screen.getByText('Default schedule')).toBeTruthy());
    const select = screen.getByLabelText(/Applies when nothing matches/i);

    fireEvent.change(select, { target: { value: '11' } });
    await waitFor(() => expect(patched.length).toBe(1));
    expect(patched[0]).toEqual({ default_schedule_id: 11 });
    expect(typeof patched[0].default_schedule_id, 'an INTEGER, not the string from the select')
      .toBe('number');
  });

  it('PICKING "No bonus" sends an explicit NULL, not an omitted key', async () => {
    // ⚠ THE SERVER REQUIRES THE KEY TO BE PRESENT, because null is a legitimate value and an
    // absent one is a malformed request. Sending `{}` would 400, and a contractor trying to turn
    // the default off would see a failure.
    global.fetch = installFetch({ defaultId: 11 });
    render(<ReferralProgramSettings />);
    await waitFor(() => expect(screen.getByText('Default schedule')).toBeTruthy());
    const select = screen.getByLabelText(/Applies when nothing matches/i);

    fireEvent.change(select, { target: { value: '' } });
    await waitFor(() => expect(patched.length).toBe(1));
    expect(Object.prototype.hasOwnProperty.call(patched[0], 'default_schedule_id')).toBe(true);
    expect(patched[0].default_schedule_id).toBe(null);
  });

  it('A FAILED SAVE SAYS SO AND DOES NOT MOVE THE VALUE', async () => {
    // ⚠ NOT OPTIMISTIC, UNLIKE THE ACTIVE/INACTIVE TOGGLE, AND THIS IS THE CASE THAT PINS IT.
    // Showing a change that did not persist would tell a contractor their fallback is one schedule
    // while the engine uses another — on the control that decides what unmapped jobs pay.
    global.fetch = installFetch({ defaultId: null, patchFails: true });
    render(<ReferralProgramSettings />);
    await waitFor(() => expect(screen.getByText('Default schedule')).toBeTruthy());
    const select = screen.getByLabelText(/Applies when nothing matches/i);

    fireEvent.change(select, { target: { value: '11' } });
    await waitFor(() => expect(card().textContent).toMatch(/Nothing was changed/i));
    expect(select.value, 'the value must not have moved').toBe('');
  });

  it('the select is REACHABLE BY ITS LABEL, which is what keeps this test honest', async () => {
    // Without the label/id association every case above would have to query a bare `select`, and
    // would silently start matching a different one the day a second is added to this screen.
    const src = read('components/admin/ReferralProgramSettings.jsx');
    expect(src).toMatch(/htmlFor="default-schedule-select"/);
    expect(src).toMatch(/id="default-schedule-select"/);
  });
});

describe('7c-3 — what the control must not do', () => {
  it('it renders for a contractor with NO schedules yet', async () => {
    // ⚠ "No bonus" IS A REAL ANSWER, so the contractor should be able to see what happens today
    // before they have built anything. Hiding the card until a schedule exists would make the
    // starting state invisible.
    global.fetch = vi.fn(async (url) => {
      if (String(url).includes('/api/admin/schedules')) {
        return {
          ok: true,
          json: async () => ({
            schedules: [], all_labels: [], unassigned_labels: [], options_known: false,
            default_schedule_id: null, category_field_label: null, category_field_entity: null,
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });
    render(<ReferralProgramSettings />);
    await waitFor(() => expect(screen.getByText('Default schedule')).toBeTruthy());
    const select = screen.getByLabelText(/Applies when nothing matches/i);
    expect([...select.options].map((o) => o.textContent)).toEqual(['No bonus']);
  });

  it('it is not an alert — no amber or danger treatment on the card', async () => {
    // The default is a setting, not a warning. The unassigned-options warning beside it is the
    // thing that IS amber, and conflating the two would make a normal choice look like a problem.
    global.fetch = installFetch();
    render(<ReferralProgramSettings />);
    await waitFor(() => expect(screen.getByText('Default schedule')).toBeTruthy());
    const style = card().getAttribute('style') || '';
    expect(style, 'no amber ground').not.toMatch(/217,\s*119,\s*6/);
    expect(style, 'no danger ground').not.toMatch(/220,\s*38,\s*38/);
  });
});
