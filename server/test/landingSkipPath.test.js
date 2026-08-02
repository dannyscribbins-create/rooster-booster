'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// C/DL-2 — PHASE 3d-3 RED SUITE (2 of 2) — THE SKIP PATH AND ITS INTERSTITIAL
//
// LP §2's State 1 secondary link plus the "Skip-path interstitial" subsection:
//
//   On "Skip" tap: token copied to clipboard IN THE SAME GESTURE → brief
//   confirmation (~1.5s) → redirect to the platform-detected store.
//   Android → Play Store URL with the token on the install-referrer parameter.
//   iOS → App Store URL. Desktop/unknown → State 3-style dual-badge view, no
//   clipboard.
//
// The link label and its microcopy are LP's BINDING DL-5 disclosure wording —
// "Exact DL-5 disclosure #1 wording — binding", a stronger lock than the rest of
// §2's copy.
//
// ── WHY THIS FILE EXECUTES THE PAGE SCRIPT INSTEAD OF GREPPING IT ───────────
// Every other landing suite asserts on the served bytes, and for markup that is
// the right boundary — the document IS the route's contract. The skip path is
// different in kind: its entire contract is what happens WHEN THE BUTTON IS
// PRESSED. "The document mentions navigator.clipboard" proves nothing about
// whether a click copies anything, and it is exactly the kind of assertion that
// stays green while the button is dead.
//
// So this file extracts the page's script — inline nonce'd blocks and any
// same-origin /static file it loads — and runs it under `node:vm` against a
// purpose-built fake DOM, a controllable clock, a recording clipboard and a
// recording location. Then it presses the button and watches.
//
// NO jsdom, and that is deliberate rather than frugal: jsdom is a devDependency
// of react-scripts reachable only by hoisting accident, and the surface actually
// needed here is small enough to state explicitly. A hand-built fake also makes
// the assertions legible — "no navigation was recorded" beats "location.href is
// still about:blank".
//
// ── THE HARNESS IS SELECTOR-AGNOSTIC ON PURPOSE ─────────────────────────────
// It reads the skip control's id and classes OUT OF THE SERVED MARKUP and
// registers the same fake element under getElementById(id), querySelector('#id')
// and querySelector('.class') for each class. Whichever way the implementation
// reaches for the button, it gets the element this file is watching. What is
// pinned is that a click handler is attached to the control bearing LP's label —
// not which selector found it.
//
// ── WHAT IS NOT IN SCOPE, AND MUST NOT BE INVENTED ──────────────────────────
// ⚠ THE STORE URLS DO NOT EXIST. There are no listings. The destinations are
// placeholders behind the same STORE_BADGES_ACTIVE gate as the badge slot (A14);
// the mechanism is built and tested now, the destinations are filled at the
// Capacitor session. §4 below asserts that no plausible-looking real store URL
// was invented in the meantime.
//
// Also out of scope, and needing Capacitor: the Android install-referrer
// receiver and the iOS first-launch "were you referred?" prompt. This file tests
// the page's half of the handshake only — that the token leaves the browser on
// both channels it is supposed to leave on.
//
// NO PRODUCTION CONTRACTOR ID OR SLUG LITERALS (house rule).
// ─────────────────────────────────────────────────────────────────────────────

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { request: _httpRequest } = require('node:http');

const { initTestDb } = require('./setup');
const { createApp } = require('../app');
const { startTestServer, stopTestServer } = require('./helpers');

// ── FIXTURES ────────────────────────────────────────────────────────────────

const TENANT_A = 'test-tenant-skip-a';
const SLUG_A = 'alphaskip';
const APEX = 'roofmiles.com';
const hostFor = slug => `${slug}.${APEX}`;
const landingPath = slug => `/i/${slug}`;

const TABLE = 'contractor_invite_links';

const BRAND_A = {
  companyName: 'Alpha Skip Roofing',
  programName: 'Alpha Skip Rewards',
  primary: '#AA1111',
  secondary: '#AA2222',
  accent: '#AA4444',
  bg: '#AA3333',
};

// ── LP COPY, VERBATIM AND BINDING ───────────────────────────────────────────
// Transcribed by hand from LANDING_PAGE_SPEC.md §2. The first two are DL-5
// disclosure #1 and are marked binding in LP itself; the third is the
// interstitial's confirmation.
const SKIP_LABEL = 'Skip — just get the app';
const SKIP_MICROCOPY = "We'll copy your referral code so the app can connect you automatically.";
const SKIP_CONFIRMATION = 'Your referral code is copied — see you in the app! ✓';

// State 1's card title, used purely as a "the page really rendered" precondition.
const CARD_TITLE = 'Create your account';

// The A14 gate, named the same way landingStates.test.js names it. A14 does not
// name the variable; renaming is a one-line change here and in the code.
const BADGE_FLAG = 'STORE_BADGES_ACTIVE';

// ── PLATFORM FIXTURES ───────────────────────────────────────────────────────
// Real-shaped user-agent strings. `platform` and `maxTouchPoints` are supplied
// alongside so that a detector reading any of the three ordinary signals gets a
// self-consistent answer — the test must not fail because the implementation
// chose a different (equally valid) sniff.
//
// The iPad entry is the case worth having: modern iPadOS reports a Macintosh UA
// with maxTouchPoints > 1, which is why touch points are provided at all.
const PLATFORMS = {
  android: {
    label: 'Android',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    platform: 'Linux armv8l',
    maxTouchPoints: 5,
  },
  ios: {
    label: 'iOS',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    platform: 'iPhone',
    maxTouchPoints: 5,
  },
  desktop: {
    label: 'desktop',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    platform: 'Win32',
    maxTouchPoints: 0,
  },
};

