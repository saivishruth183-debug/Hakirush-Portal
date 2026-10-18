import React, { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, CalendarDays, ChevronLeft, ChevronRight, ChevronDown, FileSpreadsheet, Clock,
  ShieldAlert, RotateCcw, Hash, Briefcase, ArrowLeft, Download, X, Loader2, SearchX,
  CalendarRange, CheckCircle2, AlertTriangle, LogIn, LogOut,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";

const PAGE_SIZE_OPTIONS = [5, 8, 10, 15, 20];

const PAGE_BG =
  "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const CARD =
  "rounded-3xl bg-white/90 ring-1 ring-white/70 shadow-[0_10px_40px_-12px_rgba(127,29,29,0.18)] backdrop-blur";

/* ================= STATUS CONFIGURATION ================= */
const normalizeStatus = (status) => {
  if (!status) return "Unmarked";
  const s = status.toString().toLowerCase().replace(/\s+/g, "");
  if (s === "halfday") return "Half Day";
  if (s === "present") return "Present";
  if (s === "leave") return "Leave";
  if (s === "absent") return "Absent";
  return status;
};

const STATUS_META = {
  Present: { label: "Present", dot: "bg-emerald-500", stripe: "bg-white", chip: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
  "Half Day": { label: "Half day", dot: "bg-sky-500", stripe: "bg-sky-200", chip: "bg-sky-50 text-sky-700 ring-sky-100" },
  Leave: { label: "On leave", dot: "bg-amber-500", stripe: "bg-amber-300", chip: "bg-amber-50 text-amber-700 ring-amber-100" },
  Absent: { label: "Absent", dot: "bg-red-500", stripe: "bg-red-900/40", chip: "bg-red-50 text-red-700 ring-red-100" },
  Unmarked: { label: "Unmarked", dot: "bg-gray-300", stripe: "bg-white/0", chip: "bg-gray-100 text-gray-500 ring-gray-200" },
};

/* ================= UTILS ================= */
const formatLiveTimer = (row) => {
  if (!row?.checkIn) return "00:00:00";
  const endTime = row.checkOut
    ? new Date(row.checkOut)
    : row.isPaused
    ? new Date(row.pauseStartedAt)
    : new Date();

  const diffMs = endTime - new Date(row.checkIn) - (row.totalPausedMs || 0);
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const hoursToHHMMSS = (hours) => {
  if (hours == null || isNaN(hours)) return "00:00:00";
  const totalSeconds = Math.floor(hours * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const timeOf = (v) => (v ? new Date(v).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : null);
const monthLabel = (ym) => {
  const [y, m] = (ym || "").split("-").map(Number);
  return y && m ? new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "—";
};
const AVATAR_BG = ["from-red-500 to-rose-400", "from-violet-500 to-fuchsia-400", "from-sky-500 to-cyan-400", "from-amber-500 to-orange-400", "from-emerald-500 to-teal-400"];
const colorFor = (s = "") => AVATAR_BG[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_BG.length];
const initials = (name = "") => String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
const pageList = (totalPages, current) => {
  const t = totalPages || 1;
  if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1);
  const arr = [...new Set([1, t, current - 1, current, current + 1])].filter((p) => p >= 1 && p <= t).sort((a, b) => a - b);
  const out = [];
  arr.forEach((p, i) => { if (i && p - arr[i - 1] > 1) out.push("…" + i); out.push(p); });
  return out;
};

const DurationPill = ({ r }) => (
  <div className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 font-mono text-sm font-bold tabular-nums ring-1 ${r.isLive ? (r.isPaused ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-emerald-50 text-emerald-800 ring-emerald-200") : "bg-gray-50 text-gray-700 ring-gray-200"}`}>
    {r.isLive && !r.isPaused ? (
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
    ) : <Clock size={12} className="opacity-60" />}
    {r.runningTime || hoursToHHMMSS(r.workedHours)}
  </div>
);

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



const AdminAttendanceReport = () => {
  // local date (toISOString() is UTC and gives yesterday before 5:30 am IST)
  const today = toISO(new Date());
  const currentMonthStr = today.slice(0, 7); // "YYYY-MM"

  const [report, setReport] = useState({});
  const [holidayMap, setHolidayMap] = useState({});
  const [dataFilter, setDataFilter] = useState(today);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentPageByDate, setCurrentPageByDate] = useState({});
  const [itemsPerPage, setItemsPerPage] = useState(8);

  // Excel export state
  const [monthFilter, setMonthFilter] = useState(currentMonthStr);
  const [exporting, setExporting] = useState(false);
  // UI-only
  const [exportNote, setExportNote] = useState(null); // { tone, text }
  const [statusFilter, setStatusFilter] = useState("all");

  const navigate = useNavigate();

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (dataFilter) query.append("date", dataFilter);
      if (search) query.append("search", search);

      const res = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/api/attendance/report?${query.toString()}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );

      if (res.data.success) {
        const updated = {};
        const pageState = {};

        Object.entries(res.data.groupData || {}).forEach(([date, rows]) => {
          updated[date] = rows
            .sort((a, b) => a.employeeId.localeCompare(b.employeeId, undefined, { numeric: true }))
            .map((r) => ({
              ...r,
              isLive: date === today && !r.checkOut && r.checkIn,
              runningTime: date === today && r.checkIn ? formatLiveTimer(r) : null,
            }));
          pageState[date] = 1;
        });

        setHolidayMap(res.data.holidayMap || {});
        setCurrentPageByDate(pageState);
        setReport(updated);
      }
    } catch (error) {
      console.error("Error fetching report:", error);
    } finally {
      setLoading(false);
    }
  }, [dataFilter, search, today]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Live timer interval
  useEffect(() => {
    const interval = setInterval(() => {
      setReport((prev) => {
        const updated = { ...prev };
        if (updated[today]) {
          updated[today] = updated[today].map((r) =>
            r.isLive ? { ...r, runningTime: formatLiveTimer(r) } : r
          );
        }
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [today]);

  const clearSearch = () => {
    setSearch("");
    setSearchInput("");
    setDataFilter(today);
  };

  const handlePageSizeChange = (size) => {
    setItemsPerPage(size);
    // reset every date's page back to 1 so the new page size doesn't strand anyone mid-list
    setCurrentPageByDate((prev) => {
      const reset = {};
      Object.keys(prev).forEach((d) => { reset[d] = 1; });
      return reset;
    });
  };

  /* ================= EXCEL EXPORT (FULL MONTH) ================= */
  const exportMonthToExcel = async () => {
    if (!monthFilter) return;
    try {
      setExporting(true);
      setExportNote(null);
      const [year, month] = monthFilter.split("-");

      const query = new URLSearchParams();
      query.append("month", month);
      query.append("year", year);
      if (search) query.append("search", search);

      const res = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/api/attendance/report?${query.toString()}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );

      if (!res.data.success) {
        console.error("Export failed: server returned success=false");
        setExportNote({ tone: "error", text: "The server couldn't prepare this month's report." });
        return;
      }

      const holidays = res.data.holidayMap || {};
      const rows = [];

      // Sort dates chronologically so the sheet reads top-to-bottom by day
      const sortedDates = Object.keys(res.data.groupData || {}).sort();

      sortedDates.forEach((date) => {
        const records = res.data.groupData[date] || [];
        const d = new Date(date);
        const dayOfWeek = d.getDay();
        const isHoliday = !!holidays[date];
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        let offDayLabel = "";
        if (isHoliday) offDayLabel = holidays[date];
        else if (dayOfWeek === 0) offDayLabel = "Sunday (Weekend)";
        else if (dayOfWeek === 6) offDayLabel = "Saturday (Weekend)";

        if (isWeekend || isHoliday) {
          // Still list employees for the off-day, marked clearly, so the
          // sheet has one row per employee per day for the whole month.
          records
            .slice()
            .sort((a, b) => a.employeeId.localeCompare(b.employeeId, undefined, { numeric: true }))
            .forEach((r) => {
              rows.push({
                Date: date,
                "Employee ID": r.employeeId,
                Name: r.employeeName,
                Department: r.departmentName,
                Status: offDayLabel || "Holiday",
                "Worked Hours": 0,
                "Check In": "",
                "Check Out": "",
              });
            });
          return;
        }

        records
          .slice()
          .sort((a, b) => a.employeeId.localeCompare(b.employeeId, undefined, { numeric: true }))
          .forEach((r) => {
            rows.push({
              Date: date,
              "Employee ID": r.employeeId,
              Name: r.employeeName,
              Department: r.departmentName,
              Status: normalizeStatus(r.status),
              "Worked Hours": r.workedHours ?? 0,
              "Check In": r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : "",
              "Check Out": r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : "",
            });
          });
      });

      if (rows.length === 0) {
        console.warn("No attendance rows found for the selected month.");
      }

      const worksheet = XLSX.utils.json_to_sheet(rows);

      // Reasonable column widths so it's readable without manual resizing
      worksheet["!cols"] = [
        { wch: 12 }, // Date
        { wch: 14 }, // Employee ID
        { wch: 22 }, // Name
        { wch: 18 }, // Department
        { wch: 14 }, // Status
        { wch: 14 }, // Worked Hours
        { wch: 12 }, // Check In
        { wch: 12 }, // Check Out
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
      XLSX.writeFile(workbook, `Attendance_${monthFilter}.xlsx`);
      setExportNote(rows.length
        ? { tone: "ok", text: `Downloaded ${rows.length.toLocaleString("en-IN")} rows for ${monthLabel(monthFilter)}.` }
        : { tone: "warn", text: `No attendance found for ${monthLabel(monthFilter)}. An empty sheet was downloaded.` });
    } catch (error) {
      console.error("Error exporting Excel report:", error);
      setExportNote({ tone: "error", text: "Export failed. Please try again." });
    } finally {
      setExporting(false);
    }
  };

  /* ---------- UI helpers ---------- */
  const shiftDay = (n) => {
    const d = parseISO(dataFilter) || new Date();
    const next = toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
    if (next > today) return;
    setDataFilter(next);
  };
  const shiftMonth = (n) => {
    const [y, m] = monthFilter.split("-").map(Number);
    const d = new Date(y, m - 1 + n, 1);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (next > currentMonthStr) return;
    setMonthFilter(next);
  };
  useEffect(() => {
    if (!exportNote || exportNote.tone === "error") return;
    const t = setTimeout(() => setExportNote(null), 5000);
    return () => clearTimeout(t);
  }, [exportNote]);

  const entries = Object.entries(report);
  const hasFilters = !!search || dataFilter !== today;

  return (
    <div className={`min-h-screen ${PAGE_BG} pb-20 text-gray-900`}>
      <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">

        {/* HEADER */}
        <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <button
            onClick={() => navigate(-1)}
            className="group mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-gray-500 ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200"
          >
            <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" /> Back
          </button>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/30">
              <FileSpreadsheet size={26} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-500">Attendance</p>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                Report <span className="bg-gradient-to-r from-red-600 to-rose-500 bg-clip-text text-transparent">Archive</span>
              </h1>
              <p className="text-sm text-gray-500">Look up any day, or download a full month as Excel.</p>
            </div>
          </div>
        </motion.header>

        {/* FILTERS + EXPORT */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
          <form
            onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); }}
            className={`${CARD} flex flex-col gap-3 p-4 md:flex-row md:items-end`}
          >
            <div className="md:w-72">
              <p className="mb-1.5 text-xs font-semibold text-gray-600">Date</p>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => shiftDay(-1)} aria-label="Previous day"
                  className="flex h-[52px] w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-gray-500 ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200">
                  <ChevronLeft size={16} />
                </button>
                <div className="min-w-0 flex-1">
                  <DatePicker
                    id="report-date"
                    title="Report date"
                    value={dataFilter}
                    onChange={(v) => setDataFilter(v || today)}
                    max={today}
                    quick={(() => {
                      const t = new Date(); t.setHours(0, 0, 0, 0);
                      const add = (n) => new Date(t.getFullYear(), t.getMonth(), t.getDate() + n);
                      return [["Today", t], ["Yesterday", add(-1)], ["1 week ago", add(-7)], ["1st of month", new Date(t.getFullYear(), t.getMonth(), 1)]];
                    })()}
                    describe={(d) => `${d.toLocaleDateString("en-IN", { weekday: "long" })} · ${relativeLabel(d)}`}
                  />
                </div>
                <button type="button" onClick={() => shiftDay(1)} disabled={dataFilter >= today} aria-label="Next day"
                  className="flex h-[52px] w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-gray-500 ring-1 ring-gray-200 transition enabled:hover:text-red-600 enabled:hover:ring-red-200 disabled:opacity-40">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p className="mb-1.5 text-xs font-semibold text-gray-600">Employee</p>
              <div className="group relative flex items-center rounded-2xl bg-gray-50 px-4 ring-1 ring-gray-200 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-red-400">
                <Search size={17} className="text-gray-400 transition group-focus-within:text-red-500" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search by name or ID, then press Enter…"
                  className="w-full bg-transparent py-[15px] pl-3 text-sm font-medium text-gray-900 outline-none placeholder:text-gray-400"
                />
                {searchInput && (
                  <button type="button" onClick={() => { setSearchInput(""); if (search) setSearch(""); }} aria-label="Clear search"
                    className="rounded-full p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button type="submit"
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-6 py-[15px] text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:brightness-110 active:scale-[0.98] md:flex-none">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Search
              </button>
              {hasFilters && (
                <button onClick={clearSearch} type="button" title="Reset to today"
                  className="flex items-center justify-center rounded-2xl bg-white px-4 text-gray-500 ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200">
                  <RotateCcw size={18} />
                </button>
              )}
            </div>
          </form>

          {/* MONTHLY EXCEL EXPORT */}
          <div className={`${CARD} flex flex-col gap-3 p-4`}>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-600"><FileSpreadsheet size={13} className="text-emerald-600" /> Monthly Excel export</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex items-center rounded-2xl bg-white ring-1 ring-gray-200">
                <button type="button" onClick={() => shiftMonth(-1)} aria-label="Previous month" className="flex h-12 w-10 items-center justify-center rounded-l-2xl text-gray-500 transition hover:bg-red-50 hover:text-red-600">
                  <ChevronLeft size={16} />
                </button>
                <div className="flex min-w-[9.5rem] items-center justify-center gap-2 px-2 text-sm font-bold text-gray-900">
                  <CalendarRange size={15} className="text-emerald-600" /> {monthLabel(monthFilter)}
                </div>
                <button type="button" onClick={() => shiftMonth(1)} disabled={monthFilter >= currentMonthStr} aria-label="Next month"
                  className="flex h-12 w-10 items-center justify-center rounded-r-2xl text-gray-500 transition enabled:hover:bg-red-50 enabled:hover:text-red-600 disabled:opacity-30">
                  <ChevronRight size={16} />
                </button>
              </div>
              <button
                type="button"
                onClick={exportMonthToExcel}
                disabled={exporting}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {exporting ? "Exporting…" : "Download Excel"}
              </button>
            </div>
            {search && <p className="text-[11px] text-gray-400">Only includes employees matching "<b className="text-gray-600">{search}</b>".</p>}
            <AnimatePresence>
              {exportNote && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className={`flex items-start gap-1.5 rounded-xl px-3 py-2 text-xs font-medium ring-1 ${
                    exportNote.tone === "ok" ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : exportNote.tone === "warn" ? "bg-amber-50 text-amber-700 ring-amber-100" : "bg-red-50 text-red-700 ring-red-100"
                  }`}>
                  {exportNote.tone === "ok" ? <CheckCircle2 size={14} className="mt-px shrink-0" /> : <AlertTriangle size={14} className="mt-px shrink-0" />}
                  <span className="flex-1">{exportNote.text}</span>
                  <button type="button" onClick={() => setExportNote(null)} aria-label="Dismiss" className="opacity-60 hover:opacity-100"><X size={12} /></button>
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* CONTENT */}
        <div className="space-y-6">
          {loading && entries.length === 0 && (
            <div className={`${CARD} space-y-3 p-5`}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-4 rounded-2xl p-3">
                  <div className="h-10 w-10 rounded-2xl bg-gray-200" />
                  <div className="flex-1 space-y-2"><div className="h-3 w-40 rounded bg-gray-200" /><div className="h-2.5 w-24 rounded bg-gray-100" /></div>
                  <div className="h-7 w-24 rounded-xl bg-gray-100" />
                  <div className="h-6 w-20 rounded-full bg-gray-100" />
                </div>
              ))}
            </div>
          )}

          {entries.length === 0 && !loading && (
            <div className={`${CARD} flex flex-col items-center px-6 py-16 text-center`}>
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-300 ring-1 ring-gray-100"><SearchX size={22} /></div>
              <p className="text-sm font-bold text-gray-700">No records found for the selection</p>
              <p className="mt-1 text-xs text-gray-400">Try another date or clear the search.</p>
              {hasFilters && (
                <button onClick={clearSearch} className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-100">Reset to today</button>
              )}
            </div>
          )}

          {entries.map(([date, records]) => {
            const selectedDate = new Date(date);
            const dayOfWeek = selectedDate.getDay();
            const isSunday = dayOfWeek === 0;
            const isSaturday = dayOfWeek === 6;
            const holidayName = holidayMap[date];
            const isHoliday = !!holidayName;
            const isOffDay = isSunday || isSaturday || isHoliday;

            let offDayLabel = "";
            if (isHoliday) offDayLabel = holidayName;
            else if (isSunday) offDayLabel = "Sunday (Weekend)";
            else if (isSaturday) offDayLabel = "Saturday (Weekend)";

            /* per-day summary + status filter (UI only) */
            const counts = records.reduce((acc, r) => { const s = normalizeStatus(r.status); acc[s] = (acc[s] || 0) + 1; return acc; }, {});
            const totalDay = records.length;
            const pctOf = (n) => (totalDay ? (n / totalDay) * 100 : 0);
            const filtered = statusFilter === "all" ? records : records.filter((r) => normalizeStatus(r.status) === statusFilter);
            const totalWorked = records.reduce((sum, r) => sum + (Number(r.workedHours) || 0), 0);
            const liveNow = records.filter((r) => r.isLive).length;

            const currentPage = currentPageByDate[date] || 1;
            const totalPages = Math.ceil(filtered.length / itemsPerPage);
            const startIndex = (currentPage - 1) * itemsPerPage;
            const paginated = filtered.slice(startIndex, startIndex + itemsPerPage);
            const setPage = (p) => setCurrentPageByDate((prev) => ({ ...prev, [date]: p }));

            return (
              <motion.section key={date} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className={`${CARD} overflow-hidden`}>
                {/* DATE STRIP */}
                <div className="relative overflow-hidden bg-gradient-to-r from-red-600 via-rose-600 to-rose-500 px-5 py-4 text-white sm:px-6">
                  <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
                  <div className="relative flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 flex-col items-center justify-center rounded-2xl bg-white/15 leading-none ring-1 ring-white/25">
                        <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">{selectedDate.toLocaleDateString("en-IN", { month: "short" })}</span>
                        <span className="text-lg font-extrabold">{selectedDate.getDate()}</span>
                      </div>
                      <div>
                        <p className="text-base font-extrabold">
                          {selectedDate.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                        </p>
                        <p className="flex items-center gap-2 text-xs text-white/80">
                          {date === today && <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 font-semibold"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" /> Today</span>}
                          {!isOffDay && <>{totalDay} employees · {hoursToHHMMSS(totalWorked).slice(0, 5)} h logged{liveNow ? ` · ${liveNow} working now` : ""}</>}
                        </p>
                      </div>
                    </div>
                    {isOffDay && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-red-600 shadow">
                        <ShieldAlert size={13} /> {offDayLabel}
                      </span>
                    )}
                  </div>
                  {!isOffDay && totalDay > 0 && (
                    <div className="relative mt-3 flex h-1.5 overflow-hidden rounded-full bg-white/20">
                      {["Present", "Half Day", "Leave", "Absent"].map((s) => (
                        <motion.div key={s} className={`h-full ${STATUS_META[s].stripe}`} animate={{ width: `${pctOf(counts[s] || 0)}%` }} />
                      ))}
                    </div>
                  )}
                </div>

                {loading ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-300">
                    <Loader2 className="animate-spin" size={28} />
                    <p className="text-xs font-semibold text-gray-400">Loading records…</p>
                  </div>
                ) : isOffDay ? (
                  <div className="flex flex-col items-center px-6 py-14 text-center">
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 ring-1 ring-amber-100"><ShieldAlert size={26} /></div>
                    <h2 className="text-lg font-extrabold tracking-tight text-gray-900">{offDayLabel}</h2>
                    <p className="mt-1 text-xs text-gray-400">No attendance is recorded on this day.</p>
                  </div>
                ) : (
                  <>
                    {/* status chips */}
                    <div className="-mx-1 flex gap-2 overflow-x-auto border-b border-gray-100 px-5 py-3 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden">
                      {[["all", "All", totalDay], ...["Present", "Half Day", "Leave", "Absent", "Unmarked"].map((s) => [s, STATUS_META[s].label, counts[s] || 0])]
                        .filter(([v, , c]) => v === "all" || c > 0)
                        .map(([v, label, c]) => {
                          const active = statusFilter === v;
                          return (
                            <button key={v} onClick={() => { setStatusFilter(v); setPage(1); }}
                              className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${active ? "text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:text-red-600 hover:ring-red-200"}`}>
                              {active && <motion.span layoutId={`rep-chip-${date}`} className="absolute inset-0 rounded-full bg-gradient-to-r from-red-600 to-rose-500 shadow shadow-red-600/30" />}
                              {v !== "all" && <span className={`relative h-1.5 w-1.5 rounded-full ${STATUS_META[v].dot}`} />}
                              <span className="relative">{label}</span>
                              <span className={`relative rounded-full px-1.5 text-[10px] ${active ? "bg-white/25" : "bg-gray-100 text-gray-500"}`}>{c}</span>
                            </button>
                          );
                        })}
                    </div>

                    {/* DESKTOP TABLE */}
                    <div className="hidden md:block">
                      <table className="w-full table-auto border-collapse text-left">
                        <thead>
                          <tr className="bg-gray-50/70 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                            <th className="w-14 py-3 pl-5 pr-2 font-bold lg:pl-6">#</th>
                            <th className="px-3 py-3 font-bold">Employee</th>
                            <th className="px-3 py-3 font-bold">Department</th>
                            <th className="hidden px-3 py-3 font-bold lg:table-cell">In / Out</th>
                            <th className="px-3 py-3 font-bold">Duration</th>
                            <th className="w-px whitespace-nowrap py-3 pl-3 pr-5 text-right font-bold lg:pr-6">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {paginated.map((r, i) => {
                            const status = normalizeStatus(r.status);
                            const meta = STATUS_META[status] || STATUS_META.Unmarked;
                            return (
                              <motion.tr key={r.employeeId + i}
                                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}
                                className="group transition-colors hover:bg-red-50/40">
                                <td className="relative py-3.5 pl-5 pr-2 text-xs font-semibold tabular-nums text-gray-400 lg:pl-6">
                                  <span className={`absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full ${meta.dot}`} />
                                  {String(startIndex + i + 1).padStart(2, "0")}
                                </td>
                                <td className="max-w-0 px-3 py-3.5">
                                  <div className="flex items-center gap-3">
                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${colorFor(r.employeeName)} text-xs font-bold text-white shadow-md`}>
                                      {initials(r.employeeName)}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-bold text-gray-900 transition group-hover:text-red-700">{r.employeeName}</p>
                                      <p className="flex items-center gap-0.5 font-mono text-xs text-gray-400"><Hash size={10} />{r.employeeId}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="max-w-[12rem] px-3 py-3.5">
                                  <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                                    <Briefcase size={11} className="shrink-0" /> <span className="truncate">{r.departmentName || "—"}</span>
                                  </span>
                                </td>
                                <td className="hidden whitespace-nowrap px-3 py-3.5 text-xs lg:table-cell">
                                  {r.checkIn ? (
                                    <div className="space-y-0.5">
                                      <p className="flex items-center gap-1.5 font-semibold text-gray-700"><LogIn size={12} className="text-emerald-500" /> {timeOf(r.checkIn)}</p>
                                      <p className="flex items-center gap-1.5 text-gray-400"><LogOut size={12} className={r.checkOut ? "text-red-500" : ""} /> {timeOf(r.checkOut) || "—"}</p>
                                    </div>
                                  ) : <span className="text-gray-300">—</span>}
                                </td>
                                <td className="px-3 py-3.5">
                                  <DurationPill r={r} />
                                </td>
                                <td className="w-px whitespace-nowrap py-3.5 pl-3 pr-5 text-right lg:pr-6">
                                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${meta.chip}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} /> {meta.label}
                                  </span>
                                </td>
                              </motion.tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {paginated.length === 0 && <p className="py-10 text-center text-sm text-gray-400">No one with this status.</p>}
                    </div>

                    {/* MOBILE CARD VIEW */}
                    <div className="space-y-3 p-4 md:hidden">
                      {paginated.map((r, i) => {
                        const status = normalizeStatus(r.status);
                        const meta = STATUS_META[status] || STATUS_META.Unmarked;
                        return (
                          <div key={r.employeeId + i} className="relative overflow-hidden rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                            <span className={`absolute inset-y-0 left-0 w-1.5 ${meta.dot}`} />
                            <div className="flex items-start justify-between gap-3 pl-2">
                              <div className="flex min-w-0 items-center gap-3">
                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${colorFor(r.employeeName)} text-xs font-bold text-white shadow-md`}>
                                  {initials(r.employeeName)}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="truncate font-bold text-gray-900">{r.employeeName}</h4>
                                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                    <span className="inline-flex items-center gap-0.5 rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-gray-500"><Hash size={9} />{r.employeeId}</span>
                                    <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500"><Briefcase size={9} />{r.departmentName}</span>
                                  </div>
                                </div>
                              </div>
                              <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${meta.chip}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} /> {meta.label}
                              </span>
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pl-2 pt-3">
                              <span className="text-[11px] text-gray-400">{r.checkIn ? <>In {timeOf(r.checkIn)}{r.checkOut ? ` · Out ${timeOf(r.checkOut)}` : ""}</> : "No check-in"}</span>
                              <DurationPill r={r} />
                            </div>
                          </div>
                        );
                      })}
                      {paginated.length === 0 && <p className="py-8 text-center text-sm text-gray-400">No one with this status.</p>}
                    </div>

                    {/* PAGINATION */}
                    {filtered.length > 0 && (
                      <div className="flex flex-col items-center gap-3 border-t border-gray-100 bg-gray-50/50 p-4 sm:flex-row sm:justify-between sm:px-6">
                        <p className="text-xs text-gray-500">
                          Showing <b className="text-gray-900">{startIndex + 1}–{Math.min(startIndex + itemsPerPage, filtered.length)}</b> of <b className="text-gray-900">{filtered.length}</b>
                        </p>
                        <div className="flex items-center gap-1">
                          <button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} aria-label="Previous page"
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-gray-500 ring-1 ring-gray-200 transition enabled:hover:text-red-600 enabled:hover:ring-red-200 disabled:opacity-40">
                            <ChevronLeft size={16} />
                          </button>
                          {pageList(totalPages, currentPage).map((p) =>
                            typeof p === "string" ? <span key={p} className="px-1 text-gray-400">…</span> : (
                              <button key={p} onClick={() => setPage(p)}
                                className={`relative h-9 min-w-9 rounded-xl px-2 text-sm font-semibold transition ${p === currentPage ? "text-white" : "text-gray-600 hover:bg-white hover:text-red-600"}`}>
                                {p === currentPage && <motion.span layoutId={`rep-page-${date}`} className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 shadow shadow-red-600/30" />}
                                <span className="relative">{p}</span>
                              </button>
                            )
                          )}
                          <button disabled={currentPage === totalPages || totalPages === 0} onClick={() => setPage(currentPage + 1)} aria-label="Next page"
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-gray-500 ring-1 ring-gray-200 transition enabled:hover:text-red-600 enabled:hover:ring-red-200 disabled:opacity-40">
                            <ChevronRight size={16} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          Per page
                          <div className="flex rounded-xl bg-white p-0.5 ring-1 ring-gray-200">
                            {PAGE_SIZE_OPTIONS.map((size) => (
                              <button key={size} onClick={() => handlePageSizeChange(size)}
                                className={`rounded-lg px-2.5 py-1 font-semibold transition ${itemsPerPage === size ? "bg-red-50 text-red-600" : "text-gray-500 hover:text-gray-800"}`}>
                                {size}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </motion.section>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdminAttendanceReport;