// ─────────────────────────────────────────────────────────────────────────────
// BADGE CELEBRATION — SUCCESSION AND DISMISSAL (Danny's ruling, 2026-09-29)
//
//   · multiple unseen badges each get their OWN celebration, shown back to back;
//   · each is dismissed by tapping "Awesome!" OR by tapping anywhere OUTSIDE the card;
//   · the next appears only after the previous is dismissed;
//   · never on app entry.
//
// ⚠ SUCCESSION WAS ALREADY BUILT AND IS CONFIRMED HERE RATHER THAN ADDED:
// `BadgeCelebrationPopup.jsx` has carried a `currentIndex` cursor since Phase 3. What this
// commit changed is the DISMISSAL — the button read "Next"/"Done" and the scrim had no handler
// at all — and that each badge is now acknowledged AS IT IS DISMISSED rather than all of them
// when the last card closes.
//
// ⚠ "NEVER ON APP ENTRY" IS STRUCTURAL, NOT A FLAG, WHICH IS WHY IT IS FENCED BY SOURCE BELOW.
// The popup is mounted inside `ProfileTab` and nowhere else; the entry popups
// (`AnnouncementPopup`, `ExperiencePopup`) mount in `ReferrerApp`. A badge cannot collide with
// them because it is not in that tree.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import BadgeCelebrationPopup from './BadgeCelebrationPopup';

const THREE = [
  { id: 'first_referral', name: 'First Referral', emoji: '⭐', description: 'You made your first referral.', tier: 'standard' },
  { id: 'milestone_5', name: 'On a Roll', emoji: '🔥', description: '5 referrals and counting.', tier: 'standard' },
  { id: 'milestone_10', name: 'Double Digits', emoji: '🔥', description: '10 referrals.', tier: 'standard' },
];

const card = () => document.querySelector('[data-badge-dismiss]');
const scrim = () => document.querySelector('[data-badge-scrim]');

