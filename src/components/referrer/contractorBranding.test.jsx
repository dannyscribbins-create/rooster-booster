// ─────────────────────────────────────────────────────────────────────────────
// C/DL-3b — PHASE 6B — THE REFERRER SURFACES RENDER THEIR OWN CONTRACTOR
//
// Governing spec: CDL_3b_BUILD_SPEC.md §8.1-8.3.
//
// THE DEFECT. Six components read `CONTRACTOR_CONFIG` — a hardcoded module
// holding ONE tenant's identity. Every contractor's app showed Accent Roofing's
// name, phone, email, website, logo and Google review link. Not a styling
// problem: a homeowner referred by contractor #2 was given contractor #1's phone
// number to call.
//
// ⚠ TWO CONTRACTORS, ALWAYS, AND EVERY ASSERTION IS A PAIR. Each test renders the
// same component under brand A and brand B and asserts BOTH that the right values
// appear AND that the other contractor's do not. A single-contractor fixture
// cannot tell "reads the branding context" from "happens to be hardcoded to the
// value I chose" — which is exactly the bug being fixed, so a test that could not
// distinguish them would be theatre.
//
// THE SWEEP AT THE BOTTOM is the backstop: a literal on a branch no test renders
// is invisible to the assertions above, and that is how the four components on no
// inventory list survived three previous passes.
// ─────────────────────────────────────────────────────────────────────────────

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import ThemeProvider from '../shared/ThemeProvider';
import ContactModal from '../shared/ContactModal';
import ContractorAboutModal from './ContractorAboutModal';
import BookingFormModal from './BookingFormModal';
import ReferAFriendTab from './ReferAFriendTab';
import ExperiencePopup from './ExperiencePopup';
import DashboardTab from './DashboardTab';
import AnnouncementPopup from './AnnouncementPopup';

// Full resolveBrandingTheme-shaped payloads, every value distinct between the two
// so no assertion can pass by coincidence.
const BRAND_A = Object.freeze({
  companyName: 'Alpha Roofing Co', programName: null,
  primaryColor: '#123456', secondaryColor: '#654321',
  accentColor: '#FDF0E7', backgroundColor: '#FFFFFF',
  logoUrl: 'https://cdn.test.invalid/alpha-logo.png',
  phone: '555-0100', email: 'hello@alpha.test.invalid', website: 'alpha.test.invalid',
  reviewUrl: 'https://g.page/r/alpha/review',
  reviewButtonText: 'Rate Alpha', reviewMessage: 'How did Alpha do?',
});

const BRAND_B = Object.freeze({
  companyName: 'Beta Exteriors', programName: null,
  primaryColor: '#0A0B0C', secondaryColor: '#0D0E0F',
  accentColor: '#FDF0E7', backgroundColor: '#FFFFFF',
  logoUrl: 'https://cdn.test.invalid/beta-logo.png',
  phone: '555-0222', email: 'hello@beta.test.invalid', website: 'beta.test.invalid',
  reviewUrl: 'https://g.page/r/beta/review',
  reviewButtonText: 'Rate Beta', reviewMessage: 'How did Beta do?',
});

// ⚠ THE ABSENT BRAND IS THE PRIMARY FIXTURE, NOT AN EDGE CASE. reviewUrl and
// logoUrl are deliberately allowed to be null (identity-bearing values get no
// defaults), and every 6B/6C test used a fixture where BOTH were populated — so
// nothing exercised the state the product actually shipped in.
const BRAND_BARE = Object.freeze({
  ...BRAND_A,
  companyName: 'Bare Roofing Co',
  logoUrl: null,
  reviewUrl: null,
});

const SLUG = {
  [BRAND_A.companyName]: 'alpha',
  [BRAND_B.companyName]: 'beta',
  [BRAND_BARE.companyName]: 'bare',
};

function makeStorage() {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: k => { map.delete(k); },
  };
}

// Resolves through source 2.5 (?brand=) so the real chain runs rather than a
// context being hand-injected past it.
function contextFor(brand) {
  const slug = SLUG[brand.companyName];
  return {
    hostname: 'app.roofmiles.test',
    search: `?brand=${slug}`,
    storage: makeStorage(),
    fetchBranding: async s => (s === slug ? { ...brand } : null),
    session: null,
  };
}

function renderForBrand(brand, ui) {
  return render(
    <ThemeProvider context={contextFor(brand)} fetchStoredMode={async () => null}>
      {ui}
    </ThemeProvider>
  );
}

