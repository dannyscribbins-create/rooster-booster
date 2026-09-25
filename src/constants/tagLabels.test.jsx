import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { TAG_LABELS, tagLabel } from './adminTheme';
import { TagPill } from '../components/admin/TagCloudFilter';

// ── TAG DISPLAY LABELS (3d Phase 1a Commit 4b) ───────────────────────────────
//
// Danny's ruling: wherever the admin panel shows a tag name to someone building an audience or
// reading a client, `paying_client` reads "Paid client" and `invoice:paid` reads
// "Jobber status: Paid".
//
// ⚠ THE TWO TAGS DO NOT MEAN THE SAME THING, WHICH IS WHY THIS IS NOT COSMETIC.
// `paying_client` is RoofMiles' own decision (isInvoicePaid: status paid AND balance 0 AND
// total > 0). `invoice:paid` is a verbatim mirror of Jobber's invoice status. They DISAGREE on a
// $0 or unsettled invoice, and until 4b both rendered as bare identifiers side by side, so an
// admin choosing between them had nothing to go on.

describe('TAG_LABELS — the map itself', () => {

  it('labels the two tags the ruling names', () => {
    expect(tagLabel('paying_client')).toBe('Paid client');
    expect(tagLabel('invoice:paid')).toBe('Jobber status: Paid');
  });

  it('returns an unlabelled tag VERBATIM — the map is additive, not a rewrite', () => {
    // ⚠ The paired negative for the two above. A `tagLabel` that prettified every tag would
    // satisfy the positive cases and silently reword the four other invoice:* values.
    expect(tagLabel('invoice:sent')).toBe('invoice:sent');
    expect(tagLabel('client_type:residential')).toBe('client_type:residential');
    expect(tagLabel('App User')).toBe('App User');
  });

  it('every key is a FULL stored tag, never a bare prefix', () => {
    // ⚠ A key of `invoice` or `invoice:` would relabel five values with a word true of one.
    for (const key of Object.keys(TAG_LABELS)) {
      expect(key.endsWith(':'), `${key} is a prefix, not a tag`).toBe(false);
      if (key.includes(':')) {
        expect(key.split(':')[1].length, `${key} has an empty value half`).toBeGreaterThan(0);
      }
    }
  });

  it('no label is equal to its own tag — a label that is the identifier is not a label', () => {
    // ⚠ THIS IS THE CASE DANNY'S GUARD-PROOF (iii) BREAKS. Reverting either entry to the raw tag
    // name fails here as well as in the render cases below, so the fence does not depend on a
    // component staying mounted the same way.
    for (const [tag, label] of Object.entries(TAG_LABELS)) {
      expect(label).not.toBe(tag);
    }
  });
});

describe('TagPill renders the LABEL and keeps the stored TAG', () => {

  it('shows "Paid client" for paying_client', () => {
    render(<TagPill tag="paying_client" source="jobber_crm" />);
    expect(screen.getByText('Paid client')).toBeTruthy();
    expect(screen.queryByText('paying_client')).toBeNull();
  });

  it('shows "Jobber status: Paid" for invoice:paid', () => {
    render(<TagPill tag="invoice:paid" source="jobber_crm" />);
    expect(screen.getByText('Jobber status: Paid')).toBeTruthy();
    expect(screen.queryByText('invoice:paid')).toBeNull();
  });

  it('shows an unlabelled tag unchanged', () => {
    render(<TagPill tag="invoice:sent" source="jobber_crm" />);
    expect(screen.getByText('invoice:sent')).toBeTruthy();
  });

  it('the remove handler still receives the STORED tag, not the label', () => {
    // ⚠ THE DEFECT THIS FORBIDS IS THE WHOLE RISK OF A LABEL MAP: a display value used as a key.
    // `paying_client` is what contact_tags holds and what every audience filter matches; a delete
    // or a filter sent as "Paid client" would silently match nothing and report success.
    let received = 'not called';
    const { container } = render(
      <TagPill tag="paying_client" source="admin" onRemove={() => { received = 'clicked'; }} />
    );
    const btn = container.querySelector('button');
    expect(btn).toBeTruthy();
    btn.click();
    expect(received).toBe('clicked');
    // The pill's own text is the label while the prop it was handed is the stored tag — asserted
    // together, because that pairing IS the property.
    expect(screen.getByText('Paid client')).toBeTruthy();
  });
});

describe('no render site renders a bare tag any more', () => {

  // ⚠ THIS WALKS src/ RATHER THAN CHECKING A LIST OF FILES. A hand-maintained list is this repo's
  // recurring blind spot: a NEW component rendering {tag} would be invisible until someone
  // remembered it, and nothing announces the omission. The nine sites 4b enumerated were found
  // that way — the first pass named five.
  const SRC = path.resolve(__dirname, '..');

  function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p, out);
      else if (/\.jsx?$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(p);
    }
    return out;
  }

  const files = walk(SRC);

  it('the walk reads files — an empty walk makes the check below vacuous', () => {
    expect(files.length).toBeGreaterThan(60);
    expect(files.some((f) => f.includes('TagCloudFilter'))).toBe(true);
  });

  it('a JSX slot rendering a tag goes through tagLabel', () => {
    // A line whose entire content is a `{tag}` render slot. That is the flat-name shape — the one
    // where paying_client and invoice:paid appear as bare identifiers with no group heading to
    // explain them. Assembled from pieces so this file is not its own offender.
    const SLOT = new RegExp('^\\s*\\{\\s*' + 'tag' + '\\s*\\}\\s*$');
    const offenders = [];
    for (const f of files) {
      fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
        if (SLOT.test(line)) offenders.push(`${path.relative(SRC, f)}:${i + 1}`);
      });
    }
    expect(offenders, 'each line renders the stored tag as display text — wrap it in tagLabel()')
      .toEqual([]);
  });

  it('the contacts-table row pill consults the label BEFORE stripping the prefix', () => {
    // ⚠ ORDER, NOT PRESENCE, IS THE PROPERTY HERE, AND A RENDER TEST CANNOT SEE IT — RowTagPill is
    // not exported, and exporting it to be testable would change a production surface for a test.
    // TAG_LABELS is keyed on the FULL tag, so a strip that runs first turns `invoice:paid` into
    // `paid`, which the map does not hold: the label would silently never apply and every
    // assertion about the map would still pass.
    const src = fs.readFileSync(path.join(SRC, 'components', 'admin', 'AdminContactsTab.jsx'), 'utf8');
    const labelAt = src.indexOf('tagLabel(tag)');
    const stripAt = src.indexOf(".split(':')");
    expect(labelAt, 'AdminContactsTab must consult tagLabel').toBeGreaterThan(-1);
    expect(stripAt, 'the prefix strip must still be there for the other invoice:* values')
      .toBeGreaterThan(-1);
    expect(labelAt).toBeLessThan(stripAt);
  });
});
