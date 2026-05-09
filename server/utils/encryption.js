/*
 * AES-256-GCM encryption utility for sensitive PII fields.
 * Used for: stripe_bank_account_token, SSN (future Account Keeping session)
 * Key source: ENCRYPTION_KEY env var (Railway) — 64 hex chars (32 bytes)
 * NEVER log plaintext values, decrypted values, or the raw key anywhere.
 * NEVER expose these functions to any client-facing endpoint response.
 * Format: iv:authTag:ciphertext (all hex, colon-separated)
 */

'use strict';

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV — correct for GCM mode
const KEY_HEX = process.env.ENCRYPTION_KEY;

if (!KEY_HEX) {
  throw new Error(
    'ENCRYPTION_KEY environment variable is required. ' +
    'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
}

if (KEY_HEX.length !== 64) {
  throw new Error(
    'ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). ' +
    'Current length: ' + KEY_HEX.length
  );
}

const KEY = Buffer.from(KEY_HEX, 'hex');

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns iv:authTag:ciphertext (all hex, colon-separated).
 * Returns null if plaintext is null or undefined.
 */
function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) return null;
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    const encrypted = Buffer.concat([
      cipher.update(String(plaintext), 'utf8'),
      cipher.final()
    ]);
    const authTag = cipher.getAuthTag();
    return [
      iv.toString('hex'),
      authTag.toString('hex'),
      encrypted.toString('hex')
    ].join(':');
  } catch (err) {
    throw new Error('encrypt() failed: ' + err.message);
  }
}

/**
 * Decrypts a stored iv:authTag:ciphertext string.
 * Returns the original plaintext string.
 * Returns null if stored is null or undefined.
 */
function decrypt(stored) {
  if (stored === null || stored === undefined) return null;
  try {
    const parts = stored.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format — expected iv:authTag:ciphertext');
    }
    const [ivHex, authTagHex, ciphertextHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
    return decrypted.toString('utf8');
  } catch (err) {
    throw new Error('decrypt() failed: ' + err.message);
  }
}

module.exports = { encrypt, decrypt };
