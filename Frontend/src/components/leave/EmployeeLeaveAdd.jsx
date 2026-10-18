import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../context/authContext";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, FileText, ArrowRight, Check, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X,
  AlertTriangle, Clock, Briefcase, ShieldCheck, TrendingUp, Umbrella, Stethoscope, Loader2, Send,
  CheckCircle2, Info, Sparkles, PartyPopper,
} from "lucide-react";

const PAGE_BG =
  "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const CARD =
  "rounded-3xl bg-white/90 ring-1 ring-white/70 shadow-[0_10px_40px_-12px_rgba(127,29,29,0.18)] backdrop-blur";
const ANNUAL_QUOTA = 12;
const REASON_MAX = 500;
const REDIRECT_MS = 2000;

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

/* ================= MODALS ================= */
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

const SuccessAlert = ({ onClose, summary }) => (
  <Modal dismissable={false}>
    <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400" />
    <div className="p-7 text-center">
      <motion.div initial={{ scale: 0.4, rotate: -15 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}
        className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
        <Check size={30} />
      </motion.div>
      <h3 className="text-xl font-extrabold tracking-tight text-gray-900">Request sent</h3>
      <p className="mt-2 text-sm text-gray-500">{summary || "Your leave request has been submitted for approval."}</p>
      <div className="mt-5 h-1 overflow-hidden rounded-full bg-gray-100">
        <motion.div initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: REDIRECT_MS / 1000, ease: "linear" }}
          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400" />
      </div>
      <p className="mt-2 text-xs text-gray-400">Taking you to your leaves…</p>
      <button onClick={onClose}
        className="mt-5 w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 hover:brightness-110">
        Got it, thanks
      </button>
    </div>
  </Modal>
);

const ErrorAlert = ({ message, onClose }) => (
  <Modal onClose={onClose}>
    <div className="h-1.5 bg-gradient-to-r from-red-600 to-rose-400" />
    <div className="p-7 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100"><AlertTriangle size={28} /></div>
      <h3 className="text-xl font-extrabold tracking-tight text-gray-900">Couldn't send request</h3>
      <p className="mt-2 text-sm text-gray-500">{message}</p>
      <button onClick={onClose}
        className="mt-6 w-full rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 hover:brightness-110">
        Got it
      </button>
    </div>
  </Modal>
);

const LEAVE_TYPES = [
  { value: "Casual Leave", label: "Casual leave", key: "casual", Icon: Umbrella, hint: "Personal work, travel, family", grad: "from-violet-500 to-fuchsia-500", soft: "bg-violet-50 text-violet-700 ring-violet-200", bar: "bg-violet-500" },
  { value: "Sick Leave", label: "Sick leave", key: "sick", Icon: Stethoscope, hint: "Illness, doctor visits", grad: "from-rose-500 to-red-500", soft: "bg-rose-50 text-rose-700 ring-rose-200", bar: "bg-rose-500" },
];
const QUICK_REASONS = {
  "Casual Leave": ["Personal work", "Family function", "Travelling out of town", "Festival at home"],
  "Sick Leave": ["Not feeling well", "Fever / cold", "Doctor's appointment", "Medical check-up"],
  "": ["Personal work", "Not feeling well", "Family function"],
};