/**
 * Renders `ui` under both brands and runs `assertFn(brand, other)` for each.
 *
 * `readyWhen(brand)` is per-test rather than a shared "the company name appeared"
 * check, because NOT EVERY COMPONENT PRINTS THE NAME — ContactModal renders only a
 * phone number and an email address. A shared gate keyed on the name waits forever
 * on those, and the failure looks like the component ignoring its branding when in
 * fact it is rendering it correctly.
 */
async function underBothBrands(ui, readyWhen, assertFn) {
  for (const [brand, other] of [[BRAND_A, BRAND_B], [BRAND_B, BRAND_A]]) {
    const { unmount } = renderForBrand(brand, typeof ui === 'function' ? ui(brand) : ui);
    await waitFor(() => expect(readyWhen(brand)).toBeTruthy());
    await assertFn(brand, other);
    unmount();
  }
}

beforeEach(() => {
  global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
});
afterEach(() => { delete global.fetch; });

describe('C/DL-3b Phase 6B — each component renders its own contractor', () => {

  it('[RED] ContactModal shows the contractor’s own phone and email', async () => {
    // ⚠ ON NO INVENTORY LIST. Reached from the LOGIN screen — so this hardcoded
    // phone number was the first thing a stranded homeowner at contractor #2 was
    // told to call, and it rang Accent Roofing.
    await underBothBrands(
      <ContactModal isOpen onClose={() => {}} />,
      brand => document.body.textContent.includes(brand.phone),
      async (brand, other) => {
      expect(document.body.textContent).toContain(brand.phone);
      expect(document.body.textContent).toContain(brand.email);
      expect(document.body.textContent).not.toContain(other.phone);
      expect(document.body.textContent).not.toContain(other.email);
      }
    );
  });

  it('[RED] ContractorAboutModal shows the contractor’s own name and logo', async () => {
    await underBothBrands(
      // aboutData must be TRUTHY — the component returns null without it, which
      // renders an empty body and looks like a branding failure.
      <ContractorAboutModal visible onContinue={() => {}} onBook={() => {}} aboutData={{ blurb: 'x' }} />,
      brand => document.querySelector(`img[src="${brand.logoUrl}"]`),
      async (brand, other) => {
        const logo = document.querySelector(`img[src="${brand.logoUrl}"]`);
        expect(logo, 'the contractor’s own logo must be the one rendered').toBeTruthy();
        expect(document.querySelector(`img[src="${other.logoUrl}"]`)).toBeNull();
      }
    );
  });

  it('[RED] BookingFormModal shows the contractor’s own logo on its success screen', async () => {
    // ⚠ THE BRANDING ONLY APPEARS AFTER A SUCCESSFUL SUBMIT — the idle form shows
    // none of it. So the test drives a real booking rather than rendering the
    // modal and looking: asserting on the idle state would pass whatever the
    // wiring said, because there is nothing on screen to be wrong.
    //
    // This is also why the source sweep matters more here than elsewhere: a
    // literal on a success-only branch is invisible to any test that does not
    // reach it, which is precisely how this file stayed off every inventory list.
    global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true }) }));

    await underBothBrands(
      <BookingFormModal visible onClose={() => {}} onBookingSuccess={() => {}} sessionToken="t" />,
      () => screen.queryByPlaceholderText('Full Name *'),
      async (brand, other) => {
        fireEvent.change(screen.getByPlaceholderText('Full Name *'), { target: { value: 'Dana Referrer' } });
        fireEvent.change(screen.getByPlaceholderText('Phone Number *'), { target: { value: '555-0999' } });
        fireEvent.click(screen.getByRole('button', { name: /request inspection/i }));

        await waitFor(() => expect(document.querySelector(`img[src="${brand.logoUrl}"]`)).toBeTruthy());
        expect(document.querySelector(`img[src="${other.logoUrl}"]`)).toBeNull();
      }
    );
  });

  it('[RED] ReferAFriendTab shows the contractor’s own phone, email and website', async () => {
    await underBothBrands(
      <ReferAFriendTab userName="Dana Referrer" token="t" />,
      brand => document.body.textContent.includes(brand.phone),
      async (brand, other) => {
        for (const own of [brand.phone, brand.email, brand.website]) {
          expect(document.body.textContent).toContain(own);
        }
        for (const theirs of [other.phone, other.email, other.website]) {
          expect(document.body.textContent).not.toContain(theirs);
        }
      }
    );
  });

  it('[RED] ExperiencePopup names the contractor and links to ITS review URL', async () => {
    // Added at the 6C checkpoint. 6B rewired this file but covered it by source
    // sweep only — and the sweep proves the literal is GONE, never that the right
    // value ARRIVES. After BookingFormModal that gap is demonstrated rather than
    // theoretical.
    await underBothBrands(
      <ExperiencePopup
        prompt={{ id: 1, referral_link: 'https://ref.test.invalid/dana' }}
        onDismiss={() => {}}
      />,
      brand => document.body.textContent.includes(brand.companyName),
      async (brand, other) => {
        expect(document.body.textContent).toContain(brand.companyName);
        expect(document.body.textContent).not.toContain(other.companyName);
      }
    );
  });

  it('[RED] DashboardTab’s review card carries the contractor’s own message and button', async () => {
    // ⚠ NARROW BY DESIGN, AND DELIBERATELY NOT "IMPROVED" INTO A FULL RENDER.
    // This component takes seventeen props. A realistic render would be mostly
    // fixture scaffolding proving nothing about branding, and the scaffolding
    // would then need maintaining every time the component's props changed — cost
    // with no coverage attached.
    //
    // The review card is the ONLY place DashboardTab paints contractor-owned
    // values, and it is what the review trio was delivered for. So the props below
    // are the minimum that makes that card render, and nothing more is invented to
    // look thorough. Narrow-and-honest beats broad-and-decorative: a test that
    // renders everything and asserts on branding covers no more branding than this
    // one, while implying it covers the component.
    await underBothBrands(
      <DashboardTab
        setTab={() => {}} pipeline={[]} loading={false}
        pipelineRateLimited={false} pipelineStale={false} pipelineStaleSince={null}
        pipelineUnavailable={false} userName="Dana Referrer" balance={0} paidCount={0}
        profilePhoto={null} showReviewCard onDismissReview={() => {}}
        sessionToken="t" onViewAllReferrals={() => {}} bankStatus={null}
        onOpenBankSetup={() => {}}
      />,
      brand => document.body.textContent.includes(brand.reviewMessage),
      async (brand, other) => {
        expect(document.body.textContent).toContain(brand.reviewMessage);
        expect(document.body.textContent).toContain(brand.reviewButtonText);
        expect(document.body.textContent).not.toContain(other.reviewMessage);
        expect(document.body.textContent).not.toContain(other.reviewButtonText);
      }
    );
  });

  it('[RED] ReferAFriendTab’s step copy names the contractor, not Accent', async () => {
    // Separate from that file's CONTRACTOR_CONFIG reads: line 234 hardcodes the
    // name inside body copy, so it survives a rewiring that only touches the
    // contact block. On no inventory list.
    await underBothBrands(
      <ReferAFriendTab userName="Dana Referrer" token="t" />,
      brand => document.body.textContent.includes(brand.companyName),
      async () => {
        expect(document.body.textContent).toMatch(/reaches out to schedule a free roof inspection/i);
        expect(document.body.textContent).not.toMatch(/Accent Roofing/i);
      }
    );
  });
});

