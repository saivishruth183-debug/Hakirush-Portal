import React, { useEffect, useState } from "react";
import { motion as Motion, AnimatePresence, useAnimationControls } from "framer-motion";
import axios from "axios";
import { useAuth } from "../context/authContext";
import { useNavigate } from "react-router-dom";
import { apiErrorCode, isNetworkError } from "../utils/apiError";
import {
  Eye, EyeOff, Lock, Mail, Loader2, AlertCircle, Info, WifiOff, ArrowRight,
  ShieldCheck, CalendarCheck, Users, Trophy, CheckCircle2,
} from "lucide-react";

const PAGE_BG = "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";

const HIGHLIGHTS = [
  { icon: Users, title: "One portal, every role", text: "Admins, employees and clients each get their own dashboard." },
  { icon: CalendarCheck, title: "Attendance & leaves", text: "Mark, request and approve in a couple of taps." },
  { icon: Trophy, title: "Events & standings", text: "Follow tournaments, teams and announcements live." },
];

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [capsOn, setCapsOn] = useState(false);
  const [success, setSuccess] = useState(false);
  const [slide, setSlide] = useState(0);
  const shake = useAnimationControls();

  const { login, sessionError, offline } = useAuth();
  const navigate = useNavigate();

  // rotate the highlights on the brand panel
  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % HIGHLIGHTS.length), 4500);
    return () => clearInterval(t);
  }, []);

  const loginErrorMessage = (error) => {
    if (isNetworkError(error)) {
      return "Can't reach the server. Check your connection and try again.";
    }
    const code = apiErrorCode(error);
    const serverMessage = error.response?.data?.error || error.response?.data?.message;
    if (code === "INVALID_CREDENTIALS") return serverMessage || "Invalid email or password.";
    if (code === "ACCOUNT_INACTIVE") return serverMessage || "This account is inactive. Contact your administrator.";
    if (code === "RATE_LIMITED" || error.response?.status === 429) {
      return serverMessage || "Too many attempts. Please wait a moment and try again.";
    }
    if (error.response?.status >= 500) {
      return serverMessage || "The server is having trouble. Please try again shortly.";
    }
    return serverMessage || "Access Denied: Invalid Credentials";
  };

  const fail = (message) => {
    setErr(message);
    shake.start({ x: [0, -10, 10, -6, 6, 0], transition: { duration: 0.45 } });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setErr("");
    setLoading(true);

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/api/auth/login`,
        { email, password },
        { timeout: 20000 }
      );

      if (response.data?.success && response.data.token && response.data.user) {
        // Directing to appropriate dashboard based on role
        const role = response.data.user.role;
        const target =
          role === "admin" ? "/admin-dashboard"
          : role === "client" ? "/client-dashboard"
          : role === "employee" ? "/employee-dashboard"
          : null;

        if (!target) {
          fail("This account has no portal access.");
          return;
        }
        login(response.data.user, response.data.token);
        setSuccess(true);
        // brief success state, then go
        setTimeout(() => navigate(target), 550);
      } else {
        fail(response.data?.error || "Login failed. Please try again.");
      }
    } catch (error) {
      fail(loginErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const onPasswordKey = (e) => {
    if (typeof e.getModifierState === "function") setCapsOn(e.getModifierState("CapsLock"));
  };

  // Message carried over from a session that ended (revoked / inactive).
  const notice = !err && !offline ? sessionError : null;
  const busy = loading || success;
  const Highlight = HIGHLIGHTS[slide];

  return (
    <div className={`relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 font-sans ${PAGE_BG}`}>
      {/* ambient blobs */}
      <Motion.div
        aria-hidden
        animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-red-300/30 blur-[110px]"
      />
      <Motion.div
        aria-hidden
        animate={{ x: [0, -30, 0], y: [0, 20, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -bottom-32 -right-32 h-[420px] w-[420px] rounded-full bg-rose-300/25 blur-[110px]"
      />

      <Motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-[2.25rem] bg-white shadow-[0_40px_100px_-30px_rgba(127,29,29,0.45)] ring-1 ring-red-100 md:grid-cols-2"
      >
        {/* ================= BRAND PANEL ================= */}
        <div className="relative hidden flex-col justify-between gap-10 overflow-hidden bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 p-10 text-white md:flex lg:p-12">
          {/* soft dot pattern */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
          />
          <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/15 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-orange-300/30 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-16 -right-16 h-64 w-64 rounded-full border-[28px] border-white/10" />

          {/* hero */}
          <div className="relative">
            {/* logo + name: the logo floats inside its own fixed-height slot, so it never touches the text */}
            <div className="mb-8 flex items-center gap-5">
              <div className="flex h-32 w-32 shrink-0 items-center justify-center lg:h-36 lg:w-36">
                <Motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
                  className="rounded-[2rem] bg-white/15 p-4 ring-1 ring-white/25 backdrop-blur-md"
                >
                  <img src="/favicon.png" alt="Hakirush" className="h-20 w-20 object-contain drop-shadow-xl lg:h-24 lg:w-24" />
                </Motion.div>
              </div>
              <div className="leading-tight">
                <p className="text-3xl font-extrabold tracking-tight">Hakirush</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/75">Portal</p>
              </div>
            </div>

            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight lg:text-5xl">
              Everything your<br />team needs, <span className="text-orange-200">in one place.</span>
            </h1>

            {/* rotating highlight */}
            <div className="mt-8 h-[76px]">
              <AnimatePresence mode="wait">
                <Motion.div
                  key={slide}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.35 }}
                  className="flex items-start gap-3 rounded-2xl bg-white/10 p-4 ring-1 ring-white/20 backdrop-blur"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-red-600 shadow-md">
                    <Highlight.icon size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-bold">{Highlight.title}</p>
                    <p className="text-xs text-white/80">{Highlight.text}</p>
                  </div>
                </Motion.div>
              </AnimatePresence>
            </div>
            <div className="mt-4 flex gap-1.5">
              {HIGHLIGHTS.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSlide(i)}
                  aria-label={`Show highlight ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${i === slide ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"}`}
                />
              ))}
            </div>
          </div>

          <p className="relative text-xs text-white/70">© {new Date().getFullYear()} Hakirush. All rights reserved.</p>
        </div>

        {/* ================= FORM PANEL ================= */}
        <div className="relative flex flex-col justify-center p-7 sm:p-12">
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-red-600 via-rose-500 to-orange-400 md:hidden" />

          {/* mobile brand */}
          <div className="mb-8 flex items-center gap-3 md:hidden">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 shadow-lg shadow-red-600/30">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white">
                <img src="/favicon.png" alt="" className="h-6 w-6 object-contain" />
              </span>
            </span>
            <p className="text-xl font-extrabold tracking-tight text-gray-900">
              Haki<span className="text-red-600">rush</span>
            </p>
          </div>

          <div className="mb-8">
            <p className="text-sm font-semibold text-red-600">{greeting()} 👋</p>
            <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-gray-900">Sign in to your portal</h2>
            <p className="mt-1.5 text-sm text-gray-500">Use the email and password your administrator gave you.</p>
          </div>

          {/* banners */}
          <div className="space-y-3">
            <AnimatePresence>
              {offline && (
                <Motion.div
                  key="offline"
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mb-3 flex items-center gap-3 rounded-2xl bg-amber-50 p-4 text-amber-800 ring-1 ring-amber-200">
                    <WifiOff size={18} className="shrink-0 text-amber-600" />
                    <p className="text-sm font-medium">You're offline. Reconnect to sign in.</p>
                  </div>
                </Motion.div>
              )}
              {err && (
                <Motion.div
                  key="err"
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                  role="alert"
                >
                  <div className="mb-3 flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-red-700 ring-1 ring-red-100">
                    <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" />
                    <p className="text-sm font-medium">{err}</p>
                  </div>
                </Motion.div>
              )}
              {notice && (
                <Motion.div
                  key="notice"
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mb-3 flex items-start gap-3 rounded-2xl bg-sky-50 p-4 text-sky-900 ring-1 ring-sky-100">
                    <Info size={18} className="mt-0.5 shrink-0 text-sky-600" />
                    <p className="text-sm font-medium">{notice}</p>
                  </div>
                </Motion.div>
              )}
            </AnimatePresence>
          </div>

          <Motion.form animate={shake} onSubmit={handleSubmit} className="space-y-5" noValidate={false}>
            {/* email */}
            <div className="space-y-2">
              <label htmlFor="login-email" className="text-sm font-bold text-gray-900">Email address</label>
              <div className="group relative">
                <Mail size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 transition group-focus-within:text-red-500" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (err) setErr(""); }}
                  placeholder="you@hakirush.com"
                  autoComplete="email"
                  autoFocus
                  required
                  disabled={busy}
                  className="w-full rounded-2xl bg-gray-50 py-3.5 pl-12 pr-4 text-[15px] font-medium text-gray-900 ring-1 ring-gray-200 transition placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-300 disabled:opacity-70"
                />
              </div>
            </div>

            {/* password */}
            <div className="space-y-2">
              <label htmlFor="login-password" className="text-sm font-bold text-gray-900">Password</label>
              <div className="group relative">
                <Lock size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 transition group-focus-within:text-red-500" />
                <input
                  id="login-password"
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (err) setErr(""); }}
                  onKeyDown={onPasswordKey}
                  onKeyUp={onPasswordKey}
                  onBlur={() => setCapsOn(false)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  disabled={busy}
                  className="w-full rounded-2xl bg-gray-50 py-3.5 pl-12 pr-12 text-[15px] font-medium text-gray-900 ring-1 ring-gray-200 transition placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-300 disabled:opacity-70"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  aria-label={showPass ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <AnimatePresence>
                {capsOn && (
                  <Motion.p
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex items-center gap-1.5 text-xs font-semibold text-amber-600"
                  >
                    <AlertCircle size={13} /> Caps Lock is on
                  </Motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* submit */}
            <Motion.button
              type="submit"
              disabled={busy || offline}
              whileHover={!busy && !offline ? { y: -2 } : undefined}
              whileTap={!busy && !offline ? { scale: 0.98 } : undefined}
              className={`group flex w-full items-center justify-center gap-2.5 rounded-2xl py-4 text-sm font-bold text-white shadow-lg transition disabled:cursor-not-allowed ${
                success
                  ? "bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-500/30"
                  : "bg-gradient-to-r from-red-600 to-rose-500 shadow-red-600/30 hover:shadow-xl disabled:opacity-70"
              }`}
            >
              {success ? (
                <><CheckCircle2 size={18} /> Signed in — taking you there…</>
              ) : loading ? (
                <><Loader2 size={18} className="animate-spin" /> Signing in…</>
              ) : (
                <>Sign in <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" /></>
              )}
            </Motion.button>
          </Motion.form>

          <p className="mt-6 text-center text-xs text-gray-400">
            Forgot your password or locked out? Contact your administrator.
          </p>

          <div className="mt-8 flex items-center justify-center gap-2 border-t border-gray-100 pt-6 text-xs font-medium text-gray-400">
            <ShieldCheck size={14} className="text-emerald-500" />
            Secure sign-in
          </div>
        </div>
      </Motion.div>
    </div>
  );
};

export default Login;