# Referrer Name Normalization — Design Spec

**Date:** 2026-03-21
**Status:** Approved

## Overview

Fix silent referral loss caused by exact-string matching between `user.full_name` (from the `users` table) and `f.valueText` (the "Referred By" custom field pulled from Jobber's GraphQL API). Any casing difference or stray whitespace on either side causes `filter` to drop all referrals for that user.

---

## Problem

`server.js:125` — inside `fetchPipelineForReferrer`:

```js
return f && f.valueText === referrerName;
```

This is a strict equality check. `f.valueText` comes raw from Jobber; `referrerName` is `user.full_name` from the database. Examples that currently fail silently:

- Jobber stores `"Jane Smith "` (trailing space), DB has `"Jane Smith"`
- Jobber stores `"jane smith"`, DB has `"Jane Smith"`
- Jobber stores `"JANE SMITH"`, DB has `"Jane Smith"`

---

## Fix

**File:** `server.js`
**Line:** 125

Before:
```js
return f && f.valueText === referrerName;
```

After:
```js
return f && f.valueText.trim().toLowerCase() === referrerName.trim().toLowerCase();
```

Trim and lowercase both sides at comparison time. No other changes.

---

## Scope

- One line changed in one file.
- No schema changes, no data migration, no call-site changes.
- `full_name` values in the DB and in Jobber remain unchanged — normalization happens only during comparison.
- The label lookup on line 124 already uses `.toLowerCase()` for `'referred by'`; this change makes `valueText` consistent with that existing pattern.

---

## Out of Scope

- Normalizing `full_name` at rest in the database.
- Fuzzy matching or phonetic matching.
- Backfilling or auditing existing Jobber data.