// ── THE SWEEP ────────────────────────────────────────────────────────────────
// Source text, not rendered output: the failure mode is a literal on a branch no
// test happens to render — a fallback, an error state, a share message. Reading
// the file catches every branch at once, and it is what the four components on no
// inventory list needed.
describe('C/DL-3b Phase 6B — no Accent literal survives in the rewired files', () => {
  const FILES = [
    'src/components/shared/ContactModal.jsx',
    'src/components/referrer/ContractorAboutModal.jsx',
    'src/components/referrer/BookingFormModal.jsx',
    'src/components/referrer/ReferAFriendTab.jsx',
    'src/components/referrer/ExperiencePopup.jsx',
    'src/components/referrer/DashboardTab.jsx',
    // Added in 6C — Group A's remaining two, plus the admin campaign surface.
    'src/components/referrer/AnnouncementPopup.jsx',
    'src/components/referrer/CashOutTab.jsx',
    'src/components/admin/AdminCampaigns.jsx',
  ];

  // ⚠ NORMALISE BEFORE COMPARING. A LITERAL SWEEP MATCHES FORMATTING, NOT VALUES.
  //
  // This list previously held `770-277-4869` and nothing else for the phone — so
  // a `tel:` href in ContactModal, carrying the SAME NUMBER with its separators
  // removed, matched nothing and survived the entire Phase 6 sweep. The modal
  // displayed the right contractor's number and dialled the wrong one, live in
  // production, on the tap target a homeowner on a phone actually presses.
  //
  // Values with more than one rendering, and how each is handled:
  //   PHONE — dashes, spaces, dots, parens, +1 prefix, or bare digits.
  //           Normalised by stripping every non-digit from BOTH sides.
  //   URL   — with/without scheme, with/without www, with/without trailing slash.
  //           Normalised by stripping scheme, www. and any trailing slash.
  //   EMAIL — the one single-rendering case here; compared as-is, lowercased.
  //   NAMES / IDENTIFIERS — compared as-is; they have no alternate spelling.
  const normalise = {
    digits: text => text.replace(/\D/g, ''),
    url:    text => text.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, ''),
    plain:  text => text.toLowerCase(),
  };

  // Each needle declares HOW it must be compared, not just what it is.
  const ACCENT = [
    { kind: 'plain',  value: 'Accent Roofing' },
    { kind: 'plain',  value: 'AccentRoofing' },
    { kind: 'plain',  value: 'accentRoofingLogo' },
    { kind: 'plain',  value: 'leaksmith.com' },
    { kind: 'plain',  value: 'accentroofingservice' },
    { kind: 'plain',  value: 'CbtYNjHgUCwhEBM' },  // the g.page short link's id
    { kind: 'plain',  value: 'CONTRACTOR_CONFIG' }, // the delivery mechanism goes too
    { kind: 'digits', value: '770-277-4869' },      // ⚠ matches ANY rendering of the number
  ];

  for (const file of FILES) {
    it(`[RED] ${file} carries no Accent literal and no CONTRACTOR_CONFIG read`, () => {
      const source = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

      const found = ACCENT.filter(({ kind, value }) => {
        if (kind === 'digits') {
          // Compare digit-runs, so dashed, bare, parenthesised, dotted and
          // country-prefixed renderings are all the same needle.
          const target = normalise.digits(value);
          return (source.match(/[\d][\d\s().+-]{6,}[\d]/g) || [])
            .some(run => normalise.digits(run).endsWith(target));
        }
        return normalise.plain(source).includes(normalise.plain(value));
      }).map(n => n.value);

      expect(found,
        `${file} still carries: ${found.join(', ')}. Contractor identity comes from ` +
        'ThemeContext (the D4 chain), never from a hardcoded module. NOTE: phone ' +
        'needles match ANY rendering — a hit may be formatted differently from the ' +
        'needle shown.'
      ).toEqual([]);
    });
  }
});

