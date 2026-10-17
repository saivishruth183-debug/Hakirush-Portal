import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, CalendarPlus, X, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ArrowLeft,
  Loader2, Type, AlertTriangle, Info, Sparkles, PartyPopper, Sun,
} from "lucide-react";

const PAGE_BG =
  "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const CARD =
  "rounded-3xl bg-white/90 ring-1 ring-white/70 shadow-[0_10px_40px_-12px_rgba(127,29,29,0.18)] backdrop-blur";
const TITLE_MAX = 60;
const REDIRECT_MS = 1500;

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

const DatePicker = ({
  value, onChange, placeholder = "Pick a date", id,
  title = "Pick a date",          // label shown in the calendar header
  max, min,                        // "YYYY-MM-DD" limits (optional)
  quick,                           // [[label, Date], ...]; [] hides quick picks
  startView = "days",              // view to open on when no date is set: days | months | years
  defaultDate,                     // Date to show when no date is set
  describe,                        // (Date) => sub-label under the date
  invalid, onClose,
}) => {
  const selected = parseISO(value);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const maxD = parseISO(max);
  const minD = parseISO(min);
  const isDisabled = (d) => (maxD && d > maxD) || (minD && d < minD);
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
    const start = parseISO(value) || defaultDate || today;
    setCursor(start); setFocus(start); setView(parseISO(value) ? "days" : startView);
    place();
    setOpen(true);
  };
  const close = () => { setOpen(false); onClose?.(); };

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

  const pick = (d) => { if (isDisabled(d)) return; onChange(toISO(d)); close(); };
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

  const QUICK = (quick ?? [
    ["Today", today],
    ["Yesterday", addDays(today, -1)],
    ["1st of month", new Date(today.getFullYear(), today.getMonth(), 1)],
    ["Next Monday", addDays(today, ((8 - today.getDay()) % 7) || 7)],
  ]).filter(([, d]) => !isDisabled(d));
  const subLabel = (d) => (describe ? describe(d) : `${d.toLocaleDateString("en-IN", { weekday: "long" })} · ${relativeLabel(d)}`);

  return (
    <div ref={wrapRef} className="relative">
      <button
        id={id} type="button" onClick={() => (open ? close() : openPicker())}
        aria-haspopup="dialog" aria-expanded={open}
        aria-invalid={!!invalid}
        className={`group flex w-full items-center gap-3 rounded-2xl bg-white py-2.5 pl-3 pr-3 text-left ring-1 transition focus:outline-none focus:ring-2 focus:ring-red-400 ${open ? "ring-2 ring-red-400" : invalid ? "ring-red-300 hover:ring-red-400" : "ring-gray-200 hover:ring-red-200"}`}
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
                {subLabel(selected)}
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
              <p className="relative text-[10px] font-semibold uppercase tracking-wider text-white/70">{title}</p>
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
                          const off = isDisabled(d);
                          return (
                            <button
                              key={toISO(d)} type="button" data-iso={toISO(d)}
                              tabIndex={isFocus ? 0 : -1}
                              aria-selected={isSel} aria-label={d.toDateString()} aria-disabled={off || undefined}
                              onClick={() => pick(d)}
                              className={`relative flex h-9 items-center justify-center rounded-xl text-sm tabular-nums outline-none transition focus-visible:ring-2 focus-visible:ring-red-400 ${
                                off
                                  ? "cursor-not-allowed text-gray-200 line-through decoration-gray-200"
                                  : isSel
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
                    const mOff = (maxD && new Date(cursor.getFullYear(), i, 1) > maxD) || (minD && new Date(cursor.getFullYear(), i + 1, 0) < minD);
                    return (
                      <button key={m} type="button" disabled={mOff} onClick={() => { setCursor(new Date(cursor.getFullYear(), i, 1)); setFocus(new Date(cursor.getFullYear(), i, 1)); setView("days"); }}
                        className={`rounded-xl py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:text-gray-200 disabled:hover:bg-transparent ${isSel ? "bg-gradient-to-br from-red-600 to-rose-500 text-white shadow shadow-red-600/30" : isNow ? "text-red-600 ring-1 ring-red-200 hover:bg-red-50" : "text-gray-700 hover:bg-red-50"}`}>
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
                    const yOff = (maxD && y > maxD.getFullYear()) || (minD && y < minD.getFullYear());
                    return (
                      <button key={y} type="button" disabled={yOff} onClick={() => { setCursor(new Date(y, cursor.getMonth(), 1)); setView("months"); }}
                        className={`rounded-xl py-3 text-sm font-semibold tabular-nums transition disabled:cursor-not-allowed disabled:text-gray-200 disabled:hover:bg-transparent ${isSel ? "bg-gradient-to-br from-red-600 to-rose-500 text-white shadow shadow-red-600/30" : isNow ? "text-red-600 ring-1 ring-red-200 hover:bg-red-50" : "text-gray-700 hover:bg-red-50"}`}>
                        {y}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick picks */}
            <div className="border-t border-gray-100 bg-gray-50/60 p-3">
              {QUICK.length > 0 && <div className="mb-2.5 flex flex-wrap gap-1.5">
                {QUICK.map(([lbl, d]) => (
                  <button key={lbl} type="button" onClick={() => pick(d)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${sameDay(d, selected) ? "bg-red-600 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:text-red-600 hover:ring-red-200"}`}>
                    {lbl}
                  </button>
                ))}
              </div>}
              <div className="flex items-center justify-between">
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

/* Fixed-date holidays: picking one fills the title and (if no date yet) its next occurrence */
const nextOccurrence = (month, day) => {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  let d = new Date(t.getFullYear(), month, day);
  if (d < t) d = new Date(t.getFullYear() + 1, month, day);
  return d;
};
const SUGGESTIONS = [
  { title: "New Year's Day", m: 0, d: 1 },
  { title: "Republic Day", m: 0, d: 26 },
  { title: "May Day", m: 4, d: 1 },
  { title: "Independence Day", m: 7, d: 15 },
  { title: "Gandhi Jayanti", m: 9, d: 2 },
  { title: "Christmas", m: 11, d: 25 },
  { title: "Diwali" },
  { title: "Holi" },
  { title: "Pongal" },
  { title: "Eid al-Fitr" },
];

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
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={() => dismissable && onClose?.()} />
      <motion.div role="dialog" aria-modal="true"
        initial={{ y: 40, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 30, opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-gray-100">
        {children}
      </motion.div>
    </motion.div>,
    document.body
  );
};

/* ================= SUCCESS ================= */
const SuccessAlert = ({ title, date, onClose }) => (
  <Modal dismissable={false}>
    <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400" />
    <div className="p-7 text-center">
      <motion.div initial={{ scale: 0.4, rotate: -15 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}
        className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
        <PartyPopper size={30} />
      </motion.div>
      <h3 className="text-xl font-extrabold tracking-tight text-gray-900">Holiday added</h3>
      <p className="mt-2 text-sm text-gray-500">
        <b className="text-gray-800">{title}</b>
        {date && <> on {date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</>} is now on the calendar.
      </p>
      <div className="mt-5 h-1 overflow-hidden rounded-full bg-gray-100">
        <motion.div initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: REDIRECT_MS / 1000, ease: "linear" }}
          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400" />
      </div>
      <p className="mt-2 text-xs text-gray-400">Taking you to the holiday list…</p>
      <button onClick={onClose}
        className="mt-5 w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 hover:brightness-110">
        Go now
      </button>
    </div>
  </Modal>
);

/* ================= ERROR ================= */
const ErrorAlert = ({ message, onClose }) => (
  <Modal onClose={onClose}>
    <div className="h-1.5 bg-gradient-to-r from-red-600 to-rose-400" />
    <div className="p-7 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100"><AlertTriangle size={28} /></div>
      <h3 className="text-xl font-extrabold tracking-tight text-gray-900">Couldn't add holiday</h3>
      <p className="mt-2 text-sm text-gray-500">{message}</p>
      <button onClick={onClose}
        className="mt-6 w-full rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 hover:brightness-110">
        Got it
      </button>
    </div>
  </Modal>
);

