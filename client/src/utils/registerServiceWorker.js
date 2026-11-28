/**
 * registerServiceWorker.js — Service Worker Registration Utility (Day 27 Task 54)
 *
 * Registers `/sw.js` safely in browser environments supporting Service Workers.
 * Skips execution during unit tests or unsupported environments.
 */

export async function registerServiceWorker({
  swPath = '/sw.js',
  navigatorObj = typeof navigator !== 'undefined' ? navigator : null,
  windowObj = typeof window !== 'undefined' ? window : null,
  isProd = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.PROD : false,
} = {}) {
  if (!navigatorObj || !('serviceWorker' in navigatorObj)) {
    return null;
  }

  // Avoid interfering with local Vite HMR in non-explicit dev runs unless supported
  if (!isProd && windowObj?.location?.hostname === 'localhost' && windowObj?.location?.port === '5173') {
    // Still allow explicit registration check on production builds/previews; skip noisy dev HMR override
    return null;
  }

  try {
    const registration = await navigatorObj.serviceWorker.register(swPath, { scope: '/' });
    return registration;
  } catch (err) {
    console.warn('[PWA] Service worker registration failed:', err?.message || err);
    return null;
  }
}
