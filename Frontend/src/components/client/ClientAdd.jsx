import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserPlus, Camera, Check, Eye, EyeOff, ArrowLeft, Building2, Mail, KeyRound,
  CalendarDays, Wallet, Crown, CalendarRange, UploadCloud, Trash2, AlertTriangle,
  Loader2, Wand2, Copy, CheckCircle2, X, Sparkles, ShieldCheck,
  ChevronLeft, ChevronRight, ChevronDown,
} from "lucide-react";

const PAGE_BG =
  "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const CARD =
  "rounded-3xl bg-white/90 ring-1 ring-white/70 shadow-[0_10px_40px_-12px_rgba(127,29,29,0.18)] backdrop-blur";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // matches server limit (5MB)
const REDIRECT_MS = 1800;

const PLANS = [
  { value: "Annual", label: "Annual Premium", blurb: "Billed yearly · full season coverage", icon: Crown, tone: "from-red-600 to-rose-500" },
  { value: "Quarterly", label: "Quarterly Standard", blurb: "Billed every 3 months · flexible", icon: CalendarRange, tone: "from-violet-500 to-fuchsia-400" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const initials = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const formatINR = (v) => (v === "" || v === undefined || !Number.isFinite(Number(v)) ? "" : `₹${Number(v).toLocaleString("en-IN")}`);
const compactINR = (n) => {
  n = Number(n) || 0;
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)} Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(1)} L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)} K`;
  return String(n);
};

const strengthOf = (pw = "") => {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
};
const STRENGTH = [
  ["Too weak", "bg-red-500", "text-red-600"],
  ["Weak", "bg-orange-500", "text-orange-600"],
  ["Fair", "bg-amber-500", "text-amber-600"],
  ["Good", "bg-lime-500", "text-lime-700"],
  ["Strong", "bg-emerald-500", "text-emerald-600"],
];
const generatePassword = () => {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "@#$%&*!?"];
  const all = sets.join("");
  const rnd = (n) => {
    const a = new Uint32Array(1);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return a[0] % n;
  };
  const chars = sets.map((s) => s[rnd(s.length)]);
  while (chars.length < 12) chars.push(all[rnd(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) { const j = rnd(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join("");
};

/* ================= DATE PICKER ================= */
const pad2 = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; // local, not UTC
const parseISO = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const relativeLabel = (d) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (Math.abs(diff) < 31) return diff > 0 ? `in ${diff} days` : `${-diff} days ago`;
  const months = Math.round(Math.abs(diff) / 30.44);
  if (months < 12) return diff > 0 ? `in ${months} mo` : `${months} mo ago`;
  const yrs = Math.round(Math.abs(diff) / 365.25);
  return diff > 0 ? `in ${yrs} yr${yrs > 1 ? "s" : ""}` : `${yrs} yr${yrs > 1 ? "s" : ""} ago`;
};

const DatePicker = ({ value, onChange, placeholder = "Pick a date", id }) => {
  const selected = parseISO(value);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("days"); // days | months | years
  const [cursor, setCursor] = useState(selected || today); // month being shown
  const [focus, setFocus] = useState(selected || today);   // keyboard-focused day
  const [dir, setDir] = useState(0);
  const [dropUp, setDropUp] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0, bottom: 0 });
  const wrapRef = useRef(null);
  const popRef = useRef(null);
  const gridRef = useRef(null);

  const place = () => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    const up = window.innerHeight - r.bottom < 440 && r.top > 440;
    const width = Math.min(312, window.innerWidth - 32);
    setDropUp(up);
    setPos({
      left: Math.max(16, Math.min(r.left, window.innerWidth - width - 16)),
      top: r.bottom + 8,
      bottom: window.innerHeight - r.top + 8,
    });
  };

  const openPicker = () => {
    const start = parseISO(value) || today;
    setCursor(start); setFocus(start); setView("days");
    place();
    setOpen(true);
  };
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return;
      close();
    };
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("touchstart", onDoc); window.removeEventListener("keydown", onKey); };
  }, [open]);

  // keep the focused day button focused for keyboard users
  useEffect(() => {
    if (open && view === "days") gridRef.current?.querySelector(`[data-iso="${toISO(focus)}"]`)?.focus({ preventScroll: true });
  }, [open, view, focus, cursor]);

  const pick = (d) => { onChange(toISO(d)); close(); };
  const shiftMonth = (n) => {
    setDir(n);
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1));
    setFocus((f) => new Date(f.getFullYear(), f.getMonth() + n, Math.min(f.getDate(), 28)));
  };

  const onGridKey = (e) => {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in moves) {
      e.preventDefault();
      const next = addDays(focus, moves[e.key]);
      if (next.getMonth() !== cursor.getMonth()) { setDir(next > focus ? 1 : -1); setCursor(new Date(next.getFullYear(), next.getMonth(), 1)); }
      setFocus(next);
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault(); shiftMonth(e.key === "PageUp" ? -1 : 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault(); pick(focus);
    }
  };

  // 6-week grid starting on Sunday
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = addDays(first, -first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const yearBlockStart = cursor.getFullYear() - (cursor.getFullYear() % 12);

  const QUICK = [
    ["Today", today],
    ["Yesterday", addDays(today, -1)],
    ["1st of month", new Date(today.getFullYear(), today.getMonth(), 1)],
    ["Next Monday", addDays(today, ((8 - today.getDay()) % 7) || 7)],
  ];

  return (
    <div ref={wrapRef} className="relative">
      <button
        id={id} type="button" onClick={() => (open ? close() : openPicker())}
        aria-haspopup="dialog" aria-expanded={open}
        className={`group flex w-full items-center gap-3 rounded-2xl bg-white py-2.5 pl-3 pr-3 text-left ring-1 transition focus:outline-none focus:ring-2 focus:ring-red-400 ${open ? "ring-2 ring-red-400" : "ring-gray-200 hover:ring-red-200"}`}
      >
        <span className={`flex h-9 w-9 shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl text-center leading-none transition ${selected ? "bg-gradient-to-br from-red-600 to-rose-500 text-white shadow shadow-red-600/30" : "bg-gray-50 text-gray-400 ring-1 ring-gray-100"}`}>
          {selected ? (
            <>
              <span className="text-[8px] font-bold uppercase tracking-wider opacity-80">{MONTHS[selected.getMonth()]}</span>
              <span className="text-sm font-extrabold">{selected.getDate()}</span>
            </>
          ) : <CalendarDays size={16} />}
        </span>
        <span className="min-w-0 flex-1">
          {selected ? (
            <>
              <span className="block truncate text-sm font-semibold text-gray-900">
                {selected.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </span>
              <span className="block truncate text-[11px] text-gray-400">
                {selected.toLocaleDateString("en-IN", { weekday: "long" })} · {relativeLabel(selected)}
              </span>
            </>
          ) : (
            <span className="block text-sm text-gray-300">{placeholder}</span>
          )}
        </span>
        {selected ? (
          <span role="button" tabIndex={0} aria-label="Clear date"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onChange(""); } }}
            className="rounded-lg p-1.5 text-gray-300 transition hover:bg-gray-100 hover:text-gray-600">
            <X size={14} />
          </span>
        ) : (
          <ChevronDown size={16} className={`text-gray-400 transition ${open ? "rotate-180" : ""}`} />
        )}
      </button>

      {createPortal(
      <AnimatePresence>
        {open && (
          <motion.div
            ref={popRef}
            style={dropUp ? { position: "fixed", left: pos.left, bottom: pos.bottom } : { position: "fixed", left: pos.left, top: pos.top }}
            role="dialog" aria-label="Choose date"
            initial={{ opacity: 0, y: dropUp ? 8 : -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: dropUp ? 8 : -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className={`z-[90] w-[19.5rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl bg-white shadow-[0_24px_60px_-12px_rgba(127,29,29,0.35)] ring-1 ring-gray-100 ${dropUp ? "origin-bottom-left" : "origin-top-left"}`}
          >
            {/* Header */}
            <div className="relative bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 px-4 pb-3 pt-4 text-white">
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/15 blur-xl" />
              <p className="relative text-[10px] font-semibold uppercase tracking-wider text-white/70">Date of onboarding</p>
              <p className="relative mt-0.5 text-lg font-extrabold">
                {selected ? selected.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "No date picked"}
              </p>
              <div className="relative mt-3 flex items-center justify-between">
                <button type="button" onClick={() => setView(view === "days" ? "months" : view === "months" ? "years" : "days")}
                  className="inline-flex items-center gap-1 rounded-xl bg-white/15 px-2.5 py-1 text-sm font-bold ring-1 ring-white/20 transition hover:bg-white/25">
                  {view === "years" ? `${yearBlockStart} – ${yearBlockStart + 11}` : view === "months" ? cursor.getFullYear() : `${cursor.toLocaleDateString("en-IN", { month: "long" })} ${cursor.getFullYear()}`}
                  <ChevronDown size={14} className={`transition ${view !== "days" ? "rotate-180" : ""}`} />
                </button>
                <div className="flex gap-1">
                  {[[-1, ChevronLeft, "Previous"], [1, ChevronRight, "Next"]].map(([n, Icon, lbl]) => (
                    <button key={lbl} type="button" aria-label={lbl}
                      onClick={() => view === "days" ? shiftMonth(n) : setCursor((c) => new Date(c.getFullYear() + n * (view === "years" ? 12 : 1), c.getMonth(), 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20 transition hover:bg-white/25">
                      <Icon size={16} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-3">
              {view === "days" && (
                <>
                  <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    {WEEKDAYS.map((w, i) => <span key={w} className={`py-1 ${i === 0 ? "text-red-400" : ""}`}>{w}</span>)}
                  </div>
                  <div className="relative overflow-hidden">
                    <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                      <motion.div
                        key={`${cursor.getFullYear()}-${cursor.getMonth()}`}
                        ref={gridRef} role="grid" onKeyDown={onGridKey}
                        custom={dir}
                        initial={{ x: dir * 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -dir * 40, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="grid grid-cols-7 gap-0.5"
                      >
                        {days.map((d) => {
                          const inMonth = d.getMonth() === cursor.getMonth();
                          const isSel = sameDay(d, selected);
                          const isToday = sameDay(d, today);
                          const isFocus = sameDay(d, focus);
                          return (
                            <button
                              key={toISO(d)} type="button" data-iso={toISO(d)}
                              tabIndex={isFocus ? 0 : -1}
                              aria-selected={isSel} aria-label={d.toDateString()}
                              onClick={() => pick(d)}
                              className={`relative flex h-9 items-center justify-center rounded-xl text-sm tabular-nums outline-none transition focus-visible:ring-2 focus-visible:ring-red-400 ${
                                isSel
                                  ? "bg-gradient-to-br from-red-600 to-rose-500 font-bold text-white shadow-md shadow-red-600/30"
                                  : isToday
                                    ? "font-bold text-red-600 ring-1 ring-red-200 hover:bg-red-50"
                                    : inMonth
                                      ? `font-medium ${d.getDay() === 0 ? "text-red-500/80" : "text-gray-700"} hover:bg-red-50 hover:text-red-700`
                                      : "text-gray-300 hover:bg-gray-50"
                              }`}
                            >
                              {d.getDate()}
                              {isToday && !isSel && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-red-500" />}
                            </button>
                          );
                        })}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </>
              )}

              {view === "months" && (
                <div className="grid grid-cols-3 gap-1.5 py-1">
                  {MONTHS.map((m, i) => {
                    const isSel = selected && selected.getFullYear() === cursor.getFullYear() && selected.getMonth() === i;
                    const isNow = today.getFullYear() === cursor.getFullYear() && today.getMonth() === i;
                    return (
                      <button key={m} type="button" onClick={() => { setCursor(new Date(cursor.getFullYear(), i, 1)); setFocus(new Date(cursor.getFullYear(), i, 1)); setView("days"); }}
                        className={`rounded-xl py-3 text-sm font-semibold transition ${isSel ? "bg-gradient-to-br from-red-600 to-rose-500 text-white shadow shadow-red-600/30" : isNow ? "text-red-600 ring-1 ring-red-200 hover:bg-red-50" : "text-gray-700 hover:bg-red-50"}`}>
                        {m}
                      </button>
                    );
                  })}
                </div>
              )}

              {view === "years" && (
                <div className="grid grid-cols-3 gap-1.5 py-1">
                  {Array.from({ length: 12 }, (_, i) => yearBlockStart + i).map((y) => {
                    const isSel = selected?.getFullYear() === y;
                    const isNow = today.getFullYear() === y;
                    return (
                      <button key={y} type="button" onClick={() => { setCursor(new Date(y, cursor.getMonth(), 1)); setView("months"); }}
                        className={`rounded-xl py-3 text-sm font-semibold tabular-nums transition ${isSel ? "bg-gradient-to-br from-red-600 to-rose-500 text-white shadow shadow-red-600/30" : isNow ? "text-red-600 ring-1 ring-red-200 hover:bg-red-50" : "text-gray-700 hover:bg-red-50"}`}>
                        {y}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick picks */}
            <div className="border-t border-gray-100 bg-gray-50/60 p-3">
              <div className="flex flex-wrap gap-1.5">
                {QUICK.map(([lbl, d]) => (
                  <button key={lbl} type="button" onClick={() => pick(d)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${sameDay(d, selected) ? "bg-red-600 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:text-red-600 hover:ring-red-200"}`}>
                    {lbl}
                  </button>
                ))}
              </div>
              <div className="mt-2.5 flex items-center justify-between">
                <button type="button" onClick={() => { onChange(""); close(); }} className="text-xs font-semibold text-gray-400 hover:text-gray-700">Clear</button>
                <button type="button" onClick={close} className="rounded-xl bg-gray-900 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-red-600">Done</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
      )}
    </div>
  );
};

