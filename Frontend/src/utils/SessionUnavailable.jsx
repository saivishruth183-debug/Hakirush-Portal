import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { WifiOff, RefreshCw, LogOut, ShieldCheck, Loader2 } from "lucide-react";
import Logo from "/favicon.png";
import { useAuth } from "../context/authContext";

const PAGE_BG =
  "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";

/* ---------- full-page loader, shared by the route guards ---------- */
// Waits a moment before showing, so fast checks don't flash a loader.
export const SessionLoader = ({ label = "Loading your workspace…" }) => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 250);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`flex min-h-screen items-center justify-center px-4 ${PAGE_BG}`} role="status" aria-live="polite">
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center text-center"
        >
          <div className="relative flex h-20 w-20 items-center justify-center">
            <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-red-100 border-t-red-600 [animation-duration:900ms]" />
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 shadow-lg shadow-red-600/30">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white">
                <img src={Logo} alt="Hakirush" className="h-5 w-5 object-contain" />
              </span>
            </span>
          </div>
          <p className="mt-5 text-lg font-extrabold tracking-tight text-gray-900">
            Haki<span className="text-red-600">rush</span>
          </p>
          <p className="mt-1 text-sm text-gray-500">{label}</p>
        </motion.div>
      )}
    </div>
  );
};

// Shown when a saved token exists but could not be verified (network / 5xx)
// and no cached user snapshot is available. The token is kept.
const SessionUnavailable = () => {
  const { sessionError, retryVerify, logout } = useAuth();
  const [retrying, setRetrying] = useState(false);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);

  const handleRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await Promise.resolve(retryVerify?.());
    } finally {
      setRetrying(false);
    }
  };

  // retry automatically when the device reconnects
  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      handleRetry();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`flex min-h-screen items-center justify-center px-4 py-10 font-sans ${PAGE_BG}`}>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white/90 shadow-[0_10px_40px_-12px_rgba(127,29,29,0.25)] ring-1 ring-white/70 backdrop-blur"
      >
        <div className="h-1.5 bg-gradient-to-r from-red-600 via-rose-500 to-orange-400" />

        <div className="p-7 text-center sm:p-8">
          {/* brand */}
          <div className="mb-6 flex items-center justify-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-rose-500 shadow-md shadow-red-600/25">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white">
                <img src={Logo} alt="" className="h-4 w-4 object-contain" />
              </span>
            </span>
            <span className="text-base font-extrabold tracking-tight text-gray-900">
              Haki<span className="text-red-600">rush</span>
            </span>
          </div>

          {/* icon */}
          <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-3xl bg-red-200/50 [animation-duration:2.2s]" />
            <span className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-red-50 text-red-600 ring-1 ring-red-100">
              <WifiOff size={34} strokeWidth={1.8} />
            </span>
          </div>

          <h1 className="text-xl font-extrabold tracking-tight text-gray-900 sm:text-2xl">Can't verify your session</h1>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-gray-500">
            {sessionError || "The server could not be reached."}
          </p>

          {/* status chips */}
          <div className="mt-5 grid gap-2 text-left sm:grid-cols-2">
            <div className="flex items-center gap-2.5 rounded-2xl bg-emerald-50 px-3 py-2.5 ring-1 ring-emerald-100">
              <ShieldCheck size={18} className="shrink-0 text-emerald-600" />
              <div className="min-w-0 leading-tight">
                <p className="text-xs font-bold text-emerald-800">Still signed in</p>
                <p className="text-[11px] text-emerald-700/80">on this device</p>
              </div>
            </div>
            <div className={`flex items-center gap-2.5 rounded-2xl px-3 py-2.5 ring-1 ${online ? "bg-amber-50 ring-amber-100" : "bg-red-50 ring-red-100"}`}>
              <span className="relative flex h-2.5 w-2.5 shrink-0 mx-1">
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${online ? "bg-amber-400" : "bg-red-400"}`} />
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${online ? "bg-amber-500" : "bg-red-500"}`} />
              </span>
              <div className="min-w-0 leading-tight">
                <p className={`text-xs font-bold ${online ? "text-amber-800" : "text-red-800"}`}>{online ? "Server not responding" : "You're offline"}</p>
                <p className={`text-[11px] ${online ? "text-amber-700/80" : "text-red-700/80"}`}>{online ? "try again shortly" : "we'll retry when back"}</p>
              </div>
            </div>
          </div>

          {/* actions */}
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleRetry}
              disabled={retrying}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-wait disabled:opacity-80"
            >
              {retrying ? <Loader2 size={17} className="animate-spin" /> : <RefreshCw size={17} />}
              {retrying ? "Checking…" : "Retry"}
            </button>
            <button
              type="button"
              onClick={logout}
              disabled={retrying}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-bold text-gray-600 ring-1 ring-gray-200 transition hover:bg-red-50 hover:text-red-700 hover:ring-red-200 disabled:opacity-60"
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SessionUnavailable;