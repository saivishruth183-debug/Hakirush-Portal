import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/authContext";
import axios from "axios";
import { apiErrorMessage } from "../utils/apiError";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldCheck,
  Check,
  X,
  Wand2,
  Copy,
  AlertTriangle,
  Loader2,
  LogOut,
  Fingerprint,
  ArrowBigUp,
} from "lucide-react";

const PAGE_BG =
  "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const CARD =
  "rounded-3xl bg-white/90 ring-1 ring-white/70 shadow-[0_10px_40px_-12px_rgba(127,29,29,0.18)] backdrop-blur";

const strengthOf = (pw) => {
  if (!pw) return { score: 0, label: "" };
  let score = 0;
  if (pw.length >= 8) score += 25;
  if (/[A-Z]/.test(pw)) score += 25;
  if (/[0-9]/.test(pw)) score += 25;
  if (/[^A-Za-z0-9]/.test(pw)) score += 25;
  const labels = { 25: "Weak", 50: "Fair", 75: "Strong", 100: "Excellent" };
  return { score, label: labels[score] || "Weak" };
};

const STRENGTH_TONE = {
  0: { bar: "bg-gray-200", text: "text-gray-400" },
  25: { bar: "bg-red-500", text: "text-red-600" },
  50: { bar: "bg-amber-400", text: "text-amber-600" },
  75: { bar: "bg-lime-500", text: "text-lime-600" },
  100: { bar: "bg-emerald-500", text: "text-emerald-600" },
};

