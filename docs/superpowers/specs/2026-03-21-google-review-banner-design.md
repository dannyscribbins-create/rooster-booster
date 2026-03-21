# Google Review Banner — Design Spec

**Date:** 2026-03-21
**Status:** Approved

## Overview

Add a Google Review banner card to the bottom of the Dashboard screen in the referrer app. The banner is white-label-ready: all contractor-specific copy and the review URL live in a `CONTRACTOR_CONFIG` object at the top of `App.js`. Future contractors swap config values without touching component code.

---

## Config Object

Add `CONTRACTOR_CONFIG` to `src/App.js` immediately after `STATUS_CONFIG` (after line 78, before the Animation Hook comment), following the existing module-level const pattern:

```js
// ─── Contractor Config (white-label) ──────────────────────────────────────────
const CONTRACTOR_CONFIG = {
  reviewUrl:        'https://g.page/r/CbtYNjHgUCwhEBM/review',
  reviewButtonText: 'Leave a Review',
  reviewMessage:    'Enjoying the rewards? Leave us a quick Google review!',
};
```

**Fields:**
- `reviewUrl` — full URL opened in a new tab when the CTA is tapped
- `reviewButtonText` — label on the red CTA button
- `reviewMessage` — body copy displayed above the button

No other component reads from `CONTRACTOR_CONFIG` in this change. The object is defined once and read only by the banner.

---

## Placement

Inside `Dashboard`'s return, after the closing `</div>` of the Recent Referrals section wrapper (currently line 794) and before the `<style>` tag (line 796).

---

## Banner Markup

Inline JSX inside `Dashboard` — no separate function component. Follows the identical wrapper pattern used by every other Dashboard section:

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
      {/* Star icon */}
      <i className="ph ph-star-fill" style={{
        fontSize: 28,
        color: "#f59e0b",
        flexShrink: 0,
      }} />

      {/* Message + button */}
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

**Design details:**
- Wrapper: `padding: "16px 20px 0"` — identical to all sibling sections; `Screen` component's `paddingBottom: 88` already provides safe-area clearance for the bottom nav
- `AnimCard delay={600}` — enters after all three referral cards (which animate at 400ms, 460ms, 520ms)
- Star icon: Phosphor `ph-star-fill`, amber `#f59e0b`, 28px — visually distinct from the brand red/navy without conflicting
- Message text: 13px, `R.textPrimary`, `R.fontBody` (DM Sans) — readable, not competing with section headers
- Button: same gradient, shadow, hover lift, and font as "Cash Out Now"; intentionally smaller (`padding: "10px 18px"`, `fontSize: 13`) because this is a secondary CTA — not the primary action on the screen
- Button renders at inline width (no `width: "100%"`) — appropriate for a secondary action in a flex row context
- Button icon: `ph-star` (outline) at 14px — paired with filled star in the card icon for visual consistency
- `window.open` uses `noopener,noreferrer` for security

---

## Security

`window.open(..., 'noopener,noreferrer')` prevents the opened tab from accessing `window.opener`, consistent with safe external link handling.

---

## Files Changed

- `src/App.js` — two additions:
  1. `CONTRACTOR_CONFIG` const after `STATUS_CONFIG`
  2. Banner JSX block inside `Dashboard`'s return

No backend changes. No new files.

---

## Out of Scope

- Dismiss / "don't show again" behavior
- Analytics or click tracking
- Multiple review platforms
- Dark mode variant
