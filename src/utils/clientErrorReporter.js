import { BACKEND_URL } from '../config/contractor'

const recentlyReported = new Set()

const getKey = (error, context) => {
  const msg = error?.message || String(error)
  return `${context || 'unknown'}:${msg.substring(0, 100)}`
}

export const reportClientError = async (error, context = 'unknown') => {
  try {
    const key = getKey(error, context)

    // Throttle: don't report the same error from the same context more than once per 60 seconds
    if (recentlyReported.has(key)) return
    recentlyReported.add(key)
    setTimeout(() => recentlyReported.delete(key), 60000)

    await fetch(`${BACKEND_URL}/api/log-client-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error_message: error?.message || String(error),
        stack_trace: error?.stack || null,
        route: window.location.pathname,
        component: context
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