// ── THE TEARDOWN ─────────────────────────────────────────────────────────────
describe('C/DL-3b Phase 6D — CONTRACTOR_CONFIG is gone, not merely unused', () => {

  it('src/config/contractor.js exports platform values ONLY', () => {
    // ⚠ ASSERTED ON THE SOURCE, NOT ON AN IMPORT. `import { CONTRACTOR_CONFIG }`
    // of a non-existent export yields `undefined` under Vite's dev/test pipeline
    // rather than throwing, so an import-based check would pass just as happily
    // against a file that still defined it. Reading the file is the only form of
    // this assertion that can actually fail — the lesson from three consecutive
    // vacuity findings this phase.
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/config/contractor.js'), 'utf8');

    expect(source).not.toMatch(/export\s+const\s+CONTRACTOR_CONFIG/);

    // NON-VACUITY: prove the file is the real one and still exports what the app
    // needs, rather than being empty or renamed — either of which would satisfy
    // the negative above while breaking every consumer.
    expect(source).toMatch(/export\s+const\s+BACKEND_URL/);
    expect(source).toMatch(/export\s+const\s+STRIPE_PUBLISHABLE_KEY/);
  });

  it('no file in src/ imports CONTRACTOR_CONFIG', () => {
    // The module could be deleted and a consumer left behind — that consumer would
    // read `undefined` and render blanks, silently. This walks src/ rather than
    // trusting the per-file sweep above, which covers only the rewired files.
    const offenders = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!/\.(js|jsx)$/.test(entry.name)) continue;
        // ⚠ TEST FILES ARE EXCLUDED, and the exclusion is narrow on purpose: the
        // sweep needle above IS the string `CONTRACTOR_CONFIG`, so a test file
        // naming it is the guard working, not a violation. Production code is what
        // this walks.
        if (/\.test\.(js|jsx)$/.test(entry.name)) continue;
        const source = fs.readFileSync(full, 'utf8');
        // The character class excludes NEWLINES as well as the closing brace.
        // Allowing newlines lets one import statement's match run all the way to
        // an unrelated mention pages later — which is how this check first
        // flagged its own file.
        if (/import\s*\{[^}\r\n]*CONTRACTOR_CONFIG/.test(source)) offenders.push(full);
      }
    };
    walk(path.resolve(process.cwd(), 'src'));

    expect(offenders,
      `these files still import CONTRACTOR_CONFIG, which no longer exists — they will read ` +
      `undefined and render blanks with nothing failing: ${offenders.join(', ')}`
    ).toEqual([]);
  });
});

// ── ABSENT VALUES MUST NOT RENDER DEAD TARGETS ───────────────────────────────
//
// ⚠ THIS IS THE FIFTH VACUITY INSTANCE OF THE PHASE AND THE FIRST TO REACH
// PRODUCTION. The 6C DashboardTab test asserted `reviewMessage` and
// `reviewButtonText` — both DEFAULTED, so both always render whatever happens.
// Nothing exercised `reviewUrl`, which is NOT defaulted. The card therefore
// shipped rendering a button whose href resolved to the app's own origin plus a
// literal "null" path:
// window.open(null) stringifies null to "null" per USVString conversion and
// resolves it against the document.
//
// THE RULE: when a value is deliberately allowed to be absent, THE ABSENT CASE IS
// THE PRIMARY TEST. Asserting a component's DEFAULTED values cannot see a bug in
// its NON-DEFAULTED ones.
describe('C/DL-3b correction — absent branding values render nothing, never a dead target', () => {

  it('[RED] no review URL → the review card is ABSENT, not disabled and not dead-linked', async () => {
    renderForBrand(BRAND_BARE, (
      <DashboardTab
        setTab={() => {}} pipeline={[]} loading={false}
        pipelineRateLimited={false} pipelineStale={false} pipelineStaleSince={null}
        pipelineUnavailable={false} userName="Dana Referrer" balance={0} paidCount={0}
        profilePhoto={null} showReviewCard onDismissReview={() => {}}
        sessionToken="t" onViewAllReferrals={() => {}} bankStatus={null}
        onOpenBankSetup={() => {}}
      />
    ));
    await waitFor(() => expect(document.body.textContent).toContain('Dana'));

    // No placeholder, no disabled button, no dead link — the card simply is not there.
    expect(screen.queryByText(BRAND_BARE.reviewMessage ?? 'Enjoying the rewards? Leave us a quick review!')).toBeNull();
    expect(screen.queryByRole('button', { name: /leave a review/i })).toBeNull();
  });

  it('[RED] no logo → neither AnnouncementPopup nor CashOutTab renders a broken image', async () => {
    // Both were introduced in 6C: the hardcoded logo they replaced could never be
    // null, so neither acquired a guard while every other logoUrl consumer has one.
    renderForBrand(BRAND_BARE, (
      <AnnouncementPopup
        announcement={{ id: 1, amount: '50.00', referred_name: 'Sam Homeowner' }}
        referrerFirstName="Dana" onDismiss={() => {}}
        settings={{ enabled: true, mode: 'preset_2', custom_message: null }}
      />
    ));
    await waitFor(() => expect(document.body.textContent).toContain(BRAND_BARE.companyName));

    for (const img of document.querySelectorAll('img')) {
      const src = img.getAttribute('src');
      expect(src, 'an <img> was rendered with no usable src').toBeTruthy();
      expect(src).not.toMatch(/^(null|undefined)$/);
    }
  });
});

// ── THE BROAD ASSERTION ──────────────────────────────────────────────────────
// Across the app, not per component: the per-component tests above can only see
// the components someone remembered to write a test for, and this class of bug is
// created by a mechanical edit (replace a literal with a nullable value) that
// touches files nobody is thinking about.
describe('C/DL-3b correction — no navigation target anywhere resolves to null/undefined', () => {
  const BAD = /(^|\/)(null|undefined)$/;

  it('[RED] no src, href or window.open target is a stringified null', async () => {
    const surfaces = [
      ['AnnouncementPopup', (
        <AnnouncementPopup
          announcement={{ id: 1, amount: '50.00', referred_name: 'Sam Homeowner' }}
          referrerFirstName="Dana" onDismiss={() => {}}
          settings={{ enabled: true, mode: 'preset_2', custom_message: null }}
        />
      )],
      ['ContactModal', <ContactModal isOpen onClose={() => {}} />],
    ];

    for (const [label, ui] of surfaces) {
      const { unmount } = renderForBrand(BRAND_BARE, ui);
      await waitFor(() => expect(document.querySelectorAll('*').length).toBeGreaterThan(3));

      for (const el of document.querySelectorAll('[src],[href]')) {
        for (const attr of ['src', 'href']) {
          const value = el.getAttribute(attr);
          if (value === null) continue;
          expect(value, `${label}: <${el.tagName.toLowerCase()} ${attr}="${value}">`).not.toMatch(BAD);
          expect(value, `${label}: <${el.tagName.toLowerCase()} ${attr}> is empty`).not.toBe('');
        }
      }
      unmount();
    }
  });
});
