const resendShouldRetry = (error) => {
  const status = error?.response?.status || error?.statusCode;
  if (!status) return true;
  if (status >= 500) return true;
  return false;
};

const twilioShouldRetry = (error) => {
  const code = error?.code;
  if (!code) return true;
  if (String(code).startsWith('2')) return true;
  return false;
};

const jobberShouldRetry = (error) => {
  const status = error?.response?.status ?? error?.status;
  if (!status) return true;
  if (status === 401) return false;
  if (status === 429) return true;
  if (status >= 500) return true;
  return false;
};

const stripeShouldRetry = (error) => {
  const status = error?.statusCode || error?.status;
  if (!status) return true;
  if (status === 429) return true;
  if (status >= 500) return true;
  return false;
};

const anthropicShouldRetry = (error) => {
  if (error?.status >= 400 && error?.status < 500) return false;
  return true;
};

// Backblaze B2 via the S3-compatible API (@aws-sdk/client-s3).
// The SDK reports HTTP status on error.$metadata.httpStatusCode; a transport
// failure (DNS, reset connection, timeout) carries no status at all, which is
// the most retry-worthy case there is — hence the true on no status, matching
// every other helper in this file.
// 403 is NOT retried: for B2 that is a bad application key or an expired
// authorization, and retrying it just delays the real error by four seconds.
const s3ShouldRetry = (error) => {
  const status = error?.$metadata?.httpStatusCode || error?.statusCode || error?.status;
  if (!status) return true;
  if (status === 429) return true;
  if (status >= 500) return true;
  return false;
};

module.exports = { resendShouldRetry, twilioShouldRetry, jobberShouldRetry, stripeShouldRetry, anthropicShouldRetry, s3ShouldRetry };
