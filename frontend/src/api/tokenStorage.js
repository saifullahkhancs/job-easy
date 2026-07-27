// Centralized token storage that supports per-tab isolation.
//
// Why sessionStorage? localStorage is shared across all tabs of the same origin.
// If you log in as admin in tab A and as customer in tab B, the second login
// overwrites localStorage and tab A suddenly sees the customer token, causing
// it to appear logged out / role-switched. Using sessionStorage gives each tab
// its own independent session, so two tabs can hold two different accounts.
//
// Backward compatibility: if a token only exists in localStorage (old version),
// we migrate it into sessionStorage on first read.

const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";

function safeGet(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage, key, value) {
  try {
    storage.setItem(key, value);
  } catch {
    // quota or disabled storage – ignore
  }
}

function safeRemove(storage, key) {
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
}

export function getAccessToken() {
  // Preferred: per-tab sessionStorage
  let token = safeGet(sessionStorage, ACCESS_KEY);
  if (token) return token;

  // Fallback: old localStorage token – migrate it to sessionStorage
  token = safeGet(localStorage, ACCESS_KEY);
  if (token) {
    safeSet(sessionStorage, ACCESS_KEY, token);
    // Do NOT delete localStorage immediately here – let set/clear handle it,
    // but we keep the migration so the current tab gets isolated.
  }
  return token;
}

export function getRefreshToken() {
  let token = safeGet(sessionStorage, REFRESH_KEY);
  if (token) return token;

  token = safeGet(localStorage, REFRESH_KEY);
  if (token) {
    safeSet(sessionStorage, REFRESH_KEY, token);
  }
  return token;
}

export function setTokens({ access_token, refresh_token }) {
  // Store only in sessionStorage for true tab isolation.
  // Clear from localStorage to prevent the old shared-token overwrite bug.
  if (access_token) {
    safeSet(sessionStorage, ACCESS_KEY, access_token);
    safeRemove(localStorage, ACCESS_KEY);
  }
  if (refresh_token) {
    safeSet(sessionStorage, REFRESH_KEY, refresh_token);
    safeRemove(localStorage, REFRESH_KEY);
  }
}

export function setAccessToken(token) {
  if (token) {
    safeSet(sessionStorage, ACCESS_KEY, token);
    safeRemove(localStorage, ACCESS_KEY);
  }
}

export function setRefreshToken(token) {
  if (token) {
    safeSet(sessionStorage, REFRESH_KEY, token);
    safeRemove(localStorage, REFRESH_KEY);
  }
}

export function clearTokens() {
  safeRemove(sessionStorage, ACCESS_KEY);
  safeRemove(sessionStorage, REFRESH_KEY);
  safeRemove(localStorage, ACCESS_KEY);
  safeRemove(localStorage, REFRESH_KEY);
}

// Legacy helpers – direct localStorage checks should be avoided, but we
// expose these for components that explicitly want to know if ANY token exists
// in either storage (e.g. initial redirect logic).
export function hasAnyToken() {
  return Boolean(getAccessToken());
}