/* ================= MODAL SHELL ================= */
const Modal = ({ children, onClose, dismissable = true }) => {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && dismissable && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, dismissable]);
  return createPortal(
    <motion.div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => dismissable && onClose?.()} />
      <motion.div role="dialog" aria-modal="true"
        initial={{ y: 40, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 30, opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white p-7 text-center shadow-2xl ring-1 ring-gray-100">
        {children}
      </motion.div>
    </motion.div>,
    document.body
  );
};

/* ================= SUCCESS DIALOG ================= */
const SuccessAlert = ({ name, onGo }) => (
  <Modal dismissable={false}>
    <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400" />
    <motion.div initial={{ scale: 0.4, rotate: -15 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}
      className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
      <Check size={30} strokeWidth={2.5} />
    </motion.div>
    <h3 className="text-xl font-extrabold tracking-tight text-gray-900">Client onboarded</h3>
    <p className="mt-2 text-sm text-gray-500">
      <span className="font-semibold text-gray-800">{name || "The client"}</span> has been added to the directory.
    </p>
    <div className="mt-5 h-1 overflow-hidden rounded-full bg-gray-100">
      <motion.div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400" initial={{ width: "0%" }} animate={{ width: "100%" }}
        transition={{ duration: REDIRECT_MS / 1000, ease: "linear" }} />
    </div>
    <p className="mt-2 text-[11px] text-gray-400">Taking you to the client directory…</p>
    <button onClick={onGo}
      className="mt-5 w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 transition hover:brightness-110 active:scale-[0.98]">
      Go to directory now
    </button>
  </Modal>
);

/* ================= ERROR DIALOG ================= */
const ErrorAlert = ({ title, message, onClose }) => (
  <Modal onClose={onClose}>
    <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-red-600 to-rose-400" />
    <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
    <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}
      className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100">
      <AlertTriangle size={28} />
    </motion.div>
    <h3 className="text-xl font-extrabold tracking-tight text-gray-900">{title}</h3>
    <p className="mt-2 text-sm leading-relaxed text-gray-500">{message}</p>
    <button onClick={onClose}
      className="mt-6 w-full rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:brightness-110 active:scale-[0.98]">
      Got it
    </button>
  </Modal>
);

