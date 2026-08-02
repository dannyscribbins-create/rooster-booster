'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// BACKBLAZE B2 MEDIA CLIENT — shared by every route that stores a public asset.
//
// Extracted from server/routes/admin/campaigns.js in C/DL-2 Phase 3b, when the
// logo-upload endpoint became the second caller. Duplicate logic across two
// files is a Code Cleanliness violation, and this particular duplicate would
// have been the expensive kind: the credential names, the endpoint, the region
// and the public-URL base all have to agree between callers or objects land in
// one bucket and are served from another.
//
// The `media` credentials (B2_MEDIA_*) are a different key pair from the backup
// credentials (B2_*) used by utils/backup.js — that separation is deliberate and
// is not changed here.
// ─────────────────────────────────────────────────────────────────────────────

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { retryWithBackoff } = require('./retryWithBackoff');
const { s3ShouldRetry } = require('./retryHelpers');

// Lazy initializer — reads env vars at call time, not at module load, to avoid
// ERR_INVALID_URL on startup when B2_ENDPOINT is not configured.
let _mediaS3Client = null;
function getMediaS3Client() {
  if (!_mediaS3Client) {
    const endpoint = process.env.B2_ENDPOINT;
    if (!endpoint) throw new Error('B2_ENDPOINT is not set');
    _mediaS3Client = new S3Client({
      endpoint,
      credentials: {
        accessKeyId: process.env.B2_MEDIA_KEY_ID,
        secretAccessKey: process.env.B2_MEDIA_APPLICATION_KEY,
      },
      region: 'us-east-005',
      forcePathStyle: true,
    });
  }
  return _mediaS3Client;
}

// The base URL uploaded objects are served from. One expression, two callers, so
// the CSP that must permit these images can never disagree with the URLs actually
// written into contractor_settings.logo_url.
function b2PublicBase() {
  return process.env.B2_PUBLIC_URL_BASE
    || `https://f005.backblazeb2.com/file/${process.env.B2_MEDIA_BUCKET_NAME}`;
}

// Builds the public https URL an uploaded object will be served from.
function buildB2PublicUrl(b2Key) {
  return `${b2PublicBase()}/${b2Key}`;
}

// The ORIGIN (scheme + host + port) of that base — the form a CSP source list
// wants. Added in C/DL-2 Phase 3d-1 for the landing router's img-src, which must
// permit contractor logos without widening the global policy.
//
// FALLS BACK TO null RATHER THAN THROWING on an unparseable base. A malformed
// B2_PUBLIC_URL_BASE is a misconfiguration, but a throw here happens at CSP
// construction time on a public page — trading a missing logo for a dead landing
// page. The caller omits the source and the page still renders.
function b2PublicOrigin() {
  try {
    return new URL(b2PublicBase()).origin;
  } catch {
    return null;
  }
}

// True when the media credentials are configured. Callers check this and answer
// with a clean error rather than letting the SDK throw a credentials fault deep
// inside a request.
function hasMediaCredentials() {
  return Boolean(process.env.B2_MEDIA_KEY_ID && process.env.B2_MEDIA_APPLICATION_KEY);
}

/**
 * Stores one object in the media bucket, with retry.
 *
 * THE RETRY IS THE POINT OF THIS FUNCTION EXISTING. campaigns.js's inline
 * s3.send() has no retryWithBackoff around it (campaigns.js, upload-image
 * handler) — the one external-API call in this codebase that does not. Every
 * Jobber, Resend, Twilio, Stripe and Anthropic call is wrapped; a bare send()
 * turns one dropped connection into a failed upload the admin has to notice and
 * repeat. New callers go through here so they do not inherit that gap.
 *
 * @param {{key: string, body: Buffer, contentType: string, contentLength: number}} opts
 * @returns {Promise<void>} resolves when the object is stored; throws otherwise.
 */
async function putMediaObject({ key, body, contentType, contentLength }) {
  const s3 = getMediaS3Client();
  await retryWithBackoff(
    () => s3.send(new PutObjectCommand({
      Bucket: process.env.B2_MEDIA_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: contentLength,
    })),
    { shouldRetry: s3ShouldRetry }
  );
}

module.exports = { getMediaS3Client, buildB2PublicUrl, b2PublicOrigin, hasMediaCredentials, putMediaObject };
