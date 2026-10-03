// ─────────────────────────────────────────────────────────────────────────────
// N4 COMMIT 9 — THE BACKWARDS-MOVE NOTE, AS A REFERRER ACTUALLY SEES IT
//
// Danny's ruling, and the copy is EXACT: "This job is no longer active."
//
// ⚠ THE MOUNT TEST DANNY NAMED: the note renders ONLY in the backwards case. Each absence
// assertion below is PAIRED with a positive on the same mount, because "the note is not there" is
// equally true of a screen that failed to render at all — this repo's recorded rule that an absence
// assertion must first prove the presence it is asserting the absence of.
//
// ⚠ jsdom RESOLVES NO `var()` AND PERFORMS NO LAYOUT, so nothing here asserts a resolved colour or
// a position. What it CAN see truthfully: the text, the element's presence, and the inline style
// string as written. The "not an alert" property is therefore asserted as the DECLARATION naming
// the text token and naming no status colour — which is the honest limit of this runner.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import StageRegressionNote, { STAGE_REGRESSION_NOTE } from '../shared/StageRegressionNote';

const SRC_ROOT = path.join(process.cwd(), 'src');
const read = (rel) => fs.readFileSync(path.join(SRC_ROOT, rel), 'utf8');

const EXACT_COPY = 'This job is no longer active.';

describe('N4 commit 9 — the note renders only in the backwards case', () => {
  it('THE COPY IS EXACTLY DANNY’S STRING, character for character', () => {
    // ⚠ ASSERTED AGAINST A LITERAL WRITTEN HERE, not against the imported constant alone — a test
    // that compares the export to itself cannot notice the sentence changing. The export is checked
    // against this literal, and the rendered text against the export.
    expect(STAGE_REGRESSION_NOTE).toBe(EXACT_COPY);
  });

  it('renders the note when regressed', () => {
    render(<StageRegressionNote regressed />);
    expect(screen.getByText(EXACT_COPY)).toBeTruthy();
  });

  it('renders NOTHING when not regressed — with the positive on the same component', () => {
    const { container, unmount } = render(<StageRegressionNote regressed={false} />);
    expect(container.textContent).toBe('');
    expect(container.querySelector('[data-stage-regression-note]')).toBeNull();
    unmount();
    // THE PAIRED POSITIVE: the same component DOES render, so the absence above is about the flag
    // and not about a component that cannot render at all.
    const { container: on } = render(<StageRegressionNote regressed />);
    expect(on.querySelector('[data-stage-regression-note]')).toBeTruthy();
  });

  it('renders nothing for undefined — a payload without the key shows no note', () => {
    // A stale client against a server that does not send `stage_regressed` must stay silent rather
    // than throwing or guessing.
    const { container } = render(<StageRegressionNote />);
    expect(container.textContent).toBe('');
  });

  it('IS NOT AN ALERT: normal text colour, small, and no status tone', () => {
    const { container } = render(<StageRegressionNote regressed />);
    const el = container.querySelector('[data-stage-regression-note]');
    expect(el).toBeTruthy();
    // jsdom keeps the declaration verbatim, which is exactly what is being asserted here.
    expect(el.style.color).toContain('--rm-text');
    expect(el.style.fontSize).toBe('12px');
    // ⚠ NO BACKGROUND, NO BORDER — those would make it a pill, which the ruling forbids.
    expect(el.style.background).toBe('');
    expect(el.style.border).toBe('');
  });

  it('the component’s SOURCE names no status or danger tone', () => {
    // The colour cannot be resolved here, so the fence reads the declaration: a warning or danger
    // treatment would tell a referrer something had gone WRONG, and a backwards move has not.
    const src = read('components/shared/StageRegressionNote.jsx');
    const code = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/statusVar\s*\(/);
    expect(code).not.toMatch(/--rm-danger|--rm-warning/);
    expect(code).toMatch(/--rm-text/);
  });
});

describe('N4 commit 9 — both referrer card sites use the one component', () => {
  // ⚠ TWO RENDER SITES, AND THE COPY MUST LIVE IN NEITHER. `DashboardTab` draws the top-three
  // preview and `ProfileTab` the full list; a sentence duplicated into both is this repo's
  // "a fact written into N files costs N corrections, and you will find N-1".
  const SITES = ['components/referrer/DashboardTab.jsx', 'components/referrer/ProfileTab.jsx'];

  it('each card site RENDERS the shared component', () => {
    for (const f of SITES) {
      const src = read(f);
      expect(src, `${f} must import the shared note`).toMatch(/StageRegressionNote/);
      expect(src, `${f} must pass the server's boolean`).toMatch(
        /<StageRegressionNote\s+regressed=\{[^}]*stage_regressed\}/
      );
    }
  });

  it('NEITHER card site spells the copy itself', () => {
    for (const f of SITES) {
      const src = read(f);
      expect(src, `${f} carries its own copy of the sentence`).not.toContain(EXACT_COPY);
    }
  });

  it('NON-VACUITY: the needle for the copy DOES match the component that owns it', () => {
    // Without this, renaming the sentence would make the absence assertions above pass trivially.
    expect(read('components/shared/StageRegressionNote.jsx')).toContain(EXACT_COPY);
  });

  it('no referrer screen computes the regression itself — the server decides', () => {
    // ⚠ CD-7's PRECEDENT: the server sends a boolean and `stage_high_water` never reaches the
    // client. A screen that ranked stages would be a second implementation of the condition, and
    // would need the mark to do it.
    for (const f of SITES) {
      const src = read(f);
      expect(src, `${f} reads the raw mark`).not.toContain('stage_high_water');
    }
  });

  it('and NO src/ file anywhere reads the mark', () => {
    // The whole tree, walked rather than listed — every hand-maintained FILES list in this repo has
    // gone stale without announcing it.
    const offenders = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!/\.(js|jsx|mjs)$/.test(entry.name)) continue;
        if (/\.test\./.test(entry.name)) continue;
        if (fs.readFileSync(full, 'utf8').includes('stage_high_water')) {
          offenders.push(path.relative(SRC_ROOT, full));
        }
      }
    };
    walk(SRC_ROOT);
    expect(offenders, 'the display mark must never reach the client').toEqual([]);
  });
});

describe('N4 commit 9 — the REP surface shows no note', () => {
  // ⚠ DANNY'S RULING: reps always see the plain truth. The rep screens live in
  // `src/components/rep/` and must not import the note or read the flag.
  it('no rep component imports the note or reads the flag', () => {
    const repDir = path.join(SRC_ROOT, 'components', 'rep');
    if (!fs.existsSync(repDir)) return;
    const offenders = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!/\.(js|jsx|mjs)$/.test(entry.name)) continue;
        if (/\.test\./.test(entry.name)) continue;
        const src = fs.readFileSync(full, 'utf8');
        if (/StageRegressionNote|stage_regressed/.test(src)) {
          offenders.push(path.relative(SRC_ROOT, full));
        }
      }
    };
    walk(repDir);
    expect(offenders, 'a rep must see the plain truth with no note').toEqual([]);
  });

  it('NON-VACUITY: the walk reaches the rep tree and it holds real components', () => {
    const repDir = path.join(SRC_ROOT, 'components', 'rep');
    expect(fs.existsSync(repDir)).toBe(true);
    const files = fs.readdirSync(repDir).filter((f) => /\.jsx$/.test(f) && !/\.test\./.test(f));
    expect(files.length, 'the rep tree must hold components, or the fence above proves nothing')
      .toBeGreaterThan(0);
  });
});
