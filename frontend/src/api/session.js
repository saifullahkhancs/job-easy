import { clearTokens, getAccessToken } from "./tokenStorage";

export const SESSION_EXPIRED_EVENT = "job-easy:session-expired";

const DEFAULT_SESSION_EXPIRED_MESSAGE =
  "Your session has expired. Please log in again to continue.";

// These 401s are expected form/API validation failures, not expired browser sessions.
const INLINE_AUTH_401_PATHS = new Set([
  "/api/v1/auth/login",
  "/api/v1/auth/refresh",
  "/api/v1/auth/reset-password",
  "/api/v1/auth/forgot-password",
  "/api/v1/auth/resend-password-reset",
  "/api/v1/auth/register",
  "/api/v1/auth/verify-email",
  "/api/v1/auth/resend-verification",
]);

let sessionExpiredRaised = false;

function responsePath(response) {
  try {
    return new URL(response.url, window.location.origin).pathname;
  } catch {
    return "";
  }
}

export function clearStoredSession() {
  clearTokens();
}

export function resetSessionExpiredState() {
  sessionExpiredRaised = false;
}

export function acknowledgeSessionExpired() {
  sessionExpiredRaised = false;
}

export function notifySessionExpired(message = DEFAULT_SESSION_EXPIRED_MESSAGE) {
  if (sessionExpiredRaised) {
    return false;
  }

  sessionExpiredRaised = true;
  clearStoredSession();
  window.dispatchEvent(
    new CustomEvent(SESSION_EXPIRED_EVENT, {
      detail: { message },
    })
  );
  return true;
}

export function shouldNotifySessionExpired(response) {
  if (response.status !== 401) {
    return false;
  }

  const token = getAccessToken();
  if (!token) {
    return false;
  }

  const path = responsePath(response);
  return !INLINE_AUTH_401_PATHS.has(path);
}

export function maybeNotifySessionExpired(response, data = {}) {
  if (!shouldNotifySessionExpired(response)) {
    return false;
  }

  const detail = typeof data.detail === "string" ? data.detail : "";
  const message = detail && detail !== "Could not validate credentials"
    ? detail
    : DEFAULT_SESSION_EXPIRED_MESSAGE;

  return notifySessionExpired(message);
}

export function subscribeSessionExpired(handler) {
  const listener = (event) => handler(event.detail || {});
  window.addEventListener(SESSION_EXPIRED_EVENT, listener);
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
}