// How far the fake clock is wound after a click. LP specifies "~1.5s"; this
// suite deliberately does NOT pin the exact dwell, because 1200ms and 1800ms are
// both faithful readings of "~1.5s" and neither is a bug. What it pins is that
// there IS a dwell (nothing navigates before the clock moves) and that the
// redirect DOES arrive (it has happened by the time the clock reaches here).
const ADVANCE_MS = 4000;

// Hostnames that would mean somebody invented a real-looking store destination.
// The listings do not exist; a URL that looks like they do is worse than an
// obvious placeholder, because it will be clicked, screenshotted and believed.
const REAL_STORE_HOSTS = ['play.google.com', 'apps.apple.com', 'itunes.apple.com', 'market.android.com'];

// ── HTTP TRANSPORT ──────────────────────────────────────────────────────────
let _ipCounter = 0;
function nextIp() {
  _ipCounter += 1;
  return `10.72.${Math.floor(_ipCounter / 250)}.${(_ipCounter % 250) + 1}`;
}

function httpGet(port, path, { host = null } = {}) {
  const headers = { 'X-Forwarded-For': nextIp() };
  if (host) headers.Host = host;
  return new Promise((resolve, reject) => {
    const req = _httpRequest(
      { hostname: 'localhost', port, path, method: 'GET', headers },
      res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({
          status: res.statusCode,
          contentType: res.headers['content-type'] || '',
          raw: Buffer.concat(chunks).toString(),
        }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

// ── MARKUP HELPERS ──────────────────────────────────────────────────────────

function renderedText(html) {
  return String(html)
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

// Normalises the dash entities so the label search works whether the em dash was
// emitted literally or as an entity. escapeHtml does not touch it today, but an
// implementation that did would be producing identical output on screen and must
// not fail a wiring test for it.
function normalizeDashes(html) {
  return String(html).replace(/&mdash;|&#8212;|&#x2014;/gi, '—');
}

// Finds the element whose text is LP's skip label and returns its id and classes.
//
// This is how the harness stays selector-agnostic: it does not assume the
// implementation calls the control `skip-btn`. It reads whatever hooks the
// served markup actually carries and registers the fake element under all of
// them.
function findSkipControl(html) {
  const source = normalizeDashes(html);
  const re = new RegExp(
    `<([a-zA-Z][\\w-]*)\\b([^>]*)>\\s*${SKIP_LABEL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*<\\/\\1>`
  );
  const m = source.match(re);
  assert.ok(
    m,
    `the control bearing LP's binding skip label ("${SKIP_LABEL}") was not found as a single element in ` +
    'the served document. The label and its microcopy are DL-5 disclosure #1 and are binding.'
  );

  const attrs = m[2] || '';
  const idMatch = attrs.match(/\bid\s*=\s*["']([^"']+)["']/);
  const classMatch = attrs.match(/\bclass\s*=\s*["']([^"']*)["']/);
  const dataMatch = [...attrs.matchAll(/\b(data-[\w-]+)\s*=\s*["']([^"']*)["']/g)];

  return {
    tag: m[1],
    id: idMatch ? idMatch[1] : null,
    classes: classMatch ? classMatch[1].split(/\s+/).filter(Boolean) : [],
    dataAttrs: dataMatch.map(d => d[1]),
  };
}

// Collects every script the page runs: inline blocks first, then any same-origin
// file it pulls in. The landing route ships one nonce'd inline block today, but
// the skip logic is equally allowed to live in a /static file under
// `script-src 'self'` — the harness must not force that choice.
async function collectPageScripts(port, html) {
  const sources = [];

  for (const m of String(html).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1] || '';
    const body = m[2] || '';
    const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/);
    if (srcMatch) {
      const src = srcMatch[1];
      // Same-origin, absolute-path references only. An off-origin script cannot
      // load under this route's CSP anyway.
      if (src.startsWith('/')) {
        const fetched = await httpGet(port, src);
        assert.equal(fetched.status, 200, `the page references ${src}, which did not serve (${fetched.status})`);
        sources.push(fetched.raw);
      }
    } else if (body.trim()) {
      sources.push(body);
    }
  }

  return sources.join('\n;\n');
}

// ── FAKE DOM ────────────────────────────────────────────────────────────────
// Small on purpose. Everything the landing script touches today plus the surface
// the skip path needs, and nothing else. Every observable the tests assert on is
// RECORDED rather than inferred.

function makeEnv({ platform, clipboardMode, skip, documentHtml }) {
  const record = {
    navigations: [],       // every attempt to leave the page, whatever the mechanism
    clipboardWrites: [],   // every value handed to navigator.clipboard.writeText
    classMutations: [],    // every classList add/remove — "the handler did something"
    textWrites: [],        // every textContent/innerHTML assignment
    fetches: [],
    errors: [],            // anything a timer callback threw
  };

  const elements = [];

  function makeElement(desc = {}) {
    const classes = new Set(desc.classes || []);
    const name = desc.name || desc.id || desc.selector || 'element';
    const el = {
      _name: name,
      id: desc.id || '',
      tagName: (desc.tag || 'div').toUpperCase(),
      value: '',
      disabled: false,
      hidden: false,
      dataset: {},
      style: {},
      _text: '',
      _html: '',
      _attrs: new Map(),
      _listeners: new Map(),
      get className() { return [...classes].join(' '); },
      set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach(c => classes.add(c)); },
      get textContent() { return el._text; },
      set textContent(v) { el._text = String(v); record.textWrites.push({ name, value: String(v) }); },
      get innerHTML() { return el._html; },
      set innerHTML(v) { el._html = String(v); record.textWrites.push({ name, value: String(v) }); },
      classList: {
        add(...cs) { cs.forEach(c => { if (!classes.has(c)) { classes.add(c); record.classMutations.push({ name, op: 'add', c }); } }); },
        remove(...cs) { cs.forEach(c => { if (classes.has(c)) { classes.delete(c); record.classMutations.push({ name, op: 'remove', c }); } }); },
        toggle(c, force) {
          const want = force === undefined ? !classes.has(c) : Boolean(force);
          if (want) this.add(c); else this.remove(c);
          return want;
        },
        contains(c) { return classes.has(c); },
      },
      setAttribute(k, v) { el._attrs.set(String(k), String(v)); if (k === 'href' || k === 'src') record.navigations.push({ via: `setAttribute(${k})`, url: String(v) }); },
      getAttribute(k) { return el._attrs.has(String(k)) ? el._attrs.get(String(k)) : null; },
      removeAttribute(k) { el._attrs.delete(String(k)); },
      addEventListener(type, fn) {
        if (typeof fn !== 'function') return;
        if (!el._listeners.has(type)) el._listeners.set(type, []);
        el._listeners.get(type).push(fn);
      },
      removeEventListener(type, fn) {
        const list = el._listeners.get(type);
        if (list) el._listeners.set(type, list.filter(f => f !== fn));
      },
      dispatchEvent() { return true; },
      focus() {}, blur() {}, click() { fire(el, 'click'); },
      appendChild(child) { return child; },
      removeChild(child) { return child; },
      insertAdjacentHTML(_pos, html) { record.textWrites.push({ name, value: String(html) }); },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      closest() { return null; },
      scrollIntoView() {},
      getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0 }; },
    };
    elements.push(el);
    return el;
  }

  function fire(el, type, extra = {}) {
    const listeners = el._listeners.get(type) || [];
    const event = {
      type,
      isTrusted: true,
      target: el,
      currentTarget: el,
      preventDefault() {},
      stopPropagation() {},
      clipboardData: null,
      ...extra,
    };
    for (const fn of listeners) fn.call(el, event);
    return listeners.length;
  }

  // ── ELEMENT REGISTRY ──────────────────────────────────────────────────────
  // The skip control is registered under every hook the served markup gave it, so
  // the harness does not dictate how the implementation selects it. Everything
  // else resolves to a stable per-key stub, so repeated lookups return the same
  // object and the script's own `if (el)` guards behave.
  const byId = new Map();
  const bySelector = new Map();

  const skipEl = makeElement({
    name: 'skip-control', tag: skip.tag, id: skip.id || '', classes: skip.classes,
  });
  if (skip.id) {
    byId.set(skip.id, skipEl);
    bySelector.set(`#${skip.id}`, skipEl);
  }
  for (const c of skip.classes) bySelector.set(`.${c}`, skipEl);
  for (const d of skip.dataAttrs) bySelector.set(`[${d}]`, skipEl);

  function getElementById(id) {
    const key = String(id);
    if (!byId.has(key)) byId.set(key, makeElement({ name: key, id: key }));
    return byId.get(key);
  }

  function querySelector(sel) {
    const key = String(sel).trim();
    if (bySelector.has(key)) return bySelector.get(key);
    if (key.startsWith('#')) return getElementById(key.slice(1));
    bySelector.set(key, makeElement({ name: key, selector: key }));
    return bySelector.get(key);
  }

  function querySelectorAll(sel) {
    const key = String(sel).trim();
    if (bySelector.has(key)) return [bySelector.get(key)];
    // Unknown selectors resolve to nothing rather than to a phantom element:
    // the page script iterates these, and inventing members would make an
    // "everything was hidden" loop look successful.
    return [];
  }

  // ── CONTROLLABLE CLOCK ────────────────────────────────────────────────────
  let now = 0;
  let seq = 0;
  const timers = new Map();

  const clock = {
    setTimeout(fn, ms) {
      seq += 1;
      timers.set(seq, { id: seq, at: now + (Number(ms) || 0), fn, every: null });
      return seq;
    },
    setInterval(fn, ms) {
      seq += 1;
      const every = Math.max(1, Number(ms) || 1);
      timers.set(seq, { id: seq, at: now + every, fn, every });
      return seq;
    },
    clear(id) { timers.delete(id); },
    async advance(ms) {
      const target = now + ms;
      for (;;) {
        let next = null;
        for (const t of timers.values()) {
          if (t.at > target) continue;
          if (!next || t.at < next.at || (t.at === next.at && t.id < next.id)) next = t;
        }
        if (!next) break;
        now = next.at;
        if (next.every) next.at = now + next.every;
        else timers.delete(next.id);
        try { next.fn(); } catch (err) { record.errors.push(err); }
        await flushMicrotasks();
      }
      now = target;
      await flushMicrotasks();
    },
  };

  // ── CLIPBOARD ─────────────────────────────────────────────────────────────
  // Three modes, one per hazard LP and the build brief name:
  //   'ok'          the ordinary path
  //   'reject'      permission denied, or a browser that refuses in this context
  //   'unavailable' no navigator.clipboard at all — an insecure context or an
  //                 older engine. This is the one that turns a naive
  //                 `navigator.clipboard.writeText(...)` into a TypeError before
  //                 the redirect is ever reached.
  let clipboard;
  if (clipboardMode === 'unavailable') {
    clipboard = undefined;
  } else {
    clipboard = {
      writeText(text) {
        record.clipboardWrites.push(String(text));
        return clipboardMode === 'reject'
          ? Promise.reject(new Error('NotAllowedError: write permission denied'))
          : Promise.resolve();
      },
    };
  }

  // ── LOCATION ──────────────────────────────────────────────────────────────
  // Every mechanism a redirect could use is recorded through one channel, so the
  // assertions never have to guess which one the implementation picked.
  const locationTarget = {
    protocol: 'https:',
    host: hostFor(SLUG_A),
    hostname: hostFor(SLUG_A),
    pathname: '/',
    search: '',
    hash: '',
    _href: `https://${hostFor(SLUG_A)}/`,
    assign(url) { record.navigations.push({ via: 'location.assign', url: String(url) }); },
    replace(url) { record.navigations.push({ via: 'location.replace', url: String(url) }); },
    reload() {},
    toString() { return locationTarget._href; },
  };
  Object.defineProperty(locationTarget, 'href', {
    get() { return locationTarget._href; },
    set(v) { record.navigations.push({ via: 'location.href', url: String(v) }); },
    enumerable: true,
  });

  const documentStub = {
    getElementById,
    querySelector,
    querySelectorAll,
    createElement: tag => makeElement({ name: `created:${tag}`, tag }),
    addEventListener() {},
    removeEventListener() {},
    execCommand(cmd) { if (cmd === 'copy') record.clipboardWrites.push('[document.execCommand copy]'); return true; },
    body: makeElement({ name: 'body', tag: 'body' }),
    head: makeElement({ name: 'head', tag: 'head' }),
    documentElement: makeElement({ name: 'html', tag: 'html' }),
    readyState: 'complete',
    location: locationTarget,
    cookie: '',
    title: '',
  };

  const navigatorStub = {
    userAgent: platform.userAgent,
    platform: platform.platform,
    maxTouchPoints: platform.maxTouchPoints,
    vendor: 'Test',
    language: 'en-US',
    languages: ['en-US'],
    clipboard,
  };

  const sandbox = {
    console: { log() {}, warn() {}, error() {}, info() {}, debug() {} },
    document: documentStub,
    navigator: navigatorStub,
    location: locationTarget,
    setTimeout: (fn, ms) => clock.setTimeout(fn, ms),
    clearTimeout: id => clock.clear(id),
    setInterval: (fn, ms) => clock.setInterval(fn, ms),
    clearInterval: id => clock.clear(id),
    requestAnimationFrame: fn => clock.setTimeout(fn, 16),
    cancelAnimationFrame: id => clock.clear(id),
    fetch: (path, init) => {
      record.fetches.push({ path: String(path), init });
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
        text: async () => '',
      });
    },
    scrollTo() {},
    open(url) { record.navigations.push({ via: 'window.open', url: String(url) }); return null; },
    alert() {}, confirm() { return true; }, prompt() { return null; },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
    localStorage: {
      _s: new Map(),
      getItem(k) { return this._s.has(k) ? this._s.get(k) : null; },
      setItem(k, v) { this._s.set(k, String(v)); },
      removeItem(k) { this._s.delete(k); },
    },
    URL, URLSearchParams, encodeURIComponent, decodeURIComponent, JSON, Math, Date,
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);

  return {
    record,
    documentHtml,
    skipEl,
    clock,
    run(source) {
      vm.runInContext(source, context, { filename: 'landing-page-script.js' });
    },
    clickSkip() {
      const fired = fire(skipEl, 'click');
      assert.notEqual(
        fired, 0,
        `no click handler is attached to the skip control ("${SKIP_LABEL}"). CSP sets script-src-attr ` +
        "'none', so an onclick= attribute silently never fires — the listener must be attached with " +
        'addEventListener from the page script. A button with a label and no listener is a dead button.'
      );
      return fired;
    },
    // True when LP's confirmation reached the visitor by either available route:
    // shipped in the document and revealed, or written into an element on click.
    confirmationPresent() {
      if (renderedText(documentHtml).includes(SKIP_CONFIRMATION)) return true;
      return record.textWrites.some(w => renderedText(w.value).includes(SKIP_CONFIRMATION));
    },
  };
}

