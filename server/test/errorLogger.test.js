'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// buildAlertSubject is extracted from the inline subject-line logic in
// sendErrorAlert(). It is a pure function — no DB or external calls needed.
const { buildAlertSubject } = require('../middleware/errorLogger');

describe('buildAlertSubject — alert email subject-line environment label', () => {
  const base = '[RoofMiles] [Backend] INFO Error — /api/test — something went wrong';

  it('prefixes [STAGING] when nodeEnv is "staging"', () => {
    assert.equal(buildAlertSubject(base, 'staging'), `[STAGING] ${base}`);
  });

  it('does NOT prefix [STAGING] when nodeEnv is "production"', () => {
    assert.equal(buildAlertSubject(base, 'production'), base);
  });

  it('does NOT prefix [STAGING] when nodeEnv is undefined (the actual bug case — was silently mislabeled as staging)', () => {
    assert.equal(buildAlertSubject(base, undefined), base);
  });

  it('does NOT prefix [STAGING] for any other arbitrary nodeEnv value', () => {
    assert.equal(buildAlertSubject(base, 'development'), base);
    assert.equal(buildAlertSubject(base, 'test'), base);
    assert.equal(buildAlertSubject(base, ''), base);
  });
});
