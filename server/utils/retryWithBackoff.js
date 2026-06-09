async function retryWithBackoff(fn, options = {}) {
  const {
    retries = 3,
    initialDelayMs = 500,
    maxDelayMs = 8000,
    factor = 2,
    shouldRetry = () => true,
  } = options;

  let delayMs = initialDelayMs;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries || !shouldRetry(err)) throw err;
      const jitter = delayMs * 0.2 * (Math.random() * 2 - 1); // ±20%
      const actualDelay = Math.min(Math.max(0, delayMs + jitter), maxDelayMs);
      console.warn( // diagnostic log — intentional
        `[retryWithBackoff] Attempt ${attempt + 1} failed: ${err.message}. ` +
        `Retrying in ${Math.round(actualDelay)}ms...`
      );
      await new Promise(resolve => setTimeout(resolve, actualDelay));
      delayMs = Math.min(delayMs * factor, maxDelayMs);
    }
  }
}

module.exports = { retryWithBackoff };