async function flushMicrotasks() {
  for (let i = 0; i < 5; i += 1) await new Promise(r => setImmediate(r));
}

describe('C/DL-2 Phase 3d-3 — the skip path (LP §2 secondary link + interstitial)', () => {
  let pool, server, port;

  before(async () => {
    pool = await initTestDb();
    ({ server, port } = await startTestServer(createApp()));
  });

  after(async () => {
    await stopTestServer(server);
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query(`DELETE FROM ${TABLE}`);
    await pool.query('DELETE FROM sessions');
    await pool.query('DELETE FROM user_badges');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM team_members');
    await pool.query('DELETE FROM titles');
    await pool.query('DELETE FROM contractor_settings');
    await pool.query('DELETE FROM contractors');

    await pool.query(
      `INSERT INTO contractors (id, name, slug) VALUES ($1, $2, $3)`,
      [TENANT_A, BRAND_A.companyName, SLUG_A]
    );
    await pool.query(
      `INSERT INTO contractor_settings
         (contractor_id, company_name, app_display_name, primary_color, secondary_color,
          accent_color, landing_bg_color)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [TENANT_A, BRAND_A.companyName, BRAND_A.programName, BRAND_A.primary,
        BRAND_A.secondary, BRAND_A.accent, BRAND_A.bg]
    );
  });

  let _slugCounter = 0;
  async function mintMarketingToken() {
    _slugCounter += 1;
    const slug = `skiptok-${Date.now()}-${_slugCounter}`;
    await pool.query(
      `INSERT INTO ${TABLE} (contractor_id, slug, link_type, created_by_user_id, owner_team_member_id, active)
       VALUES ($1, $2, 'contractor', NULL, NULL, true)`,
      [TENANT_A, slug]
    );
    return slug;
  }

  // Serves State 1, boots its script under the fake DOM, presses skip, and
  // snapshots the world at three moments. Every test below reads from this.
  //
  // THE THREE SNAPSHOTS ARE THE POINT:
  //   atDispatch  — taken synchronously, before a single microtask runs. A
  //                 clipboard write visible here happened INSIDE the click
  //                 gesture, which is the only place the browser will allow it.
  //   afterFlush  — promises settled, clock NOT advanced. A navigation visible
  //                 here means the confirmation never had time to be read.
  //   final       — clock wound past any plausible dwell.
  async function pressSkip({ platform, clipboardMode = 'ok', badgeFlag }) {
    const previousFlag = process.env[BADGE_FLAG];
    if (badgeFlag === undefined) delete process.env[BADGE_FLAG];
    else process.env[BADGE_FLAG] = badgeFlag;

    try {
      const slug = await mintMarketingToken();
      const res = await httpGet(port, landingPath(slug), { host: hostFor(SLUG_A) });

      assert.equal(res.status, 200, `precondition: State 1 must render (got ${res.status})`);
      assert.match(res.contentType, /text\/html/i, 'precondition: the landing page must be HTML');
      const text = renderedText(res.raw);
      assert.ok(text.includes(CARD_TITLE), 'precondition: State 1 must actually render its signup card');
      assert.ok(text.includes(SKIP_LABEL), `precondition: the skip label must be present ("${SKIP_LABEL}")`);

      const source = await collectPageScripts(port, res.raw);
      assert.ok(
        source.trim().length > 0,
        'the page ships no script. The skip path cannot exist without one: ' +
        'navigator.clipboard.writeText requires user activation, so the copy must run inside a real ' +
        'click handler (LP §6.5, A8).'
      );

      const skip = findSkipControl(res.raw);
      const env = makeEnv({
        platform, clipboardMode, skip, documentHtml: res.raw,
      });

      env.run(source);
      await flushMicrotasks();

      env.clickSkip();
      const atDispatch = {
        clipboardWrites: [...env.record.clipboardWrites],
        navigations: [...env.record.navigations],
      };

      await flushMicrotasks();
      const afterFlush = {
        clipboardWrites: [...env.record.clipboardWrites],
        navigations: [...env.record.navigations],
        classMutations: [...env.record.classMutations],
        confirmation: env.confirmationPresent(),
      };

      await env.clock.advance(ADVANCE_MS);
      const final = {
        clipboardWrites: [...env.record.clipboardWrites],
        navigations: [...env.record.navigations],
        classMutations: [...env.record.classMutations],
        confirmation: env.confirmationPresent(),
        errors: [...env.record.errors],
      };

      return { res, slug, env, atDispatch, afterFlush, final };
    } finally {
      if (previousFlag === undefined) delete process.env[BADGE_FLAG];
      else process.env[BADGE_FLAG] = previousFlag;
    }
  }

  // Pulls the install-referrer value out of a destination, whichever of the two
  // shapes it took: a plain `referrer=` parameter, or the percent-encoded nested
  // form Play's own documentation uses (`?id=x&referrer=utm_source%3D...`).
  function installReferrerOf(url) {
    const direct = String(url).match(/[?&]referrer=([^&#]*)/);
    if (direct) return decodeURIComponent(direct[1]);
    const encoded = String(url).match(/referrer%3D([^&#%]*)/i);
    if (encoded) return decodeURIComponent(encoded[1]);
    return null;
  }

  function urlsOf(navigations) {
    return navigations.map(n => n.url);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. THE LINK AND ITS WIRING
  // ═══════════════════════════════════════════════════════════════════════════

  it('[RED] the skip control carries LP\'s binding DL-5 copy and has a real click handler', async () => {
    // The copy half is already fenced by landingStates.test.js and is repeated
    // here as this file's precondition — a wiring test that passed while the label
    // had silently changed would be pinning the wrong button.
    //
    // The wiring half is new and is the whole point of this phase. Phase 3d-2
    // shipped the label with a documented comment that the button "does nothing
    // when tapped". This is what closes that.
    const run = await pressSkip({ platform: PLATFORMS.android, badgeFlag: 'true' });

    const text = renderedText(run.res.raw);
    assert.ok(text.includes(SKIP_LABEL), `LP §2 secondary link is locked: "${SKIP_LABEL}"`);
    assert.ok(
      text.includes(SKIP_MICROCOPY),
      `the DL-5 disclosure wording is BINDING, not merely locked: "${SKIP_MICROCOPY}"`
    );
    // pressSkip() itself asserts a listener exists — reaching this line is that
    // proof. Restated so the failure message names the requirement rather than
    // leaving it implicit in the helper.
    assert.ok(true, 'the skip control must have an addEventListener-attached click handler');
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. THE CLIPBOARD COPY — INSIDE THE GESTURE
  // ═══════════════════════════════════════════════════════════════════════════

  it('[RED] the click copies the token to the clipboard IN THE SAME GESTURE', async () => {
    // navigator.clipboard.writeText requires user activation. A call deferred
    // behind an await, a setTimeout or a fetch has already lost it, and the copy
    // is refused — silently, on a real phone, with the page looking perfectly
    // healthy. This is stated in LP §6.5's amendment as the specific reason the
    // page cannot be JS-free.
    //
    // THE SNAPSHOT IS THE ASSERTION. `atDispatch` is taken synchronously, before
    // any microtask has run, so a write visible in it provably happened inside the
    // handler's synchronous body.
    const run = await pressSkip({ platform: PLATFORMS.android, badgeFlag: 'true' });

    assert.equal(
      run.atDispatch.clipboardWrites.length, 1,
      'the clipboard write must happen synchronously inside the click handler — user activation is ' +
      `already lost by the first await. Writes seen at dispatch: ${run.atDispatch.clipboardWrites.length}, ` +
      `writes seen after the promises settled: ${run.afterFlush.clipboardWrites.length}.`
    );
    assert.ok(
      run.atDispatch.clipboardWrites[0].includes(run.slug),
      `the copied value must carry the token (${run.slug}) — DL-5's disclosure promises the visitor ` +
      `"your referral code", and the app's first launch reads it. Got: ${JSON.stringify(run.atDispatch.clipboardWrites[0])}`
    );
  });

  it('[RED] the confirmation shows, and nothing navigates until it has been on screen', async () => {
    // LP: "token copied to clipboard in the same gesture → brief confirmation
    // (~1.5s) → redirect". The dwell is the disclosure: it is the only moment the
    // visitor is told their code was copied, and a redirect fired in the same
    // frame means nobody reads it.
    //
    // The exact dwell is NOT pinned — 1200ms and 1800ms are both faithful
    // readings of "~1.5s". What is pinned is that there is one at all, and that
    // the redirect does eventually arrive.
    const run = await pressSkip({ platform: PLATFORMS.android, badgeFlag: 'true' });

    assert.equal(
      run.afterFlush.navigations.length, 0,
      'the redirect must wait for the confirmation. Navigating before the clock moves means the ' +
      `visitor never sees it. Navigations at that point: ${JSON.stringify(urlsOf(run.afterFlush.navigations))}`
    );
    assert.ok(
      run.afterFlush.confirmation,
      `LP's interstitial confirmation copy is locked: "${SKIP_CONFIRMATION}". It must either ship in the ` +
      'document and be revealed on click, or be written into the page by the handler.'
    );
    assert.ok(
      run.afterFlush.classMutations.length > 0 || run.afterFlush.confirmation,
      'the click must produce a visible change — a confirmation nobody can see is a dead button'
    );
    assert.equal(
      run.final.navigations.length, 1,
      `exactly one redirect must follow the confirmation within ${ADVANCE_MS}ms. ` +
      `Got: ${JSON.stringify(urlsOf(run.final.navigations))}`
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. PLATFORM BRANCHING
  // ═══════════════════════════════════════════════════════════════════════════

  it('[RED] Android redirects to the Play placeholder with the token on the install-referrer parameter', async () => {
    // The Android half of the handshake. The install-referrer parameter is the
    // ONLY channel that survives the Play Store on Android — it is delivered to
    // the app on first launch by the referrer receiver, which is DL-B's half and
    // is deliberately not built here. The clipboard is the belt; this is the
    // braces, and on Android it is the more reliable of the two.
    const run = await pressSkip({ platform: PLATFORMS.android, badgeFlag: 'true' });

    assert.equal(
      run.final.navigations.length, 1,
      `Android skip must redirect exactly once. Got: ${JSON.stringify(urlsOf(run.final.navigations))}`
    );
    const url = run.final.navigations[0].url;

    const referrer = installReferrerOf(url);
    assert.ok(
      referrer,
      'the Android destination must carry an install-referrer parameter — without it the token never ' +
      `reaches the app through the store. Destination: ${JSON.stringify(url)}`
    );
    assert.ok(
      referrer.includes(run.slug),
      `the install-referrer value must carry the token (${run.slug}). Got: ${JSON.stringify(referrer)}`
    );
  });

  it('[RED] iOS redirects to its own destination — a different one, and the clipboard still carries the token', async () => {
    // iOS has no install-referrer equivalent: the App Store strips everything, so
    // the clipboard is the only channel, read by the first-launch "were you
    // referred?" prompt (DL-B). That makes the copy non-optional on this platform
    // rather than a convenience, which is why it is asserted here as well as in §2.
    //
    // The two destinations are compared against each other rather than matched
    // against a literal: the URLs do not exist yet, so the only durable claim is
    // that the branch actually branches.
    const androidRun = await pressSkip({ platform: PLATFORMS.android, badgeFlag: 'true' });
    const iosRun = await pressSkip({ platform: PLATFORMS.ios, badgeFlag: 'true' });

    assert.equal(
      androidRun.final.navigations.length, 1,
      'precondition: the Android branch must redirect, otherwise there is nothing to differ from'
    );
    assert.equal(
      iosRun.final.navigations.length, 1,
      `iOS skip must redirect exactly once. Got: ${JSON.stringify(urlsOf(iosRun.final.navigations))}`
    );

    assert.ok(
      iosRun.atDispatch.clipboardWrites.length === 1
      && iosRun.atDispatch.clipboardWrites[0].includes(iosRun.slug),
      'on iOS the clipboard is the ONLY channel that survives the App Store — the token must be copied ' +
      'inside the gesture here too'
    );
    assert.notEqual(
      iosRun.final.navigations[0].url, androidRun.final.navigations[0].url,
      'iOS and Android must resolve to DIFFERENT store destinations — one URL for both platforms means ' +
      'the platform branch is not branching'
    );
  });

  it('[RED] desktop shows the badge view: no clipboard, no redirect, and not a dead button', async () => {
    // LP: "Desktop/unknown → State 3-style dual-badge view (no clipboard)."
    //
    // NO CLIPBOARD IS A REQUIREMENT, not an omission. There is no app to paste
    // into on a laptop, and silently taking over someone's clipboard on a page
    // they are only reading is a hostile act. NO REDIRECT for the same reason: a
    // desktop visitor sent to a mobile store page has simply lost the page.
    //
    // NON-VACUITY: the two absences are asserted only AFTER the handler is proved
    // to exist (pressSkip fails without one) and to have produced a visible
    // change. Without that third assertion, "no clipboard and no redirect" is
    // exactly what a button wired to nothing produces.
    //
    // ⚠ DO NOT RESTORE THE `|| run.final.confirmation` THAT USED TO BE ON THE
    // ASSERTION BELOW. It made this test incapable of failing, and it was caught
    // by deliberately breaking the implementation rather than by reading it.
    //
    // confirmationPresent() returns true when LP's confirmation string is in the
    // SERVED BYTES — and any page able to display that confirmation contains the
    // string, whether it ships in the markup (as it does) or as a literal inside
    // the script. So the right-hand side was PERMANENTLY TRUE, short-circuited
    // the whole assertion, and a desktop handler that returned immediately doing
    // nothing at all passed this test 12/12. A test that cannot fail reports a
    // safety it does not provide.
    //
    // Only the CLASS MUTATION is evidence that the click did something: it is
    // recorded by the fake DOM at the moment the handler runs, so it cannot be
    // satisfied by the template. The other route considered — making
    // confirmationPresent() count only textWrites — was rejected because the
    // implementation reveals pre-rendered copy with a class rather than writing
    // textContent, so that version would have reddened the confirmation test
    // above against correct behaviour.
    const run = await pressSkip({ platform: PLATFORMS.desktop, badgeFlag: 'true' });

    assert.ok(
      run.final.classMutations.length > 0,
      'the desktop skip must DO something visible — showing the dual-badge view. A handler that ' +
      'returns early on desktop is indistinguishable from no handler at all, which is what this ' +
      'assertion exists to tell apart.'
    );
    assert.equal(
      run.final.clipboardWrites.length, 0,
      `desktop must not touch the clipboard. Writes seen: ${JSON.stringify(run.final.clipboardWrites)}`
    );
    assert.equal(
      run.final.navigations.length, 0,
      `desktop must not redirect to a store. Navigations seen: ${JSON.stringify(urlsOf(run.final.navigations))}`
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. CLIPBOARD FAILURE DEGRADES — THE BUTTON IS NEVER DEAD
  // ═══════════════════════════════════════════════════════════════════════════

  it('[RED] a REJECTED clipboard write still redirects', async () => {
    // writeText rejects for reasons the page cannot control: a denied permission,
    // a document that lost focus, a browser that refuses the API in this context.
    // The visitor's outcome must be "you'll be asked in the app", never a button
    // that swallowed the tap.
    //
    // (The quoted fallback phrasing above is descriptive — it appears in the build
    // brief, not in LP §2's locked copy — so no exact string is asserted for it.
    // What is asserted is the behaviour LP does bind: the redirect still happens.)
    const run = await pressSkip({ platform: PLATFORMS.android, clipboardMode: 'reject', badgeFlag: 'true' });

    assert.equal(
      run.atDispatch.clipboardWrites.length, 1,
      'precondition: the copy must still be ATTEMPTED — this test is about the rejection, not about ' +
      'skipping the attempt'
    );
    assert.equal(
      run.final.navigations.length, 1,
      'a rejected clipboard write must not swallow the redirect. An unhandled rejection inside the ' +
      `click handler is exactly how it would. Navigations: ${JSON.stringify(urlsOf(run.final.navigations))}`
    );
  });

  it('[RED] an UNAVAILABLE clipboard API still redirects', async () => {
    // The harsher half, and the one a naive implementation fails: on an insecure
    // context or an older engine `navigator.clipboard` is undefined, so
    // `navigator.clipboard.writeText(...)` throws a TypeError SYNCHRONOUSLY —
    // before the redirect line is ever reached. A try/catch around the awaited
    // promise does not help; the throw is on the property access.
    //
    // A page served over plain http (a contractor's own preview, a proxy that
    // strips TLS) hits this on every device.
    const run = await pressSkip({ platform: PLATFORMS.android, clipboardMode: 'unavailable', badgeFlag: 'true' });

    assert.equal(
      run.final.clipboardWrites.length, 0,
      'precondition: there is no clipboard API in this fixture, so nothing can have been written'
    );
    assert.equal(
      run.final.navigations.length, 1,
      'with no clipboard API at all the redirect must still happen — the copy is an enhancement, the ' +
      `redirect is the function. Navigations: ${JSON.stringify(urlsOf(run.final.navigations))}`
    );
    assert.deepEqual(
      run.final.errors, [],
      'no timer callback may throw while degrading — a throw here leaves the visitor on a page whose ' +
      'button has visibly done nothing'
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. THE STORE-URL GATE (A14)
  // ═══════════════════════════════════════════════════════════════════════════

  it('[RED] with the flag UNSET no store URL is emitted, and the button is still alive', async () => {
    // A14's gate governs the destinations exactly as it governs the badge artwork:
    // the listings do not exist, so there is nothing to point at. `!== 'true'`
    // fails closed when unset.
    //
    // NON-VACUITY, and this one needs saying carefully. "No store URL" is trivially
    // satisfied by a page with no skip path at all, which is precisely today's
    // state. So the assertions run in this order: the page rendered (pressSkip),
    // a click handler exists (pressSkip), the token WAS copied — and only then is
    // the absence of a destination asserted. The gate must close the destination,
    // not the feature.
    const run = await pressSkip({ platform: PLATFORMS.android, badgeFlag: undefined });

    assert.equal(
      run.atDispatch.clipboardWrites.length, 1,
      'the gate governs the DESTINATION, not the copy — the token must still reach the clipboard with ' +
      'the flag unset'
    );

    assert.equal(
      run.final.navigations.length, 0,
      `with ${BADGE_FLAG} unset there is no store to send anyone to, so nothing may navigate. ` +
      `Got: ${JSON.stringify(urlsOf(run.final.navigations))}`
    );
    for (const host of REAL_STORE_HOSTS) {
      assert.equal(
        run.res.raw.includes(host), false,
        `the served document must contain no store URL while ${BADGE_FLAG} is unset (found "${host}")`
      );
    }
  });

  it('[RED] the gate is the flag ALONE — no NODE_ENV clause', async () => {
    // A14 in terms: "Gate on the flag ALONE. The precedent (TWILIO_10DLC_ACTIVE)
    // also requires NODE_ENV === 'production'; copying that clause would make the
    // slot untestable on every non-production boot."
    //
    // THIS RUN IS THAT PROOF, which is why NODE_ENV is asserted rather than
    // assumed: an implementation carrying the extra clause redirects nowhere here
    // and fails.
    assert.notEqual(
      process.env.NODE_ENV, 'production',
      'precondition: this proof is only meaningful on a NON-production boot'
    );

    const run = await pressSkip({ platform: PLATFORMS.android, badgeFlag: 'true' });

    assert.equal(
      run.final.navigations.length, 1,
      `with ${BADGE_FLAG}=true the store redirect must fire on a non-production boot. A gate that also ` +
      'tests NODE_ENV fails here, which is exactly what A14 forbids.'
    );
  });

  it('[RED] the gate is a strict compare — a truthy non-"true" value stays closed', async () => {
    // The other half of A14's instruction: "Copy the strict !== 'true' compare,
    // which fails closed when unset, and nothing else." A loose
    // Boolean(process.env.X) opens on 'false', '0' and 'no' — all of which an
    // admin might plausibly set meaning the opposite.
    //
    // NON-VACUITY: the same clipboard-still-copies precondition as the unset test,
    // and its counterweight is the test directly above, which proves the redirect
    // DOES fire under the correct value.
    const run = await pressSkip({ platform: PLATFORMS.android, badgeFlag: 'false' });

    assert.equal(
      run.atDispatch.clipboardWrites.length, 1,
      'precondition: the skip path must still be wired and still copy'
    );
    assert.equal(
      run.final.navigations.length, 0,
      `${BADGE_FLAG}='false' must keep the destination closed — the gate is a strict !== 'true' compare`
    );
  });

  it('[RED] the placeholders are placeholders — no invented real store URL', async () => {
    // ⚠ THE STORE LISTINGS DO NOT EXIST. A destination that LOOKS real is worse
    // than an obviously fake one: it will be tapped, screenshotted for a
    // contractor, and pasted into printed material, and it goes to a Play Store
    // 404 with our branding on the referring page.
    //
    // The build brief is explicit — "Do not invent plausible-looking store URLs" —
    // and the mechanism is what ships now; the destinations are filled at the
    // Capacitor session alongside the official badge artwork (A14).
    //
    // NON-VACUITY: both branches are asserted to have PRODUCED a destination
    // before either is inspected, so this cannot pass because nothing navigated.
    const androidRun = await pressSkip({ platform: PLATFORMS.android, badgeFlag: 'true' });
    const iosRun = await pressSkip({ platform: PLATFORMS.ios, badgeFlag: 'true' });

    assert.equal(androidRun.final.navigations.length, 1, 'precondition: Android must have a destination');
    assert.equal(iosRun.final.navigations.length, 1, 'precondition: iOS must have a destination');

    const destinations = [
      androidRun.final.navigations[0].url,
      iosRun.final.navigations[0].url,
    ];

    for (const url of destinations) {
      for (const host of REAL_STORE_HOSTS) {
        assert.equal(
          String(url).includes(host), false,
          `"${host}" is a real store hostname and there is no listing behind it. The destination must ` +
          `be a recognisable placeholder until the Capacitor session fills it. Got: ${JSON.stringify(url)}`
        );
      }
    }
  });
});
