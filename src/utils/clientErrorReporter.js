import { BACKEND_URL } from '../config/contractor'
import { getAdminToken, getReferrerToken, getControlToken } from './authStorage'

const recentlyReported = new Set()

const getKey = (error, context) => {
  const msg = error?.message || String(error)
  return `${context || 'unknown'}:${msg.substring(0, 100)}`
}

/**
 * Whichever stored session token this browser holds, or null.
 *
 * ⚠ IT SENDS A TOKEN SO THE SERVER CAN FILE THE ROW UNDER THE RIGHT TENANT, AND NOTHING MORE. The
 * endpoint stays unauthenticated — a crashed app must still be able to report — so the token is an
 * optional hint, never a requirement. Without it every frontend error in the log lands under a
 * hardcoded phantom contractor id.
 *
 * ⚠ THE ORDER IS FIXED AND ARBITRARY-BY-NECESSITY, WHICH IS WORTH SAYING. A browser can hold more
 * than one of these at once (an admin who has also logged in as a referrer), and a crashing client
 * does not know which surface it was on — that is the same problem `verifyAnySession` was written
 * for. Any of them resolves to a real session's contractor, which is the question being asked, so
 * first-found is sufficient; it is not a claim about which surface crashed.
 *
 * ⚠ AND IT IS WRAPPED, BECAUSE READING STORAGE CAN THROW. `authStorage` reads `localStorage`, which
 * throws in a private window or with site data blocked. This runs on the crash path, so a throw here
 * would replace a reported crash with an unreported one.
 */
const sessionTokenHint = () => {
  try {
    return getAdminToken() || getReferrerToken() || getControlToken() || null
  } catch {
    return null
  }
}

/**
 * Report a client-side error.
 * `options.fatal` — this error took a whole surface down (an error-boundary catch). The server
 * classifies a fatal report CRITICAL for triage regardless of route; it does NOT change alert
 * cadence, which already fires on first occurrence and every 10th for every severity.
 * `options.componentStack` — React's component stack, kept rather than smuggled through `context`.
 */
export const reportClientError = async (
  error,
  context = 'unknown',
  { fatal = false, componentStack = null } = {}
) => {
  try {
    const key = getKey(error, context)

    // Throttle: don't report the same error from the same context more than once per 60 seconds
    if (recentlyReported.has(key)) return
    recentlyReported.add(key)
    setTimeout(() => recentlyReported.delete(key), 60000)

    const token = sessionTokenHint()

    await fetch(`${BACKEND_URL}/api/log-client-error`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        error_message: error?.message || String(error),
        stack_trace: error?.stack || null,
        route: window.location.pathname,
        component: context,
        // ⚠ STRICTLY BOOLEAN. The server reads `fatal === true`, so a truthy-but-not-true value
        // would silently fail to promote the severity rather than loudly doing the wrong thing.
        fatal: fatal === true,
        component_stack: componentStack,
      })
    })
  } catch (err) {
    // Never throw from error reporter — silent fail only
    console.error('[clientErrorReporter] Failed to report error:', err)
  }
}

export const safeAsync = (fn, context = 'unknown') => async (...args) => {
  try {
    await fn(...args)
  } catch (err) {
    reportClientError(err, context)
  }
}
