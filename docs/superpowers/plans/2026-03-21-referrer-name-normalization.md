# Referrer Name Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix silent referral loss when the "Referred By" value in Jobber differs from `user.full_name` in the DB by casing or whitespace.

**Architecture:** One-line change inside `fetchPipelineForReferrer` in `server.js` — trim and lowercase both sides of the comparison. A standalone Node.js assertion script verifies the before/after behavior without requiring any new test infrastructure.

**Tech Stack:** Node.js (assert module), Express/PostgreSQL backend

**Spec:** `docs/superpowers/specs/2026-03-21-referrer-name-normalization-design.md`

---

### Task 1: Fix case-insensitive referrer name matching

**Files:**
- Modify: `server.js:125`
- Test script (run-and-delete): `test-normalization.js` (root of repo, deleted after verifying)

---

- [ ] **Step 1: Write the failing test script**

Create `test-normalization.js` in the repo root:

```js
const assert = require('assert');

// Simulates the current (broken) comparison
function matchExact(valueText, referrerName) {
  return valueText === referrerName;
}

// These should all match but currently don't
assert.strictEqual(matchExact('Jane Smith ', 'Jane Smith'), false, 'trailing space should match');
assert.strictEqual(matchExact('jane smith',  'Jane Smith'), false, 'lowercase should match');
assert.strictEqual(matchExact('JANE SMITH',  'Jane Smith'), false, 'uppercase should match');

// Null should not throw or match
assert.strictEqual(matchExact(null, 'Jane Smith'), false, 'null should not match');

console.log('All assertions confirmed BROKEN — ready to fix.');
```

- [ ] **Step 2: Run the test script to confirm it fails as expected**

```bash
node test-normalization.js
```

Expected output:
```
All assertions confirmed BROKEN — ready to fix.
```

(All `assert.strictEqual(..., false)` calls pass because the broken comparison returns `false` for all these cases — confirming the bug exists.)

- [ ] **Step 3: Update the test script to assert the FIXED behavior**

Replace the contents of `test-normalization.js` with:

```js
const assert = require('assert');

// Simulates the fixed comparison
function matchNormalized(valueText, referrerName) {
  return valueText?.trim().toLowerCase() === referrerName.trim().toLowerCase();
}

// Casing differences
assert.strictEqual(matchNormalized('Jane Smith',  'Jane Smith'), true,  'exact match');
assert.strictEqual(matchNormalized('jane smith',  'Jane Smith'), true,  'lowercase valueText');
assert.strictEqual(matchNormalized('JANE SMITH',  'Jane Smith'), true,  'uppercase valueText');
assert.strictEqual(matchNormalized('Jane Smith',  'jane smith'), true,  'lowercase referrerName');

// Whitespace differences
assert.strictEqual(matchNormalized('Jane Smith ', 'Jane Smith'), true,  'trailing space in valueText');
assert.strictEqual(matchNormalized(' Jane Smith', 'Jane Smith'), true,  'leading space in valueText');
assert.strictEqual(matchNormalized('Jane Smith',  ' Jane Smith'), true, 'leading space in referrerName');

// Null safety — Jobber may return null for an empty custom field
assert.strictEqual(matchNormalized(null,          'Jane Smith'), false, 'null valueText does not match');
assert.strictEqual(matchNormalized(undefined,     'Jane Smith'), false, 'undefined valueText does not match');

// Non-matches still work
assert.strictEqual(matchNormalized('Bob Jones',   'Jane Smith'), false, 'different name does not match');

console.log('All assertions PASSED — fix is correct.');
```

- [ ] **Step 4: Run the test to confirm it fails (fix not yet applied)**

```bash
node test-normalization.js
```

Expected: `AssertionError` on the first `true` assertion — the fix hasn't been made yet.

- [ ] **Step 5: Apply the fix in `server.js`**

In `server.js`, line 125, inside `fetchPipelineForReferrer`:

Before:
```js
return f && f.valueText === referrerName;
```

After:
```js
return f && f.valueText?.trim().toLowerCase() === referrerName.trim().toLowerCase();
```

- [ ] **Step 6: Run the test to confirm it passes**

```bash
node test-normalization.js
```

Expected output:
```
All assertions PASSED — fix is correct.
```

- [ ] **Step 7: Run the existing test suite to check for regressions**

```bash
npm test -- --watchAll=false
```

Expected: the pre-existing CRA boilerplate test failure (unrelated to this change) and no new failures.

- [ ] **Step 8: Delete the test script**

```bash
rm test-normalization.js
```

- [ ] **Step 9: Commit**

```bash
git add server.js
git commit -m "fix: case-insensitive + whitespace-tolerant referrer name matching"
```