const EmployeeLeaveAdd = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [leave, setLeave] = useState({ leaveType: "", startDate: "", endDate: "", reason: "" });
  const [balance, setBalance] = useState({ casual: 12, sick: 12 });
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  const [daysCount, setDaysCount] = useState(0);
  // UI-only
  const [errorMsg, setErrorMsg] = useState("");
  const [touched, setTouched] = useState({});

  // Helper: Format to YYYY-MM-DD using Local Time
  const toLocalYMD = (dateInput) => {
    const d = new Date(dateInput);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  // Logic to calculate working days (Excluding Weekends & Holidays)
  const calculateWorkingDays = useCallback((start, end, holidayList) => {
    if (!start || !end) return 0;
    let count = 0;
    let cur = new Date(start);
    const stop = new Date(end);

    // Normalize to midnight local time
    cur.setHours(0,0,0,0);
    stop.setHours(0,0,0,0);

    // Memoize holiday strings for faster lookup
    const holidayStrings = new Set(holidayList.map(h =>
      typeof h === 'string' ? h : toLocalYMD(h.date || h)
    ));

    while (cur <= stop) {
      const dayOfWeek = cur.getDay(); // 0 = Sunday, 6 = Saturday
      const dateStr = toLocalYMD(cur);

      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayStrings.has(dateStr)) {
        count++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }, []);

  // Initial Data Fetch
  useEffect(() => {
    const fetchData = async () => {
      if (!user?._id) return;
      const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };
      try {
        setFetchingData(true);
        const [holidayRes, leaveHistoryRes] = await Promise.all([
          axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/holiday/all`, { headers }),
          axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/leave/${user._id}/employee`, { headers })
        ]);

        const hData = holidayRes?.data?.holidays || [];
        setHolidays(hData);

        const approvedLeaves = leaveHistoryRes?.data?.leaves || [];

        const casualUsed = approvedLeaves
          .filter(l => l.status === "Approved" && l.leaveType === "Casual Leave")
          .reduce((total, l) => total + calculateWorkingDays(l.startDate, l.endDate, hData), 0);

        const sickUsed = approvedLeaves
          .filter(l => l.status === "Approved" && l.leaveType === "Sick Leave")
          .reduce((total, l) => total + calculateWorkingDays(l.startDate, l.endDate, hData), 0);

        setBalance({
          casual: Math.max(0, 12 - casualUsed),
          sick: Math.max(0, 12 - sickUsed)
        });
      } catch (e) {
        console.error("Data Fetch Error:", e);
      } finally {
        setFetchingData(false);
      }
    };
    fetchData();
  }, [user?._id, calculateWorkingDays]);

  // Real-time days counter
  useEffect(() => {
    if (leave.startDate && leave.endDate) {
      const count = calculateWorkingDays(leave.startDate, leave.endDate, holidays);
      setDaysCount(count);
    } else {
      setDaysCount(0);
    }
  }, [leave.startDate, leave.endDate, holidays, calculateWorkingDays]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ leaveType: true, startDate: true, endDate: true, reason: true });
    if (!leave.leaveType || !leave.startDate || !leave.endDate || !leave.reason.trim()) return;

    const currentBalance = leave.leaveType === "Sick Leave" ? balance.sick : balance.casual;
    if (daysCount > currentBalance) {
      setErrorMsg("Insufficient leave balance.");
      return;
    }

    try {
      setLoading(true);
      // Ensure startDate and endDate are sent as YYYY-MM-DD (local)
      const payload = {
        ...leave,
        startDate: toLocalYMD(leave.startDate),
        endDate: toLocalYMD(leave.endDate),
        days: daysCount,
        userId: user._id
      };
      const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/leave/add`,
        payload,
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      if (res.data?.success) {
        setShowAlert(true);
        setTimeout(() => navigate(`/employee-dashboard/leaves/${user._id}`), REDIRECT_MS);
      }
    } catch (err) {
      setErrorMsg(err?.response?.data?.error || "Submission failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isInsufficient = (leave.leaveType === "Sick Leave" && daysCount > balance.sick) ||
                         (leave.leaveType === "Casual Leave" && daysCount > balance.casual);

  /* ---------- UI-only derived ---------- */
  const todayISO = toLocalYMD(new Date());
  const holidayMap = useMemo(
    () => Object.fromEntries(holidays.map((h) => [toLocalYMD(h.date || h), h.title || h.name || "Holiday"])),
    [holidays]
  );
  const start = parseISO(leave.startDate);
  const end = parseISO(leave.endDate);
  const strip = useMemo(() => {
    if (!start || !end || end < start) return [];
    const out = [];
    let cur = new Date(start);
    while (cur <= end && out.length < 62) {
      const ymd = toLocalYMD(cur);
      const dow = cur.getDay();
      out.push({ date: new Date(cur), weekend: dow === 0 || dow === 6, holiday: holidayMap[ymd] });
      cur = addDays(cur, 1);
    }
    return out;
  }, [leave.startDate, leave.endDate, holidayMap]); // eslint-disable-line
  const calDays = strip.length;
  const skippedHolidays = strip.filter((d) => d.holiday && !d.weekend);
  const type = LEAVE_TYPES.find((t) => t.value === leave.leaveType);
  const typeBalance = type ? balance[type.key] : null;
  const after = typeBalance !== null ? typeBalance - daysCount : null;
  const upcomingHolidays = holidays
    .filter((h) => toLocalYMD(h.date || h) >= todayISO)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 3);
  const errs = {
    leaveType: touched.leaveType && !leave.leaveType ? "Choose a leave type." : "",
    startDate: touched.startDate && !leave.startDate ? "Pick a start date." : "",
    endDate: touched.endDate && !leave.endDate ? "Pick an end date." : "",
    reason: touched.reason && !leave.reason.trim() ? "Add a short reason." : "",
  };
  const canSubmit = !loading && daysCount > 0 && !isInsufficient && !!leave.leaveType && !!leave.reason.trim();
  const blocker = !leave.leaveType ? "Choose a leave type"
    : !leave.startDate || !leave.endDate ? "Pick your dates"
    : daysCount === 0 ? "Those dates are all non-working days"
    : isInsufficient ? "Not enough balance"
    : !leave.reason.trim() ? "Add a reason" : "";

  const setStart = (v) => {
    setLeave((p) => ({ ...p, startDate: v, endDate: p.endDate && v && p.endDate < v ? v : (p.endDate || v) }));
    setTouched((t) => ({ ...t, startDate: true }));
  };
  const setEnd = (v) => {
    setLeave((p) => ({ ...p, endDate: v }));
    setTouched((t) => ({ ...t, endDate: true }));
  };
  const addReason = (r) => setLeave((p) => ({ ...p, reason: p.reason.trim() ? `${p.reason.trim()} — ${r}` : r }));
  const endQuick = start
    ? [["Same day", start], ["2 days", addDays(start, 1)], ["3 days", addDays(start, 2)], ["Till Friday", addDays(start, Math.max(0, 5 - start.getDay()))]]
        .filter(([, d], i, arr) => arr.findIndex(([, x]) => sameDay(x, d)) === i)
    : [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const startQuick = [
    ["Today", today],
    ["Tomorrow", addDays(today, 1)],
    ["Next Monday", addDays(today, ((8 - today.getDay()) % 7) || 7)],
  ];
  const fmtLong = (d) => d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div className={`min-h-screen w-full ${PAGE_BG} p-4 sm:p-6 lg:p-8`}>
      <AnimatePresence>
        {showAlert && (
          <SuccessAlert key="ok"
            summary={type && start && end ? `${daysCount} day${daysCount === 1 ? "" : "s"} of ${type.label.toLowerCase()}, ${fmtLong(start)}${sameDay(start, end) ? "" : ` – ${fmtLong(end)}`}. Your manager will review it.` : null}
            onClose={() => setShowAlert(false)} />
        )}
        {errorMsg && <ErrorAlert key="err" message={errorMsg} onClose={() => setErrorMsg("")} />}
      </AnimatePresence>

      <div className="mx-auto max-w-6xl">
        {/* HEADER */}
        <Link to={user?._id ? `/employee-dashboard/leaves/${user._id}` : "#"}
          className="group mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-gray-500 ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200">
          <ChevronLeft size={14} className="transition-transform group-hover:-translate-x-0.5" /> My leaves
        </Link>
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/30">
            <Calendar size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">Request leave</h1>
            <p className="text-sm text-gray-500">Weekends and holidays are skipped automatically.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* ================= LEFT: FORM ================= */}
          <div className="space-y-6 lg:col-span-7">
            {/* Step 1: type */}
            <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className={`${CARD} p-5 sm:p-6`}>
              <StepTitle n={1} title="Leave type" done={!!leave.leaveType} error={errs.leaveType} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {LEAVE_TYPES.map((t) => {
                  const on = leave.leaveType === t.value;
                  const left = balance[t.key];
                  const empty = !fetchingData && left <= 0;
                  return (
                    <button key={t.value} type="button"
                      onClick={() => { setLeave((p) => ({ ...p, leaveType: t.value })); setTouched((x) => ({ ...x, leaveType: true })); }}
                      className={`relative overflow-hidden rounded-2xl p-4 text-left transition ${on ? `bg-gradient-to-br ${t.grad} text-white shadow-lg` : "bg-white ring-1 ring-gray-200 hover:ring-red-200"}`}>
                      {on && <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-white text-red-600"><Check size={12} strokeWidth={3} /></span>}
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${on ? "bg-white/20" : t.soft + " ring-1"}`}><t.Icon size={19} /></div>
                      <p className={`mt-3 text-base font-extrabold ${on ? "" : "text-gray-900"}`}>{t.label}</p>
                      <p className={`text-xs ${on ? "text-white/80" : "text-gray-400"}`}>{t.hint}</p>
                      <div className="mt-3 flex items-end justify-between">
                        <p className={`text-xs font-semibold ${on ? "text-white/90" : empty ? "text-red-600" : "text-gray-500"}`}>
                          {fetchingData ? "Loading…" : empty ? "None left" : `${left} of ${ANNUAL_QUOTA} left`}
                        </p>
                        <p className={`text-2xl font-extrabold leading-none tabular-nums ${on ? "" : "text-gray-900"}`}>{fetchingData ? "–" : left}</p>
                      </div>
                      <div className={`mt-2 h-1.5 overflow-hidden rounded-full ${on ? "bg-white/25" : "bg-gray-100"}`}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${fetchingData ? 0 : (left / ANNUAL_QUOTA) * 100}%` }} transition={{ duration: 0.7 }}
                          className={`h-full rounded-full ${on ? "bg-white" : t.bar}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.section>

            {/* Step 2: dates */}
            <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={`${CARD} p-5 sm:p-6`}>
              <StepTitle n={2} title="Dates" done={!!leave.startDate && !!leave.endDate && daysCount > 0} error={errs.startDate || errs.endDate} />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="la-start" className="mb-1.5 block text-xs font-semibold text-gray-600">From</label>
                  <DatePicker id="la-start" value={leave.startDate} onChange={setStart} min={todayISO} quick={startQuick}
                    title="Leave starts" placeholder="First day off" invalid={!!errs.startDate}
                    describe={(d) => `${d.toLocaleDateString("en-IN", { weekday: "long" })} · ${relativeLabel(d)}${holidayMap[toLocalYMD(d)] ? " · holiday" : [0, 6].includes(d.getDay()) ? " · weekend" : ""}`} />
                </div>
                <div>
                  <label htmlFor="la-end" className="mb-1.5 block text-xs font-semibold text-gray-600">To</label>
                  <DatePicker id="la-end" value={leave.endDate} onChange={setEnd} min={leave.startDate || todayISO} quick={endQuick}
                    defaultDate={start || undefined}
                    title="Leave ends" placeholder="Last day off" invalid={!!errs.endDate}
                    describe={(d) => `${d.toLocaleDateString("en-IN", { weekday: "long" })} · ${relativeLabel(d)}`} />
                </div>
              </div>

              <AnimatePresence initial={false}>
                {strip.length > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="mt-5 rounded-2xl bg-gray-50/80 p-3 ring-1 ring-gray-100">
                      <div className="flex flex-wrap gap-1.5">
                        {strip.map((d) => {
                          const counted = !d.weekend && !d.holiday;
                          return (
                            <div key={d.date.toISOString()} title={d.holiday ? `Holiday: ${d.holiday}` : d.weekend ? "Weekend — not counted" : "Counted"}
                              className={`flex w-11 flex-col items-center rounded-xl py-1.5 text-center leading-none ring-1 ${
                                counted ? "bg-gradient-to-br from-red-600 to-rose-500 text-white ring-transparent shadow shadow-red-600/20" : d.holiday ? "bg-amber-50 text-amber-700 ring-amber-100" : "bg-white text-gray-300 ring-gray-100"
                              }`}>
                              <span className="text-[9px] font-bold uppercase">{d.date.toLocaleDateString("en-IN", { weekday: "short" }).slice(0, 2)}</span>
                              <span className={`mt-0.5 text-sm font-extrabold ${counted ? "" : "line-through decoration-1"}`}>{d.date.getDate()}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-3 text-[11px] text-gray-500">
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-500" /> Counted ({daysCount})</span>
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gray-200" /> Weekend</span>
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-300" /> Holiday{skippedHolidays.length ? `: ${skippedHolidays.map((h) => h.holiday).join(", ")}` : ""}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {leave.startDate && leave.endDate && daysCount === 0 && (
                <p className="mt-3 flex items-center gap-2 rounded-2xl bg-amber-50 p-3 text-xs font-semibold text-amber-800 ring-1 ring-amber-100">
                  <AlertTriangle size={14} className="shrink-0" /> Range only contains non-working days — no leave needed.
                </p>
              )}
            </motion.section>

            {/* Step 3: reason */}
            <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`${CARD} p-5 sm:p-6`}>
              <StepTitle n={3} title="Reason" done={!!leave.reason.trim()} error={errs.reason} />
              <div className="mb-2 flex flex-wrap gap-1.5">
                {(QUICK_REASONS[leave.leaveType] || QUICK_REASONS[""]).map((r) => (
                  <button key={r} type="button" onClick={() => addReason(r)}
                    className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200">
                    <Sparkles size={11} className="text-red-400" /> {r}
                  </button>
                ))}
              </div>
              <textarea
                rows={4}
                maxLength={REASON_MAX}
                value={leave.reason}
                onChange={(e) => setLeave(p => ({...p, reason: e.target.value}))}
                onBlur={() => setTouched((t) => ({ ...t, reason: true }))}
                placeholder="A short note for your manager…"
                className={`w-full resize-none rounded-2xl border-0 bg-white p-4 text-sm text-gray-900 ring-1 transition placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-400 ${errs.reason ? "ring-red-300" : "ring-gray-200 hover:ring-red-200"}`}
              />
              <div className="mt-1 flex justify-end">
                <span className={`text-[11px] tabular-nums ${leave.reason.length > REASON_MAX - 50 ? "text-amber-600" : "text-gray-400"}`}>{leave.reason.length}/{REASON_MAX}</span>
              </div>
            </motion.section>
          </div>

          {/* ================= RIGHT: SUMMARY ================= */}
          <div className="lg:col-span-5">
            <div className="space-y-4 lg:sticky lg:top-6">
              <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className={`${CARD} overflow-hidden`}>
                <div className={`relative p-5 text-white transition-colors sm:p-6 ${isInsufficient ? "bg-gradient-to-br from-red-700 to-red-600" : "bg-gradient-to-br from-red-600 via-rose-600 to-rose-500"}`}>
                  <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
                  <p className="relative text-[11px] font-semibold uppercase tracking-wider text-white/80">Total working days</p>
                  <div className="relative mt-1 flex items-end gap-2">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span key={daysCount} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -16, opacity: 0 }}
                        className="text-6xl font-extrabold leading-none tabular-nums">{daysCount}</motion.span>
                    </AnimatePresence>
                    <span className="pb-1.5 text-base font-bold">day{daysCount === 1 ? "" : "s"}</span>
                  </div>
                  <p className="relative mt-2 text-sm text-white/85">
                    {start && end ? `${fmtLong(start)}${sameDay(start, end) ? "" : ` → ${fmtLong(end)}`} · ${calDays} calendar day${calDays === 1 ? "" : "s"}` : "Pick your dates to see the count"}
                  </p>
                </div>

                <div className="space-y-3 p-5 sm:p-6">
                  <Row label="Type" value={type ? <span className="inline-flex items-center gap-1.5"><type.Icon size={14} className="text-red-500" />{type.label}</span> : <span className="text-gray-300">Not chosen</span>} />
                  <Row label="Requested by" value={user?.name || "—"} />
                  {type && (
                    <div className={`rounded-2xl p-3 ring-1 ${isInsufficient ? "bg-red-50 ring-red-100" : "bg-gray-50 ring-gray-100"}`}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-gray-600">Balance</span>
                        <span className="font-extrabold tabular-nums text-gray-900">
                          {typeBalance} <ArrowRight size={12} className="mx-1 inline text-gray-300" />
                          <span className={after < 0 ? "text-red-600" : "text-emerald-600"}>{after}</span>
                        </span>
                      </div>
                      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-white">
                        <div className={`h-full ${type.bar}`} style={{ width: `${Math.max(0, Math.min(100, ((typeBalance - daysCount) / ANNUAL_QUOTA) * 100))}%` }} />
                        <div className="h-full bg-red-300 [background-image:repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(255,255,255,.6)_3px,rgba(255,255,255,.6)_6px)]"
                          style={{ width: `${Math.max(0, Math.min(100, (Math.min(daysCount, typeBalance) / ANNUAL_QUOTA) * 100))}%` }} />
                      </div>
                      {isInsufficient && (
                        <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-700">
                          <AlertTriangle size={13} /> Requested days exceed available balance.
                        </p>
                      )}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    {loading ? "Sending…" : "Submit request"}
                  </button>
                  {blocker && <p className="text-center text-xs text-gray-400">{blocker}</p>}
                </div>
              </motion.section>

              {upcomingHolidays.length > 0 && (
                <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className={`${CARD} p-5`}>
                  <p className="mb-3 flex items-center gap-1.5 text-xs font-bold text-gray-700"><PartyPopper size={14} className="text-rose-500" /> Upcoming holidays — plan around them</p>
                  <div className="space-y-2">
                    {upcomingHolidays.map((h) => {
                      const d = new Date(h.date);
                      return (
                        <div key={h._id || h.date} className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 flex-col overflow-hidden rounded-xl bg-white text-center leading-none shadow-sm ring-1 ring-gray-100">
                            <span className="bg-gradient-to-r from-red-600 to-rose-500 py-0.5 text-[8px] font-bold uppercase text-white">{d.toLocaleDateString("en-IN", { month: "short" })}</span>
                            <span className="flex flex-1 items-center justify-center text-sm font-extrabold text-gray-900">{d.getDate()}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">{h.title}</p>
                            <p className="text-xs text-gray-400">{d.toLocaleDateString("en-IN", { weekday: "long" })}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.section>
              )}
              <p className="flex items-start gap-1.5 px-1 text-xs text-gray-400"><Info size={13} className="mt-px shrink-0" /> Balance counts approved leave only. Pending requests aren't deducted until approved.</p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ===== SUPPORTING COMPONENTS ===== */

const StepTitle = ({ n, title, done, error }) => (
  <div className="mb-4 flex items-center gap-3">
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold transition ${done ? "bg-emerald-500 text-white" : "bg-red-50 text-red-600"}`}>
      {done ? <Check size={15} strokeWidth={3} /> : n}
    </span>
    <h2 className="text-base font-bold text-gray-900">{title}</h2>
    {error && <span className="ml-auto text-xs font-semibold text-red-600">{error}</span>}
  </div>
);

const Row = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3 text-sm">
    <span className="text-gray-500">{label}</span>
    <span className="truncate font-bold text-gray-900">{value}</span>
  </div>
);

export default EmployeeLeaveAdd;