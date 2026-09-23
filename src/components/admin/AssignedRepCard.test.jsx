import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AssignedRepCard from './AssignedRepCard';

// ── THE CORRECTION PATH, ON THE CLIENT RECORD (Danny, 2026-09-22) ────────────
//
// ⚠ THE EMPTY STATE IS THE ONE THAT MATTERS MOST. 1,990 of Accent's clients are
// unassigned and correctly so, because nobody is mapped yet — so a card that rendered
// "none" as a warning would be shouting at a contractor about the normal state of their
// account on the day they start.

const LOCKED = {
  rep_id: 7, rep_name: 'Rep One', rep_active: true, state: 'locked',
  source: 'manual', source_label: 'Set by an admin', set_at: '2026-09-20T12:00:00Z', written_by: 'manual',
};
const PROVISIONAL = {
  rep_id: 9, rep_name: 'Rep Two', rep_active: true, state: 'provisional',
  source: 'mode_a', source_label: 'On the assessment for this visit', set_at: '2026-09-18T12:00:00Z', written_by: 'replay',
};

let fetchCalls;
function installFetch({ team = [{ id: 7, full_name: 'Rep One', is_attributable: true, active: true },
  { id: 9, full_name: 'Rep Two', is_attributable: true, active: true },
  { id: 11, full_name: 'Office Person', is_attributable: false, active: true }],
patchStatus = 200, patchBody = { assignment: null } } = {}) {
  fetchCalls = [];
  global.fetch = vi.fn(async (url, opts = {}) => {
    fetchCalls.push({ url: String(url), method: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : null });
    if (String(url).includes('/api/admin/team/client-assignment/')) {
      return { ok: patchStatus < 400, status: patchStatus, json: async () => patchBody };
    }
    if (String(url).endsWith('/api/admin/team')) {
      return { ok: true, status: 200, json: async () => team };
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

beforeEach(() => installFetch());
afterEach(() => { vi.restoreAllMocks(); });

describe('AssignedRepCard', () => {
  it('shows the rep, the locked state, the source in plain language and the date', () => {
    render(<AssignedRepCard assignment={LOCKED} jobberClientId="c1" token="t" />);
    expect(screen.getByText('Rep One')).toBeTruthy();
    expect(screen.getByText('Locked')).toBeTruthy();
    expect(screen.getByText(/Set by an admin/)).toBeTruthy();
    expect(screen.getByText(/Sep 20, 2026/)).toBeTruthy();
  });

  it('⚠ a PROVISIONAL assignment says it can still change — confidence, not ownership', () => {
    render(<AssignedRepCard assignment={PROVISIONAL} jobberClientId="c1" token="t" />);
    expect(screen.getByText('Provisional')).toBeTruthy();
    expect(screen.getByText(/can still change/)).toBeTruthy();
    // ⚠ AND IT MUST NOT IMPLY THE REP DOES NOT REALLY HAVE THE CLIENT. A provisional
    // client is fully in that rep's book; only the confidence differs.
    expect(screen.queryByText(/unassigned|not assigned/i)).toBeNull();
  });

  it('⚠ THE EMPTY STATE reads as normal, not as an error', () => {
    const { container } = render(<AssignedRepCard assignment={null} jobberClientId="c1" token="t" />);
    expect(container.querySelector('[data-assignment-empty]')).toBeTruthy();
    expect(screen.getByText(/Not assigned to a rep/)).toBeTruthy();
    expect(screen.getByText(/assigned automatically when a request, quote or job/)).toBeTruthy();
    // The paired structural check: no danger colour anywhere in the empty state.
    const empty = container.querySelector('[data-assignment-empty]');
    expect(empty.getAttribute('style')).not.toMatch(/B91C1C|DC2626/);
    expect(screen.getByText('Assign a rep')).toBeTruthy();
  });

  it('offers only ATTRIBUTABLE, ACTIVE members as targets', async () => {
    render(<AssignedRepCard assignment={LOCKED} jobberClientId="c1" token="t" />);
    fireEvent.click(screen.getByText('Change rep'));
    await waitFor(() => expect(screen.getByText('Rep Two')).toBeTruthy());
    expect(screen.queryByText('Office Person')).toBeNull();
  });

  it('⚠ reassigning PATCHes the client-keyed route with the rep id, and reports the new assignment', async () => {
    const onChanged = vi.fn();
    installFetch({ patchBody: { assignment: { ...LOCKED, rep_id: 9, rep_name: 'Rep Two' } } });
    render(<AssignedRepCard assignment={LOCKED} jobberClientId="c1" token="t" onChanged={onChanged} />);
    fireEvent.click(screen.getByText('Change rep'));
    await waitFor(() => expect(screen.getByText('Rep Two')).toBeTruthy());
    fireEvent.click(screen.getByText('Rep Two'));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    const patch = fetchCalls.find((c) => c.method === 'PATCH');
    expect(patch.url).toContain('/api/admin/team/client-assignment/c1');
    expect(patch.body).toEqual({ rep_id: 9 });
    expect(onChanged.mock.calls[0][0].rep_id).toBe(9);
  });

  it('⚠ CLEARING sends rep_id null — the paired negative for the reassign case', async () => {
    const onChanged = vi.fn();
    render(<AssignedRepCard assignment={LOCKED} jobberClientId="c1" token="t" onChanged={onChanged} />);
    fireEvent.click(screen.getByText('Change rep'));
    fireEvent.click(await screen.findByText('Clear assignment'));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(null));
    const patch = fetchCalls.find((c) => c.method === 'PATCH');
    expect(patch.body).toEqual({ rep_id: null });
  });

  it('there is nothing to clear when the client is unassigned', async () => {
    render(<AssignedRepCard assignment={null} jobberClientId="c1" token="t" />);
    fireEvent.click(screen.getByText('Assign a rep'));
    await waitFor(() => expect(screen.getByText('Rep One')).toBeTruthy());
    expect(screen.queryByText('Clear assignment')).toBeNull();
  });

  it('⚠ a REFUSED change shows the server\'s reason and fires no onChanged', async () => {
    const onChanged = vi.fn();
    installFetch({ patchStatus: 403, patchBody: { error: 'Forbidden' } });
    render(<AssignedRepCard assignment={LOCKED} jobberClientId="c1" token="t" onChanged={onChanged} />);
    fireEvent.click(screen.getByText('Change rep'));
    await waitFor(() => expect(screen.getByText('Rep Two')).toBeTruthy());
    fireEvent.click(screen.getByText('Rep Two'));

    await waitFor(() => expect(screen.getByText('Forbidden')).toBeTruthy());
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('⚠ a DEACTIVATED holder is labelled — a departed rep keeps their history', () => {
    render(<AssignedRepCard assignment={{ ...LOCKED, rep_active: false }} jobberClientId="c1" token="t" />);
    expect(screen.getByText('No longer active')).toBeTruthy();
    expect(screen.getByText('Rep One')).toBeTruthy();
  });

  it('canAssign=false renders the facts and no controls', () => {
    const { container } = render(<AssignedRepCard assignment={LOCKED} jobberClientId="c1" token="t" canAssign={false} />);
    expect(screen.getByText('Rep One')).toBeTruthy();
    expect(container.querySelector('[data-assign-open]')).toBeNull();
  });
});