/* ================= MAIN COMPONENT ================= */
const AddClient = () => {
  const [formData, setFormData] = useState({});
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // UI-only
  const [error, setError] = useState(null); // { title, message }
  const [touched, setTouched] = useState({});
  const [dragOver, setDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef(null);
  const redirectRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => () => clearTimeout(redirectRef.current), []);

  const pickLogo = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError({ title: "Wrong file type", message: "Please choose an image (PNG, JPG, SVG or WebP) for the company logo." });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError({ title: "Logo too large", message: "The company logo must be 5 MB or smaller." });
      return;
    }
    setFormData((p) => ({ ...p, companyLogo: file }));
    setPreview(URL.createObjectURL(file));
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "companyLogo") {
      pickLogo(files[0]);
      e.target.value = "";
      return;
    }
    setFormData((p) => ({ ...p, [name]: value }));
  };
  const setField = (name, value) => setFormData((p) => ({ ...p, [name]: value }));
  const touch = (e) => setTouched((t) => ({ ...t, [e.target.name]: true }));

  const removeLogo = () => {
    setFormData((p) => { const { companyLogo, ...rest } = p; return rest; });
    setPreview(null);
  };

  const errors = {
    name: !formData.name?.trim() ? "Client name is required" : "",
    email: !formData.email?.trim() ? "Email is required" : !EMAIL_RE.test(formData.email) ? "Enter a valid email address" : "",
    password: !formData.password ? "Password is required" : "",
    budget: formData.budget !== undefined && formData.budget !== "" && Number(formData.budget) < 0 ? "Budget cannot be negative" : "",
  };
  const showErr = (k) => touched[k] && errors[k];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setTouched({ name: true, email: true, password: true, budget: true });
    const firstErr = Object.values(errors).find(Boolean);
    if (firstErr) {
      setError({ title: "Check the form", message: firstErr + "." });
      return;
    }
    if (!formData.companyLogo) {
      setError({ title: "Logo required", message: "Company logo is required. Upload one using the logo area." });
      return;
    }
    setLoading(true);
    const fd = new FormData();
    Object.keys(formData).forEach((key) => fd.append(key, formData[key]));
    try {
      const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/client/add`, fd, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (res.data.success) {
        setShowAlert(true);
        redirectRef.current = setTimeout(() => navigate("/admin-dashboard/clients"), REDIRECT_MS);
      }
    } catch (err) {
      setError({ title: "Couldn't onboard client", message: err.response?.data?.error || "Submission error" });
    } finally {
      setLoading(false);
    }
  };

  const goNow = () => { clearTimeout(redirectRef.current); navigate("/admin-dashboard/clients"); };

  const fillPassword = () => {
    setField("password", generatePassword());
    setShowPassword(true);
    setTouched((t) => ({ ...t, password: true }));
  };
  const copyPassword = async () => {
    if (!formData.password) return;
    try { await navigator.clipboard.writeText(formData.password); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  /* progress */
  const checks = [
    ["Logo", !!formData.companyLogo],
    ["Name", !errors.name],
    ["Email", !errors.email],
    ["Password", !errors.password],
    ["Plan", !!formData.planType],
  ];
  const done = checks.filter(([, ok]) => ok).length;
  const pct = Math.round((done / checks.length) * 100);
  const strength = strengthOf(formData.password);
  const plan = PLANS.find((p) => p.value === formData.planType);

  return (
    <div className={`min-h-screen ${PAGE_BG} p-4 pb-16 text-gray-900 sm:p-6 lg:p-8`}>
      <AnimatePresence>
        {showAlert && <SuccessAlert key="ok" name={formData.name} onGo={goNow} />}
        {error && <ErrorAlert key="err" title={error.title} message={error.message} onClose={() => setError(null)} />}
      </AnimatePresence>

      <div className="mx-auto max-w-6xl">
        {/* HEADER */}
        <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <button onClick={() => navigate(-1)}
            className="group mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-gray-500 ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200">
            <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" /> Back
          </button>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/30">
                <UserPlus size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                  Onboard <span className="bg-gradient-to-r from-red-600 to-rose-500 bg-clip-text text-transparent">Client</span>
                </h1>
                <p className="text-sm text-gray-500">Create a login and business profile for a new client.</p>
              </div>
            </div>
            <div className="w-full sm:w-56">
              <div className="mb-1 flex justify-between text-xs font-semibold">
                <span className="text-gray-500">Profile complete</span>
                <span className="text-red-600">{pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white ring-1 ring-gray-200">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-red-600 to-rose-500" animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
              </div>
            </div>
          </div>
        </motion.header>

        <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* ============ LEFT: LOGO + PREVIEW ============ */}
          <aside className="space-y-5 lg:col-span-4">
            <div className="space-y-5 lg:sticky lg:top-6">
              {/* Logo upload */}
              <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={`${CARD} p-5`}>
                <SectionTitle icon={<Camera size={15} />} title="Company logo" required />
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); pickLogo(e.dataTransfer.files?.[0]); }}
                  onClick={() => fileRef.current?.click()}
                  className={`group relative mt-4 flex cursor-pointer flex-col items-center rounded-3xl border-2 border-dashed p-6 text-center transition ${
                    dragOver ? "border-red-400 bg-red-50/70" : preview ? "border-transparent bg-gray-50/70" : "border-gray-200 hover:border-red-300 hover:bg-red-50/30"
                  }`}
                >
                  <motion.div animate={dragOver ? { scale: 1.06 } : { scale: 1 }} className="relative">
                    <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl bg-white shadow-md ring-4 ring-white">
                      {preview ? (
                        <img src={preview} alt="Logo preview" className="h-full w-full object-cover" />
                      ) : (
                        <UploadCloud size={30} className="text-gray-300 transition group-hover:text-red-400" />
                      )}
                    </div>
                    <span className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/30">
                      <Camera size={15} />
                    </span>
                  </motion.div>
                  <p className="mt-4 text-sm font-semibold text-gray-700">{preview ? "Change logo" : "Drop logo or click to upload"}</p>
                  <p className="text-xs text-gray-400">PNG, JPG, SVG · max 5 MB</p>
                  <input ref={fileRef} type="file" name="companyLogo" accept="image/*" className="hidden" onChange={handleChange} />
                </div>
                {formData.companyLogo && (
                  <div className="mt-3 flex items-center justify-between rounded-2xl bg-emerald-50 px-3 py-2 text-xs ring-1 ring-emerald-100">
                    <span className="flex min-w-0 items-center gap-1.5 font-medium text-emerald-700">
                      <CheckCircle2 size={14} className="shrink-0" /> <span className="truncate">{formData.companyLogo.name}</span>
                    </span>
                    <button type="button" onClick={removeLogo} aria-label="Remove logo" className="rounded-lg p-1 text-emerald-700 hover:bg-white hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </motion.section>

              {/* Live preview card */}
              <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 p-5 text-white shadow-[0_20px_50px_-15px_rgba(220,38,38,0.55)]">
                <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/15 blur-2xl" />
                <p className="relative mb-4 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/80"><Sparkles size={12} /> Live preview</p>
                <div className="relative flex items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/20 text-lg font-bold ring-2 ring-white/40">
                    {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : initials(formData.name) || <Building2 size={22} />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-extrabold">{formData.name?.trim() || "Client name"}</p>
                    <p className="truncate text-xs text-white/80">{formData.email?.trim() || "email@company.com"}</p>
                  </div>
                </div>
                <div className="relative mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
                    <p className="text-[10px] uppercase tracking-wider text-white/70">Plan</p>
                    <p className="text-sm font-bold">{plan?.label || "—"}</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
                    <p className="text-[10px] uppercase tracking-wider text-white/70">Budget</p>
                    <p className="text-sm font-bold">{formData.budget ? `₹${compactINR(formData.budget)}` : "—"}</p>
                  </div>
                </div>
                <ul className="relative mt-4 flex flex-wrap gap-1.5">
                  {checks.map(([lbl, ok]) => (
                    <li key={lbl} className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${ok ? "bg-white text-red-600" : "bg-white/15 text-white/80"}`}>
                      {ok ? <Check size={11} strokeWidth={3} /> : <span className="h-1.5 w-1.5 rounded-full bg-white/60" />} {lbl}
                    </li>
                  ))}
                </ul>
              </motion.section>
            </div>
          </aside>

          {/* ============ RIGHT: FORM ============ */}
          <div className="space-y-5 lg:col-span-8">
            {/* Account */}
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`${CARD} p-5 sm:p-6`}>
              <SectionTitle icon={<ShieldCheck size={15} />} title="Account & login" subtitle="The client signs in with this email and password" />
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Client name" icon={Building2} required error={showErr("name")}>
                  <input name="name" value={formData.name || ""} onChange={handleChange} onBlur={touch} placeholder="e.g. Sunrise Sports Club" autoComplete="organization" className={inputCls(showErr("name"))} />
                </Field>
                <Field label="Email address" icon={Mail} required error={showErr("email")}>
                  <input name="email" type="email" value={formData.email || ""} onChange={handleChange} onBlur={touch} placeholder="contact@company.com" autoComplete="off" className={inputCls(showErr("email"))} />
                </Field>

                <div className="md:col-span-2">
                  <Field label="Password" icon={KeyRound} required error={showErr("password")}
                    action={
                      <button type="button" onClick={fillPassword} className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-600 transition hover:bg-red-100">
                        <Wand2 size={11} /> Generate
                      </button>
                    }>
                    <input name="password" type={showPassword ? "text" : "password"} value={formData.password || ""} onChange={handleChange} onBlur={touch}
                      placeholder="Create a password" autoComplete="new-password" className={`${inputCls(showErr("password"))} pr-20`} />
                    <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                      {formData.password && (
                        <button type="button" onClick={copyPassword} aria-label="Copy password" title="Copy"
                          className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700">
                          {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                        </button>
                      )}
                      <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}
                        className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700">
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </Field>
                  {formData.password && (
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex flex-1 gap-1">
                        {[0, 1, 2, 3].map((i) => (
                          <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < strength ? STRENGTH[strength][1] : "bg-gray-200"}`} />
                        ))}
                      </div>
                      <span className={`text-[11px] font-semibold ${STRENGTH[strength][2]}`}>{STRENGTH[strength][0]}</span>
                    </div>
                  )}
                  <p className="mt-1.5 text-[11px] text-gray-400">Share this with the client securely. They can change it after signing in.</p>
                </div>
              </div>
            </motion.section>

            {/* Business */}
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className={`${CARD} p-5 sm:p-6`}>
              <SectionTitle icon={<Wallet size={15} />} title="Business details" subtitle="Plan, budget and onboarding date" />

              <p className="mb-2 mt-5 text-xs font-semibold text-gray-600">Plan type</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Plan type">
                {PLANS.map((p) => {
                  const active = formData.planType === p.value;
                  return (
                    <button key={p.value} type="button" role="radio" aria-checked={active}
                      onClick={() => setField("planType", active ? "" : p.value)}
                      className={`relative flex items-center gap-3 rounded-2xl p-4 text-left transition ${
                        active ? "bg-red-50/70 ring-2 ring-red-400" : "bg-white ring-1 ring-gray-200 hover:ring-red-200"
                      }`}>
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${p.tone} text-white shadow-md`}>
                        <p.icon size={19} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-900">{p.label}</p>
                        <p className="text-xs text-gray-500">{p.blurb}</p>
                      </div>
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition ${active ? "bg-red-600 text-white" : "ring-2 ring-gray-200"}`}>
                        {active && <Check size={12} strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Budget" icon={Wallet} error={showErr("budget")} hint={formData.budget && !errors.budget ? formatINR(formData.budget) : null}>
                  <span className="pointer-events-none absolute left-10 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">₹</span>
                  <input name="budget" type="number" min="0" inputMode="numeric" value={formData.budget || ""} onChange={handleChange} onBlur={touch}
                    onWheel={(e) => e.currentTarget.blur()} placeholder="0"
                    className={`${inputCls(showErr("budget"))} pl-[3.25rem] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none`} />
                </Field>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="dateOfJoining" className="text-xs font-semibold text-gray-600">Date of onboarding</label>
                    <button type="button" onClick={() => setField("dateOfJoining", toISO(new Date()))} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600 transition hover:bg-red-50 hover:text-red-600">
                      Today
                    </button>
                  </div>
                  <DatePicker
                    id="dateOfJoining"
                    value={formData.dateOfJoining || ""}
                    onChange={(v) => setField("dateOfJoining", v)}
                    placeholder="Pick the onboarding date"
                  />
                </div>
              </div>
            </motion.section>

            {/* ACTIONS */}
            <div className="sticky bottom-3 z-20">
              <div className={`${CARD} flex items-center gap-3 p-3`}>
                <button type="button" onClick={() => navigate(-1)}
                  className="rounded-2xl px-5 py-3 text-sm font-semibold text-gray-500 transition hover:bg-gray-100 hover:text-gray-800">
                  Discard
                </button>
                <span className="hidden flex-1 text-xs text-gray-400 sm:block">
                  {done === checks.length ? "Everything looks good." : `${checks.length - done} item${checks.length - done > 1 ? "s" : ""} left`}
                </span>
                <button type="submit" disabled={loading || showAlert}
                  className="ml-auto flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                  {loading ? "Onboarding…" : "Complete onboarding"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ===== SUPPORTING COMPONENTS ===== */

const inputCls = (err) =>
  `w-full rounded-2xl bg-white py-3 pl-10 pr-4 text-sm font-semibold text-gray-900 outline-none ring-1 transition placeholder:font-normal placeholder:text-gray-300 focus:ring-2 ${
    err ? "ring-red-300 focus:ring-red-400" : "ring-gray-200 focus:ring-red-400"
  }`;

const SectionTitle = ({ icon, title, subtitle, required }) => (
  <div className="flex items-center gap-3">
    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600">{icon}</div>
    <div>
      <h2 className="text-base font-bold text-gray-900">{title} {required && <span className="text-red-500">*</span>}</h2>
      {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
    </div>
  </div>
);

const Field = ({ label, icon: Icon, required, error, hint, action, children }) => (
  <div>
    <div className="mb-1.5 flex items-center justify-between">
      <label className="text-xs font-semibold text-gray-600">{label} {required && <span className="text-red-500">*</span>}</label>
      {action}
    </div>
    <div className="group relative">
      {Icon && <Icon size={16} className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 transition ${error ? "text-red-400" : "text-gray-400 group-focus-within:text-red-500"}`} />}
      {children}
    </div>
    <AnimatePresence initial={false}>
      {error ? (
        <motion.p key="e" initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-1 text-[11px] font-medium text-red-500">{error}</motion.p>
      ) : hint ? (
        <motion.p key="h" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-1 text-[11px] font-medium text-gray-400">{hint}</motion.p>
      ) : null}
    </AnimatePresence>
  </div>
);

export default AddClient;