// UI-only helper: build a 14-char password that ticks every rule
const generatePassword = () => {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "!@#$%^&*?-_"];
  const all = sets.join("");
  const rnd = (n) => {
    const a = new Uint32Array(1);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return a[0] % n;
  };
  const chars = sets.map((s) => s[rnd(s.length)]);
  while (chars.length < 14) chars.push(all[rnd(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) { const j = rnd(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join("");
};

const Setting = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  // The backend always targets the authenticated user; never send a userId.
  const [form, setForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [show, setShow] = useState({ old: false, new: false, confirm: false });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [reauthRequired, setReauthRequired] = useState(false);
  // UI-only
  const [caps, setCaps] = useState(false);
  const [copied, setCopied] = useState(false);

  const strength = useMemo(() => strengthOf(form.newPassword), [form.newPassword]);
  const mismatch =
    form.confirmPassword.length > 0 && form.newPassword !== form.confirmPassword;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.oldPassword || !form.newPassword) {
      return setError("Enter your current and new password.");
    }
    if (form.newPassword !== form.confirmPassword) {
      return setError("New password and confirmation don't match.");
    }
    if (form.newPassword.length < 8) {
      return setError("New password must be at least 8 characters.");
    }
    if (loading) return;
    try {
      setLoading(true);
      const res = await axios.put(
        `${import.meta.env.VITE_BACKEND_URL}/api/setting/change-password`,
        { oldPassword: form.oldPassword, newPassword: form.newPassword },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      if (res.data.success) {
        setForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
        // Password change revokes every session (tokenVersion bump):
        // sign out now and tell the user on the login page.
        if (res.data.reauthRequired) {
          setReauthRequired(true);
          logout("Password changed. Please sign in again with your new password.");
          navigate("/login", { replace: true });
          return;
        }
        setDone(true);
      }
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't update your password. Try again."));
    } finally {
      setLoading(false);
    }
  };

  /* ---------- UI-only derived ---------- */
  const pw = form.newPassword;
  const rules = [
    { ok: pw.length >= 8, label: "At least 8 characters" },
    { ok: /[A-Z]/.test(pw), label: "One uppercase letter" },
    { ok: /[0-9]/.test(pw), label: "One number" },
    { ok: /[^A-Za-z0-9]/.test(pw), label: "One symbol (!@#…)" },
    { ok: !!pw && pw !== form.oldPassword, label: "Different from current" },
  ];
  const matched = form.confirmPassword.length > 0 && !mismatch;
  const tone = STRENGTH_TONE[strength.score] || STRENGTH_TONE[0];
  const ready = !!form.oldPassword && pw.length >= 8 && matched;
  const steps = [!!form.oldPassword, pw.length >= 8, matched];

  const onKey = (e) => setCaps(!!e.getModifierState?.("CapsLock"));
  const suggest = () => {
    const p = generatePassword();
    setForm((f) => ({ ...f, newPassword: p, confirmPassword: p }));
    setShow((s) => ({ ...s, new: true }));
    setError("");
  };
  const copyNew = () => {
    if (!pw) return;
    navigator.clipboard?.writeText(pw).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  };

  return (
    <div className={`min-h-screen ${PAGE_BG} p-4 sm:p-6 lg:p-8`}>
      <div className="mx-auto max-w-5xl">
        <button onClick={() => navigate(-1)}
          className="group mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-gray-500 ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200">
          <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" /> Back
        </button>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* ================= LEFT: INFO ================= */}
          <motion.aside initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 p-6 text-white shadow-2xl shadow-red-600/30 sm:p-8 lg:col-span-2">
            <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 left-6 h-48 w-48 rounded-full bg-orange-300/25 blur-3xl" />

            <div className="relative">
              <motion.div initial={{ rotate: -12, scale: 0.8 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: "spring", stiffness: 220, damping: 14 }}
                className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-red-600 shadow-xl">
                <ShieldCheck size={30} />
              </motion.div>
              <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/75">Account security</p>
              <h1 className="mt-1 text-3xl font-extrabold leading-tight tracking-tight">Update your password</h1>
              <p className="mt-2 text-sm text-white/85">Choose something you don't use anywhere else.</p>

              <ul className="mt-6 space-y-3">
                {[
                  [Fingerprint, "Mix letters, numbers and symbols — or let us suggest one."],
                  [LogOut, "Changing it signs you out on every device, so you'll sign in again."],
                  [Lock, "Keep it private — don't share it, even with colleagues."],
                ].map(([Icon, text]) => (
                  <li key={text} className="flex items-start gap-3 rounded-2xl bg-white/10 p-3 text-sm ring-1 ring-white/15">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/15"><Icon size={15} /></span>
                    <span className="text-white/90">{text}</span>
                  </li>
                ))}
              </ul>

              {/* progress */}
              {!done && (
                <div className="mt-6">
                  <div className="flex gap-1.5">
                    {steps.map((ok, i) => (
                      <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/25">
                        <motion.div initial={false} animate={{ width: ok ? "100%" : "0%" }} transition={{ duration: 0.35 }} className="h-full rounded-full bg-white" />
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs font-semibold text-white/80">{steps.filter(Boolean).length} of 3 steps done</p>
                </div>
              )}
            </div>
          </motion.aside>

          {/* ================= RIGHT: FORM ================= */}
          <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className={`${CARD} p-6 sm:p-8 lg:col-span-3`}>
            <AnimatePresence mode="wait">
              {done ? (
                <motion.div key="done" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="flex h-full flex-col items-center justify-center py-8 text-center">
                  <motion.div initial={{ scale: 0.4, rotate: -15 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}
                    className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                    <CheckCircle2 size={38} />
                  </motion.div>
                  <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">Password updated</h2>
                  <p className="mt-2 max-w-sm text-sm text-gray-500">
                    {reauthRequired
                      ? "Your password was changed and all sessions were signed out. Sign in again with your new password."
                      : "Use your new password the next time you sign in."}
                  </p>
                  <button
                    onClick={() => {
                      if (reauthRequired) {
                        logout();
                        navigate("/login", { replace: true });
                      } else {
                        navigate(-1);
                      }
                    }}
                    className="mt-7 w-full max-w-xs rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 hover:brightness-110"
                  >
                    {reauthRequired ? "Sign in again" : "Done"}
                  </button>
                </motion.div>
              ) : (
                <motion.form key="form" onSubmit={handleSubmit} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6" noValidate>
                  <AnimatePresence>
                    {error && (
                      <motion.div role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="flex items-start gap-2.5 rounded-2xl bg-red-50 p-3.5 text-sm font-semibold text-red-700 ring-1 ring-red-100">
                          <AlertTriangle size={16} className="mt-px shrink-0" />
                          <span className="flex-1">{error}</span>
                          <button type="button" onClick={() => setError("")} aria-label="Dismiss" className="rounded-lg p-0.5 hover:bg-red-100"><X size={15} /></button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <Field
                    step={1}
                    done={steps[0]}
                    label="Current password"
                    name="oldPassword"
                    value={form.oldPassword}
                    show={show.old}
                    onChange={handleChange}
                    onKey={onKey}
                    toggle={() => setShow((s) => ({ ...s, old: !s.old }))}
                    icon={KeyRound}
                    placeholder="Your current password"
                    autoFocus
                  />

                  <div className="border-t border-dashed border-gray-200 pt-6">
                    <Field
                      step={2}
                      done={steps[1]}
                      label="New password"
                      name="newPassword"
                      value={form.newPassword}
                      show={show.new}
                      onChange={handleChange}
                      onKey={onKey}
                      toggle={() => setShow((s) => ({ ...s, new: !s.new }))}
                      icon={Lock}
                      placeholder="Create a new password"
                      action={
                        <div className="flex items-center gap-1">
                          {pw && (
                            <button type="button" onClick={copyNew} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-800">
                              {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
                            </button>
                          )}
                          <button type="button" onClick={suggest} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700 ring-1 ring-red-100 hover:bg-red-100">
                            <Wand2 size={12} /> Suggest strong
                          </button>
                        </div>
                      }
                    />

                    {/* strength */}
                    <div className="mt-3 pl-10">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-gray-400">Password strength</span>
                        <AnimatePresence mode="wait">
                          <motion.span key={strength.label || "none"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                            className={`text-[11px] font-extrabold ${tone.text}`}>{strength.label || "—"}</motion.span>
                        </AnimatePresence>
                      </div>
                      <div className="mt-1.5 flex gap-1">
                        {[25, 50, 75, 100].map((s) => (
                          <div key={s} className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                            <motion.div initial={false} animate={{ width: strength.score >= s ? "100%" : "0%" }} transition={{ duration: 0.3 }} className={`h-full rounded-full ${tone.bar}`} />
                          </div>
                        ))}
                      </div>
                      <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {rules.map((r) => (
                          <li key={r.label} className={`flex items-center gap-1.5 text-xs font-semibold transition ${r.ok ? "text-emerald-600" : "text-gray-400"}`}>
                            <span className={`flex h-4 w-4 items-center justify-center rounded-full transition ${r.ok ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-300"}`}>
                              {r.ok ? <Check size={10} strokeWidth={3} /> : <X size={9} strokeWidth={3} />}
                            </span>
                            {r.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <Field
                    step={3}
                    done={steps[2]}
                    label="Confirm new password"
                    name="confirmPassword"
                    value={form.confirmPassword}
                    show={show.confirm}
                    onChange={handleChange}
                    onKey={onKey}
                    toggle={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
                    icon={ShieldCheck}
                    placeholder="Type it once more"
                    invalid={mismatch}
                    valid={matched}
                    hint={mismatch ? "Doesn't match your new password" : matched ? "Passwords match" : ""}
                  />

                  <AnimatePresence>
                    {caps && (
                      <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-1.5 overflow-hidden rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 ring-1 ring-amber-100">
                        <ArrowBigUp size={14} /> Caps Lock is on
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <button
                    type="submit"
                    disabled={loading}
                    className={`flex w-full items-center justify-center gap-2.5 rounded-2xl py-4 text-sm font-bold text-white shadow-lg transition active:scale-[0.99] disabled:opacity-60 ${
                      ready ? "bg-gradient-to-r from-red-600 to-rose-500 shadow-red-600/30 hover:brightness-110" : "bg-gray-300 shadow-none"
                    }`}
                  >
                    {loading ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />}
                    {loading ? "Updating…" : "Update password"}
                  </button>
                  <p className="flex items-center justify-center gap-1.5 text-center text-xs text-gray-400">
                    <LogOut size={12} /> You'll be signed out on all devices after this.
                  </p>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.section>
        </div>
      </div>
    </div>
  );
};

const Field = ({ step, done, label, name, value, show, onChange, onKey, toggle, icon: Icon, invalid, valid, hint, placeholder, action, autoFocus }) => (
  <div>
    <div className="mb-2 flex items-center gap-2.5">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold transition ${done ? "bg-emerald-500 text-white" : "bg-red-50 text-red-600"}`}>
        {done ? <Check size={14} strokeWidth={3} /> : step}
      </span>
      <label htmlFor={`pw-${name}`} className="text-sm font-bold text-gray-900">{label}</label>
      {action && <div className="ml-auto">{action}</div>}
    </div>
    <div className="relative pl-10">
      <Icon size={16} className="pointer-events-none absolute left-[3.25rem] top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        id={`pw-${name}`}
        type={show ? "text" : "password"}
        name={name}
        value={value}
        onChange={onChange}
        onKeyUp={onKey}
        onKeyDown={onKey}
        autoFocus={autoFocus}
        autoComplete={name === "oldPassword" ? "current-password" : "new-password"}
        aria-invalid={!!invalid}
        className={`w-full rounded-2xl border-0 py-3.5 pl-10 pr-12 text-sm font-semibold text-gray-900 ring-1 transition placeholder:font-normal placeholder:text-gray-300 focus:outline-none focus:ring-2 ${
          invalid ? "bg-red-50/40 ring-red-300 focus:ring-red-400" : valid ? "bg-emerald-50/40 ring-emerald-300 focus:ring-emerald-400" : "bg-white ring-gray-200 hover:ring-red-200 focus:ring-red-400"
        } ${show ? "" : "tracking-wider"}`}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={toggle}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
        aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
    {hint && (
      <p className={`mt-1.5 flex items-center gap-1 pl-10 text-xs font-semibold ${invalid ? "text-red-600" : "text-emerald-600"}`}>
        {invalid ? <X size={12} /> : <Check size={12} />} {hint}
      </p>
    )}
  </div>
);

export default Setting;