/* ================= MAIN ================= */
const AddHoliday = () => {
  const [holiday, setHoliday] = useState({ title: "", date: "" });
  const [loading, setLoading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const navigate = useNavigate();
  // UI-only
  const [touched, setTouched] = useState({});
  const [errorMsg, setErrorMsg] = useState("");
  const [existing, setExisting] = useState([]);

  // Read-only: load existing holidays so we can warn about a clash on the same date
  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_BACKEND_URL}/api/holiday/upcoming`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      })
      .then((res) => res.data?.success && setExisting(res.data.holidays || []))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ title: true, date: true });
    if (!holiday.title.trim() || !holiday.date) return;

    setLoading(true);
    try {
      await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/holiday/add`, { ...holiday, title: holiday.title.trim() }, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setShowAlert(true);
      setTimeout(() => {
        setShowAlert(false);
        navigate("/admin-dashboard/holidays");
      }, REDIRECT_MS);
    } catch (err) {
      console.error(err);
      setLoading(false);
      setErrorMsg(err?.response?.data?.error || err?.response?.data?.message || "Something went wrong. Please try again.");
    }
  };

  /* derived */
  const picked = parseISO(holiday.date);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = picked ? Math.round((picked - today) / 86400000) : null;
  const isWeekend = picked && [0, 6].includes(picked.getDay());
  const isPast = diff !== null && diff < 0;
  const clash = picked && existing.find((h) => {
    const d = new Date(h.date);
    return sameDay(new Date(d.getFullYear(), d.getMonth(), d.getDate()), picked);
  });
  const titleErr = touched.title && !holiday.title.trim() ? "Give the holiday a name." : "";
  const dateErr = touched.date && !holiday.date ? "Pick the date of the holiday." : "";
  const ready = holiday.title.trim() && holiday.date;

  const applySuggestion = (s) => {
    setHoliday((h) => ({
      title: s.title,
      date: s.m !== undefined && !h.date ? toISO(nextOccurrence(s.m, s.d)) : h.date,
    }));
    setTouched((t) => ({ ...t, title: true }));
  };

  const QUICK = [
    ["Today", today],
    ["Tomorrow", addDays(today, 1)],
    ["Next Monday", addDays(today, ((8 - today.getDay()) % 7) || 7)],
    ["Next Friday", addDays(today, ((12 - today.getDay()) % 7) || 7)],
  ];

  return (
    <div className={`min-h-screen ${PAGE_BG} p-4 pb-28 sm:p-6 lg:p-8`}>
      <AnimatePresence>
        {showAlert && (
          <SuccessAlert key="ok" title={holiday.title.trim()} date={picked}
            onClose={() => { setShowAlert(false); navigate("/admin-dashboard/holidays"); }} />
        )}
        {errorMsg && <ErrorAlert key="err" message={errorMsg} onClose={() => setErrorMsg("")} />}
      </AnimatePresence>

      <div className="mx-auto max-w-5xl">
        {/* HEADER */}
        <button onClick={() => navigate("/admin-dashboard/holidays")}
          className="group mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-gray-500 ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200">
          <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" /> Back to holidays
        </button>
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/30">
            <CalendarPlus size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">Add holiday</h1>
            <p className="text-sm text-gray-500">This day will be skipped when counting leave days.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* FORM */}
          <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className={`${CARD} space-y-6 p-5 sm:p-7 lg:col-span-3`}>
            {/* title */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="title" className="text-xs font-semibold text-gray-600">Holiday name <span className="text-red-500">*</span></label>
                <span className={`text-[11px] tabular-nums ${holiday.title.length > TITLE_MAX - 10 ? "text-amber-600" : "text-gray-400"}`}>{holiday.title.length}/{TITLE_MAX}</span>
              </div>
              <div className="relative">
                <Type size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="title"
                  type="text"
                  maxLength={TITLE_MAX}
                  autoFocus
                  placeholder="e.g. Independence Day"
                  value={holiday.title}
                  onChange={(e) => setHoliday({ ...holiday, title: e.target.value })}
                  onBlur={() => setTouched((t) => ({ ...t, title: true }))}
                  aria-invalid={!!titleErr}
                  className={`w-full rounded-2xl border-0 bg-white py-3 pl-10 pr-10 text-sm font-semibold text-gray-900 ring-1 transition placeholder:font-normal placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-400 ${titleErr ? "ring-red-300" : "ring-gray-200 hover:ring-red-200"}`}
                />
                {holiday.title && (
                  <button type="button" onClick={() => setHoliday({ ...holiday, title: "" })} aria-label="Clear name"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-300 hover:bg-gray-100 hover:text-gray-600"><X size={14} /></button>
                )}
              </div>
              {titleErr && <p className="mt-1.5 text-xs font-semibold text-red-600">{titleErr}</p>}

              <div className="mt-3">
                <p className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400"><Sparkles size={11} /> Quick fill</p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => {
                    const active = holiday.title === s.title;
                    return (
                      <button key={s.title} type="button" onClick={() => applySuggestion(s)}
                        title={s.m !== undefined ? `Fixed date: ${s.d} ${MONTHS[s.m]}` : "Date changes each year — pick it below"}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${active ? "bg-red-600 text-white shadow shadow-red-600/30" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:text-red-600 hover:ring-red-200"}`}>
                        {s.title}
                        {s.m !== undefined && <span className={`ml-1 ${active ? "text-white/70" : "text-gray-400"}`}>{s.d} {MONTHS[s.m]}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="h-px bg-gray-100" />

            {/* date */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="date" className="text-xs font-semibold text-gray-600">Date <span className="text-red-500">*</span></label>
                <button type="button" onClick={() => { setHoliday({ ...holiday, date: toISO(today) }); setTouched((t) => ({ ...t, date: true })); }}
                  className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600 transition hover:bg-red-50 hover:text-red-600">Today</button>
              </div>
              <DatePicker
                id="date"
                value={holiday.date}
                onChange={(v) => { setHoliday({ ...holiday, date: v }); setTouched((t) => ({ ...t, date: true })); }}
                onClose={() => setTouched((t) => ({ ...t, date: true }))}
                placeholder="Pick the holiday date"
                title={holiday.title.trim() || "Holiday date"}
                quick={QUICK}
                invalid={!!dateErr}
              />
              {dateErr && <p className="mt-1.5 text-xs font-semibold text-red-600">{dateErr}</p>}

              <AnimatePresence>
                {picked && (clash || isWeekend || isPast) && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="mt-3 space-y-2">
                      {clash && (
                        <p className="flex items-start gap-2 rounded-2xl bg-red-50 p-3 text-xs text-red-700 ring-1 ring-red-100">
                          <AlertTriangle size={14} className="mt-px shrink-0" />
                          <span><b>{clash.title}</b> is already on this date.</span>
                        </p>
                      )}
                      {isWeekend && (
                        <p className="flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-100">
                          <Sun size={14} className="mt-px shrink-0" />
                          <span>This is a {picked.toLocaleDateString("en-IN", { weekday: "long" })} — already a day off, so it won't change any leave counts.</span>
                        </p>
                      )}
                      {isPast && (
                        <p className="flex items-start gap-2 rounded-2xl bg-gray-50 p-3 text-xs text-gray-600 ring-1 ring-gray-100">
                          <Info size={14} className="mt-px shrink-0" />
                          <span>This date is in the past. It will show as a past holiday and can't be deleted from the list later.</span>
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.section>

          {/* PREVIEW */}
          <motion.aside initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="lg:col-span-2">
            <div className="lg:sticky lg:top-6">
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Preview</p>
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 p-6 text-white shadow-xl shadow-red-600/25">
                <div className="absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/15 blur-2xl" />
                <div className="absolute -bottom-12 left-6 h-32 w-32 rounded-full bg-orange-300/25 blur-2xl" />
                <div className="relative flex items-start gap-4">
                  <div className="flex h-20 w-20 shrink-0 flex-col overflow-hidden rounded-2xl bg-white text-center leading-none text-gray-900 shadow-lg">
                    <span className="bg-gray-900 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                      {picked ? MONTHS[picked.getMonth()] : "Month"}
                    </span>
                    <span className={`flex flex-1 items-center justify-center text-3xl font-extrabold ${picked ? "" : "text-gray-200"}`}>
                      {picked ? picked.getDate() : "–"}
                    </span>
                  </div>
                  <div className="min-w-0 pt-1">
                    <p className={`break-words text-xl font-extrabold leading-tight ${holiday.title.trim() ? "" : "text-white/50"}`}>
                      {holiday.title.trim() || "Holiday name"}
                    </p>
                    <p className="mt-1 text-sm text-white/85">
                      {picked ? picked.toLocaleDateString("en-IN", { weekday: "long", year: "numeric" }) : "Pick a date"}
                    </p>
                  </div>
                </div>
                <div className="relative mt-5 flex flex-wrap gap-2">
                  {picked && (
                    <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/25">
                      {diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff > 0 ? `In ${diff} days` : `${-diff} days ago`}
                    </span>
                  )}
                  {picked && (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-red-700">
                      {isPast ? "Past" : "Upcoming"}
                    </span>
                  )}
                  {isWeekend && <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/25">Weekend</span>}
                </div>
              </div>

              <ul className={`${CARD} mt-4 space-y-2.5 p-4 text-sm`}>
                {[
                  ["Name added", !!holiday.title.trim()],
                  ["Date picked", !!holiday.date],
                  ["No clash with another holiday", !!picked && !clash],
                ].map(([label, ok]) => (
                  <li key={label} className="flex items-center gap-2.5">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full transition ${ok ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-300"}`}>
                      <CheckCircle2 size={13} />
                    </span>
                    <span className={ok ? "font-semibold text-gray-800" : "text-gray-400"}>{label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.aside>

          {/* ACTIONS */}
          <div className="sticky bottom-3 z-20 lg:col-span-5">
            <div className={`${CARD} flex items-center gap-3 p-3`}>
              <button type="button" onClick={() => navigate("/admin-dashboard/holidays")}
                className="rounded-2xl px-5 py-3 text-sm font-semibold text-gray-500 transition hover:bg-gray-100 hover:text-gray-800">
                Cancel
              </button>
              <span className="hidden flex-1 text-xs text-gray-400 sm:block">
                {ready ? (clash ? "Heads up: this date already has a holiday." : "Ready to add.") : "Add a name and a date to continue."}
              </span>
              <button type="submit" disabled={loading || showAlert}
                className="ml-auto flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <CalendarPlus size={16} />}
                {loading ? "Adding…" : "Add holiday"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddHoliday;
