// ─────────────────────────────────────────────────────────────────────────────
// ADMIN PANEL BRAND RETIREMENT — PHASE 1, DECISION D-E
//
// `AdminAboutUs.jsx` and `AdminAnnouncementSettings.jsx` are deleted, not merely
// unwired. Both had ZERO importers: the only textual references to either name
// anywhere in `src/` were their own `export default function` declarations.
//
// ⚠ WHY THIS GUARD IS WORTH ITS LINES. The files were not harmless clutter — they
// were ACTIVELY MISLEADING two separate records:
//
//   1. `HARDCODED_ACCENT_INVENTORY.md` Group B names `AdminAnnouncementSettings.jsx`
//      as the admin preview carrying Accent identity, and does NOT name
//      `AdminSettingsNotifications.jsx` — the LIVE twin holding the same logo
//      import, the same alt text and the same `preset_2` string. A sweep that
//      closed Group B would have "finished" while every live literal survived.
//
//   2. `PRE_LAUNCH_CHECKLIST.md:213` describes a `google_place_id` divergence
//      between `AdminAboutUs.jsx:98` and `CompanyDetailsSettings.jsx:280`. One
//      half was dead. There was no live divergence to close.
//
// A dead file that a work-list points at is worse than no entry at all, because
// closing it reads as progress. That is what this guard exists to keep closed.
//
// ── NON-VACUITY (CLAUDE.md → Test Design) ───────────────────────────────────
// "No importer found" is exactly the assertion that passes when the walk is
// broken — a typo'd root, a wrong extension filter, or a directory that no longer
// exists all produce zero hits and a green test. So the walk carries TWO positive
// controls: it must visit a plausible number of files, and it must still FIND a
// component that genuinely is imported. Without those, this file would prove
// nothing at all while looking thorough.
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';

const DELETED = [
  'src/components/admin/AdminAboutUs.jsx',
  'src/components/admin/AdminAnnouncementSettings.jsx',
];

const DELETED_NAMES = ['AdminAboutUs', 'AdminAnnouncementSettings'];

// A component that IS imported, used as the walk's positive control. If the walk
// stops finding this one, the walk is broken and every negative below is void.
const CONTROL_NAME = 'AdminDashboard';

// Walks src/ collecting every .js/.jsx source file. Mirrors the walker at
// contractorBranding.test.jsx:369-390 — same recursion, same extension filter.
// Test files are NOT excluded here, deliberately and unlike that walker: a test
// file importing a deleted component is just as broken as production code doing
// it, and this file names the components in prose only (in comments and in the
// DELETED_NAMES array), which the matcher below cannot mistake for an import.
function walkSrc() {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!/\.(js|jsx)$/.test(entry.name)) continue;
      files.push(full);
    }
  };
  walk(path.resolve(process.cwd(), 'src'));
  return files;
}

// Every way one module can name another: a static import, a dynamic import(), or
// a require(). A `lazy()` map or a router table would surface as one of the
// first two, since all three carry the path as a quoted specifier.
function importersOf(files, name) {
  const patterns = [
    new RegExp(`import[^;\\r\\n]*?from\\s*['"][^'"]*${name}['"]`),
    new RegExp(`import\\(\\s*['"][^'"]*${name}['"]\\s*\\)`),
    new RegExp(`require\\(\\s*['"][^'"]*${name}['"]\\s*\\)`),
  ];
  return files.filter((f) => {
    const source = fs.readFileSync(f, 'utf8');
    return patterns.some((re) => re.test(source));
  });
}

describe('Phase 1 / D-E — the two orphaned admin files are gone', () => {

  for (const rel of DELETED) {
    it(`[RED] ${rel} does not exist on disk`, () => {
      const abs = path.resolve(process.cwd(), rel);
      expect(fs.existsSync(abs), `${rel} still exists — D-E deletes it`).toBe(false);
    });
  }

  it('the walk is real — it visits src/ and can still find a component that IS imported', () => {
    // ⚠ THE NON-VACUITY PROOF. Both assertions below must hold before any
    // "nothing imports X" result in this file means anything.
    const files = walkSrc();

    expect(files.length, 'the src/ walk collected almost no files — the walk is broken')
      .toBeGreaterThan(50);

    const controlImporters = importersOf(files, CONTROL_NAME);
    expect(controlImporters.length,
      `the walk found no importer of ${CONTROL_NAME}, which IS imported — ` +
      'the matcher is broken, so every negative result in this file is meaningless'
    ).toBeGreaterThan(0);
  });

  for (const name of DELETED_NAMES) {
    it(`[RED] nothing in src/ imports ${name} — static, dynamic or require`, () => {
      const importers = importersOf(walkSrc(), name);
      expect(importers,
        `these files still import ${name}, which no longer exists — under Vite a ` +
        'missing module is a build failure, not a silent undefined: ' +
        `${importers.join(', ')}`
      ).toEqual([]);
    });
  }
});