describe('badge celebration — one at a time, dismissed two ways', () => {
  it('⚠ shows ONE badge at a time, not all of them together', () => {
    render(<BadgeCelebrationPopup badges={THREE} onBadgeSeen={() => {}} onDismiss={() => {}} />);
    expect(screen.getByText('First Referral')).toBeTruthy();
    // ⚠ THE OTHER TWO MUST BE ABSENT, WHICH IS THE WHOLE RULING. A component that rendered all
    // three stacked would satisfy "the first one is present" and break the experience.
    expect(screen.queryByText('On a Roll')).toBeNull();
    expect(screen.queryByText('Double Digits')).toBeNull();
    expect(screen.getByText('1 of 3')).toBeTruthy();
  });

  it('⚠ the next appears only AFTER the previous is dismissed, in order', () => {
    render(<BadgeCelebrationPopup badges={THREE} onBadgeSeen={() => {}} onDismiss={() => {}} />);
    fireEvent.click(card());
    expect(screen.getByText('On a Roll')).toBeTruthy();
    expect(screen.queryByText('First Referral')).toBeNull();
    expect(screen.getByText('2 of 3')).toBeTruthy();
    fireEvent.click(card());
    expect(screen.getByText('Double Digits')).toBeTruthy();
    expect(screen.getByText('3 of 3')).toBeTruthy();
  });

  it('⚠ the button reads "Awesome!" on EVERY card, including the last', () => {
    // ⚠ IT READ "Next" THEN "Done", which made the final card a different interaction for no
    // reason a referrer can see. One label, one gesture.
    render(<BadgeCelebrationPopup badges={THREE} onBadgeSeen={() => {}} onDismiss={() => {}} />);
    expect(card().textContent.trim()).toBe('Awesome!');
    fireEvent.click(card());
    expect(card().textContent.trim()).toBe('Awesome!');
    fireEvent.click(card());
    expect(card().textContent.trim()).toBe('Awesome!');
  });

  it('⚠ tapping OUTSIDE the card dismisses it too', () => {
    render(<BadgeCelebrationPopup badges={THREE} onBadgeSeen={() => {}} onDismiss={() => {}} />);
    fireEvent.click(scrim());
    expect(screen.getByText('On a Roll')).toBeTruthy();
  });

  it('⚠ a click INSIDE the card does NOT dismiss it', () => {
    // ⚠ THE PAIRED NEGATIVE FOR THE OUTSIDE TAP, and it is the case the naive implementation
    // fails: without a target check every click inside the card bubbles to the scrim, so
    // reading the description would skip the badge and the "Awesome!" button would fire twice.
    render(<BadgeCelebrationPopup badges={THREE} onBadgeSeen={() => {}} onDismiss={() => {}} />);
    fireEvent.click(screen.getByText('You made your first referral.'));
    expect(screen.getByText('First Referral')).toBeTruthy();
    expect(screen.getByText('1 of 3')).toBeTruthy();
  });

  it('⚠ acknowledges EACH badge as it is dismissed, not all at the end', () => {
    // ⚠ WITHOUT THIS, A REFERRER WHO DISMISSES ONE OF THREE AND CLOSES THE TAB SEES IT AGAIN.
    // The old handler collected every id and POSTed them when the LAST card closed.
    const seen = [];
    render(<BadgeCelebrationPopup badges={THREE} onBadgeSeen={(id) => seen.push(id)} onDismiss={() => {}} />);
    fireEvent.click(card());
    expect(seen).toEqual(['first_referral']);
    fireEvent.click(scrim());
    expect(seen).toEqual(['first_referral', 'milestone_5']);
  });

  it('calls onDismiss only after the LAST badge, and acknowledges it too', () => {
    const seen = [];
    const onDismiss = vi.fn();
    render(<BadgeCelebrationPopup badges={THREE} onBadgeSeen={(id) => seen.push(id)} onDismiss={onDismiss} />);
    fireEvent.click(card());
    fireEvent.click(card());
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.click(card());
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(['first_referral', 'milestone_5', 'milestone_10']);
  });

  it('a SINGLE badge shows no counter and still dismisses', () => {
    const onDismiss = vi.fn();
    render(<BadgeCelebrationPopup badges={[THREE[0]]} onBadgeSeen={() => {}} onDismiss={onDismiss} />);
    expect(screen.queryByText(/1 of 1/)).toBeNull();
    fireEvent.click(card());
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  // ── NEVER ON APP ENTRY ─────────────────────────────────────────────────────

  it('⚠ FENCE: the celebration is mounted ONLY inside ProfileTab', () => {
    // ⚠ THIS IS WHAT MAKES "never on app entry" PROVABLE RATHER THAN ASSERTED. The entry popups
    // live in `ReferrerApp`; if the badge popup were ever mounted there too it would fire on
    // boot and collide with them, which is exactly the experience Danny built the page-local
    // behaviour to avoid.
    const NAME = 'Badge' + 'CelebrationPopup';
    const root = path.join(process.cwd(), 'src');
    const mounts = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!/\.jsx?$/.test(entry.name) || /\.test\./.test(entry.name)) continue;
        if (entry.name === NAME + '.jsx') continue;              // its own definition
        const src = fs.readFileSync(full, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
        if (new RegExp('<' + NAME + '\\b').test(src)) {
          mounts.push(path.relative(process.cwd(), full));
        }
      }
    })(root);
    expect(mounts.length).toBeGreaterThan(0);   // harness floor: it must be mounted somewhere
    for (const m of mounts) {
      expect(m.replace(/\\/g, '/')).toBe('src/components/referrer/ProfileTab.jsx');
    }
  });

  it('HARNESS FLOOR: the entry popups really do mount in ReferrerApp', () => {
    // ⚠ WITHOUT THIS, THE FENCE ABOVE PROVES ONLY THAT ONE COMPONENT IS IN ONE FILE. What makes
    // it meaningful is that the app-entry tree is a DIFFERENT file, and that it genuinely holds
    // the popups the badge must never collide with.
    const app = fs.readFileSync(
      path.join(process.cwd(), 'src', 'components', 'referrer', 'ReferrerApp.jsx'), 'utf8'
    );
    expect(app).toMatch(/<AnnouncementPopup\b/);
    expect(app).toMatch(/<ExperiencePopup\b/);
    expect(app).not.toMatch(/<BadgeCelebrationPopup\b/);
  });
});
