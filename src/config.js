// Build-time configuration (Vite inlines import.meta.env at build).
//
//   VITE_SERVER_URL   Socket.IO server, e.g. https://eshiritori-api.azedlabs.com
//                     (no trailing slash). Required for production builds.
//   VITE_SOCKET_PATH  Optional. Socket.IO path on the server (default /socket.io).
//   VITE_BASE         Optional. Public base path of the app (default /), e.g.
//                     /eshiritori/ when served under a games hub. Read in vite.config.js.

const isLocalhost = (url) => /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(url);

const configured = (import.meta.env.VITE_SERVER_URL || '').trim();

// In dev we fall back to the local server. In production we never guess:
// a missing URL would otherwise point every player at their own machine.
export const SERVER_URL = (configured || (import.meta.env.DEV ? 'http://localhost:3001' : ''))
  .replace(/\/+$/, '');

export const SOCKET_PATH = (import.meta.env.VITE_SOCKET_PATH || '/socket.io').trim();

// Developer-facing description of what is wrong with the config (or null).
function findConfigProblem() {
  if (!SERVER_URL) {
    return 'VITE_SERVER_URL is not set for this build, so online play is disabled.';
  }
  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    SERVER_URL.startsWith('http:') &&
    !isLocalhost(SERVER_URL)
  ) {
    return `VITE_SERVER_URL (${SERVER_URL}) is http but this page is https; browsers block it. Use https.`;
  }
  return null;
}

export const CONFIG_PROBLEM = findConfigProblem();
