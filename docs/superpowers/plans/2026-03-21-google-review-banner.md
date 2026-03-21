# Google Review Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a white-label Google Review banner card to the bottom of the referrer Dashboard screen.

**Architecture:** Two additions to `src/App.js` — a `CONTRACTOR_CONFIG` const and inline JSX banner in `Dashboard`'s return. No backend changes, no new files.

**Tech Stack:** React (inline styles), Phosphor Icons v2.1.1

**Spec:** `docs/superpowers/specs/2026-03-21-google-review-banner-design.md`

---

### Task 1: Add CONTRACTOR_CONFIG and Google Review banner to Dashboard

**Files:**
- Modify: `src/App.js` — two locations:
  1. After `STATUS_CONFIG` (line ~78), add `CONTRACTOR_CONFIG`
  2. Inside `Dashboard`'s return, after Recent Referrals closing `</div>` (line ~794), add banner JSX

---

- [ ] **Step 1: Add `CONTRACTOR_CONFIG` after `STATUS_CONFIG`**

Locate the line in `src/App.js` that reads:
```js
const STATUS_CONFIG = {
```

Find where `STATUS_CONFIG` ends (its closing `};`). Immediately after that closing `};`, insert a blank line then:

```js
// ─── Contractor Config (white-label) ──────────────────────────────────────────
const CONTRACTOR_CONFIG = {
  reviewUrl:        'https://g.page/r/CbtYNjHgUCwhEBM/review',
  reviewButtonText: 'Leave a Review',
  reviewMessage:    'Enjoying the rewards? Leave us a quick Google review!',
};
```

- [ ] **Step 2: Add the banner JSX inside `Dashboard`'s return**

Locate this block near the end of `Dashboard`'s return (the Recent Referrals closing tags followed by the spin keyframe style):

```jsx
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </Screen>
```

Insert the banner block immediately **before** that `<style>` tag:

```jsx
      {/* Google Review Banner */}
      <div style={{ padding: "16px 20px 0" }}>
        <AnimCard delay={600}>
          <div style={{
            background: R.bgCard,
            border: `1px solid ${R.border}`,
            borderRadius: 16,
            padding: "18px 20px",
            boxShadow: R.shadow,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}>
            <i className="ph ph-star-fill" style={{
              fontSize: 28,
              color: "#f59e0b",
              flexShrink: 0,
            }} />
            <div style={{ flex: 1 }}>
              <p style={{
                margin: "0 0 10px",
                fontSize: 13,
                color: R.textPrimary,
                fontFamily: R.fontBody,
                lineHeight: 1.4,
              }}>
                {CONTRACTOR_CONFIG.reviewMessage}
              </p>
              <button
                onClick={() => window.open(CONTRACTOR_CONFIG.reviewUrl, '_blank', 'noopener,noreferrer')}
                style={{
                  background: `linear-gradient(135deg, ${R.red} 0%, ${R.redDark} 100%)`,
                  border: "none",
                  borderRadius: 10,
                  padding: "10px 18px",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: R.fontSans,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 4px 14px rgba(204,0,0,0.3)",
                  transition: "all 0.2s",
                }}
                onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
                onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
              >
                <i className="ph ph-star" style={{ fontSize: 14 }} />
                {CONTRACTOR_CONFIG.reviewButtonText}
              </button>
            </div>
          </div>
        </AnimCard>
      </div>

```

- [ ] **Step 3: Verify the build compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: `Compiled successfully` (or only the pre-existing CRA boilerplate test warning — no new errors).

- [ ] **Step 4: Self-review checklist**

- `CONTRACTOR_CONFIG` is defined after `STATUS_CONFIG`, before any component code
- Banner JSX is inside `Dashboard`'s return, before `<style>` and `</Screen>`
- No other lines in `App.js` were changed
- `CONTRACTOR_CONFIG` is not referenced anywhere except the banner JSX

- [ ] **Step 5: Commit**

```bash
git add src/App.js
git commit -m "feat: add white-label Google Review banner to Dashboard"
```
