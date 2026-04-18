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
      console.warn(
        `[retryWithBackoff] Attempt ${attempt + 1} failed: ${err.message}. ` +
        `Retrying in ${Math.round(actualDelay)}ms...`
      );
      await new Promise(resolve => setTimeout(resolve, actualDelay));
      delayMs = Math.min(delayMs * factor, maxDelayMs);
    }
  }
}

// Twilio retry config — ready to apply when SMS is implemented in server/routes/account.js.
// Usage:
//   retries: 2, initialDelayMs: 1000
//   shouldRetry: (error) => {
//     const code = error?.code;
//     if (!code) return true;                        // network error — always retry
//     if (String(code).startsWith('2')) return true; // 2xxxx = connectivity/availability — retry
//     return false;                                  // 4xxxx = bad number/config — do not retry
//   }

module.exports = { retryWithBackoff };
