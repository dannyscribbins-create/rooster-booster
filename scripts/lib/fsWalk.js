'use strict';

// ─── fsWalk.js — the one filesystem walk both generators share ────────────────
//
// WHY THIS EXISTS. scripts/sizing.js and scripts/architecture.js both need to
// know what is in server/ and src/. Two copies of SKIP_DIRS is two answers to
// "what does this repo contain", and both would keep reporting confidently
// after they drifted apart. That is CLAUDE.md's false-health defect with two
// mechanisms instead of one, so the walk is extracted rather than duplicated.
//
// ⚠ THIS MODULE IS READ-ONLY AND MUST STAY THAT WAY. sizing.js's header states
// "IT PRINTS" as a load-bearing property — a shared read-only helper does not
// make a printer into a writer. Never add a write, a mutation, or a process
// exit to this file.
//
// Zero dependencies; Node core only.

const fs = require('fs');
const path = require('path');

// Directories never worth walking. node_modules and dist dominate the tree and
// contain nothing either caller counts. Extracted verbatim from sizing.js —
// changing this set changes what BOTH scripts believe the repo contains.
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.worktrees']);

// ─── walk(): every file under dir matching exts, recursively ─────────────────
// Input: absolute dir, array of extensions ('.js', '.jsx'), absolute repo root.
// Output: array of repo-relative POSIX paths. Returns [] if dir is absent.
// Behaviour is identical to the copy that lived in sizing.js; the only change
// is that `root` is a parameter instead of a module-level constant.
function walk(dir, exts, root) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      out.push(...walk(path.join(dir, entry.name), exts, root));
    } else if (exts.includes(path.extname(entry.name))) {
      out.push(path.relative(root, path.join(dir, entry.name)).split(path.sep).join('/'));
    }
  }
  return out;
}

// ─── walkTree(): every file AND directory under dir, unfiltered ──────────────
// Input: absolute dir, absolute repo root.
// Output: { files: [...], dirs: [...] } of repo-relative POSIX paths, sorted.
// architecture.js needs directories, which walk() discards; extension filtering
// happens in the caller because the two callers disagree about what counts.
// The dir itself is NOT included — the caller adds its own roots.
function walkTree(dir, root) {
  const files = [];
  const dirs = [];
  if (!fs.existsSync(dir)) return { files, dirs };
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const rel = path.relative(root, abs).split(path.sep).join('/');
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      dirs.push(rel);
      const inner = walkTree(abs, root);
      files.push(...inner.files);
      dirs.push(...inner.dirs);
    } else {
      files.push(rel);
    }
  }
  return { files: files.sort(), dirs: dirs.sort() };
}

module.exports = { SKIP_DIRS, walk, walkTree };
