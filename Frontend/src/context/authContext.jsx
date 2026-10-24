import axios from "axios";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from "react";
import {
  apiErrorCode,
  apiErrorStatus,
  isConfirmedAuthFailure,
  SESSION_ENDING_CODES
} from "../utils/apiError";

const UserContext = createContext();

// Web keeps its bearer token in localStorage (mobile uses its own secure store).
const TOKEN_KEY = "token";
// Non-sensitive snapshot of the last verified user so a network outage or a
// 5xx during /auth/verify does not sign the user out.
const SNAPSHOT_KEY = "hakirush_user_snapshot";
const SNAPSHOT_FIELDS = [
  "_id",
  "name",
  "role",
  "profileImage",
  "isActive",
  "employeeId",
  "designation",
  "gender",
  "employeeRecordId",
  "departmentId",
  "departmentName",
  "clientId",
  "clientCode"
];

const BACKEND_BASE = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/+$/, "");

const isBackendUrl = (url) =>
  Boolean(BACKEND_BASE) && typeof url === "string" && url.startsWith(`${BACKEND_BASE}/`);

const readSnapshot = () => {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed._id && parsed.role ? parsed : null;
  } catch {
    return null;
  }
};

const writeSnapshot = (user) => {
  try {
    if (!user) {
      localStorage.removeItem(SNAPSHOT_KEY);
      return;
    }
    const snapshot = {};
    SNAPSHOT_FIELDS.forEach((key) => {
      if (user[key] !== undefined) snapshot[key] = user[key];
    });
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // storage unavailable (private mode / quota) - snapshot is best effort
  }
};

const clearStoredSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  writeSnapshot(null);
};

const readHeader = (headers, name) => {
  if (!headers) return undefined;
  if (typeof headers.get === "function") return headers.get(name);
  return headers[name] ?? headers[name.toLowerCase()];
};

const sessionEndMessage = (code) =>
  code === "ACCOUNT_INACTIVE"
    ? "Your account is inactive. Contact your administrator."
    : "Your session has ended. Please sign in again.";

const AuthProvider = ({ children }) => {
  // ================= STATE =================
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // offline: the token is kept but could not be verified (network / timeout / 5xx)
  const [offline, setOffline] = useState(false);
  // sessionError: human message for the last session problem (offline or signed out)
  const [sessionError, setSessionError] = useState(null);

  // ================= SESSION END (confirmed auth failure) =================
  const endSession = useCallback((message) => {
    clearStoredSession();
    setUser(null);
    setOffline(false);
    setSessionError(message || null);
  }, []);

  // ================= VERIFY USER =================
  const verifySession = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);

    // ---------- NO TOKEN ----------
    if (!token) {
      writeSnapshot(null);
      setUser(null);
      setOffline(false);
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(
        `${BACKEND_BASE}/api/auth/verify`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 15000
        }
      );

      if (response.data?.success && response.data.user) {
        writeSnapshot(response.data.user);
        setUser(response.data.user);
        setOffline(false);
        setSessionError(null);
      } else {
        endSession("Your session has ended. Please sign in again.");
      }
    } catch (error) {
      if (isConfirmedAuthFailure(error)) {
        // 401 (any code) or 403 ACCOUNT_INACTIVE -> sign out & clear
        endSession(sessionEndMessage(apiErrorCode(error)));
      } else {
        // network error, timeout, 5xx, AUTH_UNAVAILABLE -> keep the token
        const status = apiErrorStatus(error);
        setUser((current) => current || readSnapshot());
        setOffline(true);
        setSessionError(
          status
            ? "The server is having trouble right now. Showing your last known session."
            : "Can't reach the server. Showing your last known session."
        );
      }
    } finally {
      setLoading(false);
    }
  }, [endSession]);

  useEffect(() => {
    verifySession();
  }, [verifySession]);

  // Re-verify when the browser comes back online while we are unverified.
  useEffect(() => {
    if (!offline) return undefined;
    const onOnline = () => verifySession();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [offline, verifySession]);

  // ================= AXIOS INTERCEPTORS =================
  useEffect(() => {
    // Attach the bearer token to backend requests that forgot it
    // (never to third-party hosts, never in URLs).
    const requestId = axios.interceptors.request.use((config) => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (
        token &&
        isBackendUrl(config.url) &&
        !String(config.url).includes("/api/auth/login") &&
        !readHeader(config.headers, "Authorization")
      ) {
        if (config.headers && typeof config.headers.set === "function") {
          config.headers.set("Authorization", `Bearer ${token}`);
        } else {
          config.headers = { ...(config.headers || {}), Authorization: `Bearer ${token}` };
        }
      }
      return config;
    });

    // Any later SESSION_REVOKED / TOKEN_EXPIRED / TOKEN_INVALID (401) or
    // ACCOUNT_INACTIVE (403) on an authenticated backend call signs out.
    const responseId = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const config = error?.config;
        const status = apiErrorStatus(error);
        const code = apiErrorCode(error);
        if (
          config &&
          isBackendUrl(config.url) &&
          !String(config.url).includes("/api/auth/") &&
          (status === 401 || status === 403) &&
          SESSION_ENDING_CODES.has(code)
        ) {
          const sentAuth = readHeader(config.headers, "Authorization");
          const currentToken = localStorage.getItem(TOKEN_KEY);
          // Ignore late responses from a previous session's token.
          if (currentToken && sentAuth === `Bearer ${currentToken}`) {
            endSession(sessionEndMessage(code));
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(requestId);
      axios.interceptors.response.eject(responseId);
    };
  }, [endSession]);

  const login = useCallback((userData, token) => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    }
    writeSnapshot(userData);
    setUser(userData);
    setOffline(false);
    setSessionError(null);
  }, []);

  // logout(message?) - optional notice shown on the login page afterwards.
  // (Guarded because some callers pass a click event: onClick={logout}.)
  const logout = useCallback((message) => {
    clearStoredSession();
    setUser(null);
    setOffline(false);
    setSessionError(typeof message === "string" ? message : null);
  }, []);

  return (
    <UserContext.Provider
      value={{ user, login, logout, loading, offline, sessionError, retryVerify: verifySession }}
    >
      {offline && user && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 rounded-full bg-[#1C1A17] text-[#F6F3EC] px-5 py-2.5 shadow-xl text-[12px] font-semibold"
        >
          <span>{sessionError || "Offline - session not verified."}</span>
          <button
            type="button"
            onClick={verifySession}
            className="rounded-full bg-[#B8912E] text-[#1C1A17] px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
          >
            Retry
          </button>
        </div>
      )}
      {children}
    </UserContext.Provider>
  );
};

export const useAuth = () => useContext(UserContext);

export default AuthProvider;
