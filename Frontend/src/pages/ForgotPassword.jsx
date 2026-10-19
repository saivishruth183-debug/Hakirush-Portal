import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Lock, Mail,
} from "lucide-react";

const apiUrl = `${import.meta.env.VITE_BACKEND_URL}/api/auth`;

const ForgotPassword = () => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(Array(6).fill(""));
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const otpRefs = useRef([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!countdown) return undefined;
    const timer = window.setInterval(() => setCountdown((remaining) => Math.max(remaining - 1, 0)), 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  const messageFromError = (requestError) =>
    requestError.response?.data?.error || "We couldn't complete that request. Please try again.";

  const sendOtp = async (resend = false) => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      await axios.post(`${apiUrl}/forgot-password`, { email: email.trim() }, { timeout: 20000 });
      setOtp(Array(6).fill(""));
      setCountdown(60);
      if (!resend) setStep(2);
      else otpRefs.current[0]?.focus();
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (event) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await axios.post(
        `${apiUrl}/verify-otp`,
        { email: email.trim(), otp: otp.join("") },
        { timeout: 20000 }
      );
      if (!response.data?.resetToken) throw new Error("The server did not return a reset token.");
      setResetToken(response.data.resetToken);
      setStep(3);
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setLoading(false);
    }
  };

  const updateOtpDigit = (index, value) => {
    const digits = value.replace(/\D/g, "");
    if (!digits) {
      setOtp((previous) => previous.map((digit, i) => (i === index ? "" : digit)));
      return;
    }
    const next = [...otp];
    digits.slice(0, 6 - index).split("").forEach((digit, offset) => {
      next[index + offset] = digit;
    });
    setOtp(next);
    otpRefs.current[Math.min(index + digits.length, 5)]?.focus();
    setError("");
  };

  const handleOtpKeyDown = (event, index) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      const targetIndex = otp[index] ? index : Math.max(index - 1, 0);
      setOtp((previous) => previous.map((digit, i) => (i === targetIndex ? "" : digit)));
      otpRefs.current[targetIndex]?.focus();
      setError("");
    } else if (event.key === "ArrowLeft" && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const changeEmail = () => {
    setStep(1);
    setOtp(Array(6).fill(""));
    setResetToken("");
    setCountdown(0);
    setError("");
  };

  const updatePassword = async (event) => {
    event.preventDefault();
    if (loading) return;
    setError("");
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError("Use at least 8 characters, including a letter and a number.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Your passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      await axios.post(
        `${apiUrl}/reset-password`,
        { email: email.trim(), resetToken, newPassword },
        { timeout: 20000 }
      );
      setResetToken("");
      navigate("/login", { replace: true, state: { passwordResetSuccess: true } });
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = !newPassword
    ? "Add a letter and number to make your password stronger."
    : newPassword.length >= 12 && /[A-Za-z]/.test(newPassword) && /[0-9]/.test(newPassword)
      ? "Strong password"
      : newPassword.length >= 8 && /[A-Za-z]/.test(newPassword) && /[0-9]/.test(newPassword)
        ? "Good start — a longer password is even stronger."
        : "Use at least 8 characters, including a letter and a number.";

  const heading = ["Enter your email", "Check your email", "Choose a new password"][step - 1];
  const description = [
    "We'll send a one-time code if this address is registered.",
    "Enter the 6-digit code sent to your inbox.",
    "Choose a secure password for your Hakirush account.",
  ][step - 1];

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)] px-4 py-10 font-sans">
      <Motion.div
        aria-hidden
        animate={{ x: [0, 25, 0], y: [0, -18, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-red-300/30 blur-[110px]"
      />
      <Motion.div
        aria-hidden
        animate={{ x: [0, -25, 0], y: [0, 18, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -bottom-32 -right-32 h-[420px] w-[420px] rounded-full bg-rose-300/25 blur-[110px]"
      />

      <Motion.section
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-[2rem] bg-white p-7 shadow-[0_30px_80px_-30px_rgba(127,29,29,0.4)] ring-1 ring-red-100 sm:p-10"
      >
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-red-600 via-rose-500 to-orange-400" />
        <Link to="/login" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-red-600">
          <ArrowLeft size={16} /> Back to sign in
        </Link>

        <div className="mb-7 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/20">
            {step === 1 ? <Mail size={24} /> : step === 2 ? <KeyRound size={24} /> : <Lock size={24} />}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-600">Account recovery · Step {step} of 3</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">{heading}</h1>
          </div>
        </div>
        <p className="mb-6 text-sm leading-relaxed text-slate-500">{description}</p>

        <div className="mb-6 flex gap-2" aria-label={`Step ${step} of 3`}>
          {[1, 2, 3].map((number) => (
            <div key={number} className={`h-1.5 flex-1 rounded-full ${number <= step ? "bg-gradient-to-r from-red-600 to-rose-500" : "bg-slate-100"}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {error && (
            <Motion.div
              key="error"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-2xl bg-red-50 p-3.5 text-sm font-medium text-red-700 ring-1 ring-red-100"
            >
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </Motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <Motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.22 }}
          >
            {step === 1 && (
              <form onSubmit={(event) => { event.preventDefault(); sendOtp(); }} className="space-y-5">
                <label className="block space-y-2 text-sm font-bold text-slate-900" htmlFor="reset-email">
                  Email address
                  <div className="relative">
                    <Mail size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="reset-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(event) => { setEmail(event.target.value); setError(""); }}
                      placeholder="you@hakirush.com"
                      className="w-full rounded-2xl bg-slate-50 py-3.5 pl-12 pr-4 font-medium text-slate-900 ring-1 ring-slate-200 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-red-300"
                    />
                  </div>
                </label>
                <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-4 text-sm font-bold text-white shadow-lg shadow-red-600/20 transition hover:shadow-xl disabled:cursor-wait disabled:opacity-70">
                  {loading ? <><Loader2 size={18} className="animate-spin" /> Sending code…</> : <>Send OTP <ArrowRight size={17} /></>}
                </button>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={verifyOtp} className="space-y-5">
                <p className="text-sm text-slate-600">
                  Code sent to <strong className="text-slate-900">{email}</strong>{" "}
                  <button type="button" onClick={changeEmail} className="font-bold text-red-600 hover:text-red-700">Change email</button>
                </p>
                <div className="flex justify-between gap-2 sm:gap-3" aria-label="6-digit verification code">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={(element) => { otpRefs.current[index] = element; }}
                      type="text"
                      inputMode="numeric"
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      autoFocus={index === 0}
                      aria-label={`OTP digit ${index + 1}`}
                      maxLength={6}
                      value={digit}
                      onChange={(event) => updateOtpDigit(index, event.target.value)}
                      onKeyDown={(event) => handleOtpKeyDown(event, index)}
                      onPaste={(event) => {
                        const pasted = event.clipboardData.getData("text");
                        if (/\d/.test(pasted)) {
                          event.preventDefault();
                          updateOtpDigit(index, pasted);
                        }
                      }}
                      className="h-14 min-w-0 flex-1 rounded-xl bg-slate-50 text-center text-xl font-extrabold text-slate-900 ring-1 ring-slate-200 outline-none transition focus:bg-white focus:ring-2 focus:ring-red-300"
                    />
                  ))}
                </div>
                <button type="submit" disabled={loading || otp.join("").length !== 6} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-4 text-sm font-bold text-white shadow-lg shadow-red-600/20 transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60">
                  {loading ? <><Loader2 size={18} className="animate-spin" /> Verifying…</> : <>Verify code <ArrowRight size={17} /></>}
                </button>
                <div className="text-center text-sm text-slate-500">
                  {countdown > 0 ? (
                    <span>Resend code in <strong className="text-slate-700">0:{String(countdown).padStart(2, "0")}</strong></span>
                  ) : (
                    <button type="button" onClick={() => sendOtp(true)} disabled={loading} className="font-bold text-red-600 hover:text-red-700 disabled:opacity-60">
                      {loading ? "Sending…" : "Resend OTP"}
                    </button>
                  )}
                </div>
              </form>
            )}

            {step === 3 && (
              <form onSubmit={updatePassword} className="space-y-4">
                <label className="block space-y-2 text-sm font-bold text-slate-900" htmlFor="new-password">
                  New password
                  <div className="relative">
                    <Lock size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={newPassword}
                      onChange={(event) => { setNewPassword(event.target.value); setError(""); }}
                      className="w-full rounded-2xl bg-slate-50 py-3.5 pl-12 pr-12 font-medium text-slate-900 ring-1 ring-slate-200 outline-none transition focus:bg-white focus:ring-2 focus:ring-red-300"
                    />
                    <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((shown) => !shown)} className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600">
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>
                <p className="text-xs font-medium text-slate-500">{passwordStrength}</p>
                <label className="block space-y-2 text-sm font-bold text-slate-900" htmlFor="confirm-password">
                  Confirm new password
                  <div className="relative">
                    <Lock size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(event) => { setConfirmPassword(event.target.value); setError(""); }}
                      className="w-full rounded-2xl bg-slate-50 py-3.5 pl-12 pr-12 font-medium text-slate-900 ring-1 ring-slate-200 outline-none transition focus:bg-white focus:ring-2 focus:ring-red-300"
                    />
                    <button type="button" aria-label={showConfirmPassword ? "Hide confirmation" : "Show confirmation"} onClick={() => setShowConfirmPassword((shown) => !shown)} className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600">
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>
                <button type="submit" disabled={loading} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-4 text-sm font-bold text-white shadow-lg shadow-red-600/20 transition hover:shadow-xl disabled:cursor-wait disabled:opacity-70">
                  {loading ? <><Loader2 size={18} className="animate-spin" /> Updating password…</> : <><CheckCircle2 size={18} /> Update password</>}
                </button>
              </form>
            )}
          </Motion.div>
        </AnimatePresence>
      </Motion.section>
    </main>
  );
};

export default ForgotPassword;
