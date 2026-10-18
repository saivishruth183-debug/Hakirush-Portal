// Shared helpers for reading the backend error envelope:
// { success: false, error: "<human message>", code: "<CODE>", details?: any }
// (see docs/mobile/API_CONTRACT.md). Older responses may still use `message`.

export const apiErrorCode = (err) => err?.response?.data?.code || null;

export const apiErrorStatus = (err) => err?.response?.status || null;

// True when the request never got an HTTP response (offline, DNS, CORS, timeout).
export const isNetworkError = (err) =>
  Boolean(err) && !err.response && (Boolean(err.request) || err.code === "ECONNABORTED" || err.code === "ERR_NETWORK");

export const apiErrorMessage = (err, fallback = "Something went wrong. Please try again.") => {
  if (isNetworkError(err)) {
    return "Can't reach the server. Check your connection and try again.";
  }
  const data = err?.response?.data;
  if (data && typeof data === "object") {
    if (typeof data.error === "string" && data.error) return data.error;
    if (typeof data.message === "string" && data.message) return data.message;
  }
  if (apiErrorStatus(err) === 403) {
    return "You don't have permission to do that.";
  }
  return fallback;
};

// Codes that mean the stored web session is no longer valid (sign out).
export const SESSION_ENDING_CODES = new Set([
  "SESSION_REVOKED",
  "TOKEN_EXPIRED",
  "TOKEN_INVALID",
  "ACCOUNT_INACTIVE",
]);

// Confirmed auth failure for the /auth/verify bootstrap call:
// any 401, or 403 ACCOUNT_INACTIVE. Everything else (network, timeout, 5xx,
// 503 AUTH_UNAVAILABLE) keeps the saved session.
export const isConfirmedAuthFailure = (err) => {
  const status = apiErrorStatus(err);
  if (status === 401) return true;
  if (status === 403 && apiErrorCode(err) === "ACCOUNT_INACTIVE") return true;
  return false;
};

export const authHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};
