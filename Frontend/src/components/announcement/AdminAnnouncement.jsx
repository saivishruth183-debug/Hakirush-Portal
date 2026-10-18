import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Edit2, ImagePlus, Trash2, Megaphone, MapPin, Calendar, Loader2, AlertCircle, CheckCircle2,
  X, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Search, Send, Clock3, PlayCircle,
  Flag, RefreshCw, Image as ImageIcon, Sparkles, Repeat, CalendarRange,
} from "lucide-react";

const PAGE_BG =
  "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const CARD =
  "rounded-3xl bg-white/90 ring-1 ring-white/70 shadow-[0_10px_40px_-12px_rgba(127,29,29,0.18)] backdrop-blur";
const DESC_MAX = 500;
const MAX_IMAGE = 5 * 1024 * 1024;

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

/* ================= META ================= */
const STATUS_META = {
  Upcoming: { chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", Icon: Clock3, dot: "bg-emerald-500" },
  Ongoing: { chip: "bg-red-50 text-red-700 ring-red-200", Icon: PlayCircle, dot: "bg-red-500" },
  Completed: { chip: "bg-gray-100 text-gray-500 ring-gray-200", Icon: Flag, dot: "bg-gray-400" },
};
const TYPE_META = {
  Annual: { Icon: CalendarRange, hint: "Once a year" },
  Quarterly: { Icon: Repeat, hint: "Every quarter" },
};
const daysFromToday = (d) => {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  return Math.round((x - t) / 86400000);
};
const whenLabel = (d) => {
  const n = daysFromToday(d);
  if (isNaN(n)) return "";
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  return n > 0 ? `In ${n} days` : `${-n} days ago`;
};
const Highlight = ({ text = "", q }) => {
  const t = String(text ?? "");
  if (!q) return <>{t}</>;
  const i = t.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{t}</>;
  return <>{t.slice(0, i)}<mark className="rounded bg-red-100 px-0.5 text-red-700">{t.slice(i, i + q.length)}</mark>{t.slice(i + q.length)}</>;
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

/* ================= DELETE CONFIRMATION ================= */
const ConfirmDeleteAlert = ({ item, busy, onConfirm, onCancel }) => (
  <Modal onClose={onCancel} dismissable={!busy}>
    <div className="h-1.5 bg-gradient-to-r from-red-600 to-rose-400" />
    <button onClick={onCancel} disabled={busy} aria-label="Close"
      className="absolute right-4 top-5 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-40"><X size={17} /></button>
    <div className="p-7 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100"><AlertCircle size={30} /></div>
      <h3 className="text-xl font-extrabold tracking-tight text-gray-900">Delete this announcement?</h3>
      {item && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-gray-50 p-3 text-left ring-1 ring-gray-100">
          <Thumb src={item.image} className="h-12 w-12 rounded-xl" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-gray-900">{item.title}</p>
            <p className="truncate text-xs text-gray-500">{fmtDate(item.date)} · {item.venue}</p>
          </div>
        </div>
      )}
      <p className="mt-3 text-sm text-gray-500">It will be removed from every feed. This can't be undone.</p>
    </div>
    <div className="grid grid-cols-2 gap-2 px-7 pb-7">
      <button onClick={onCancel} disabled={busy}
        className="rounded-2xl bg-gray-100 py-3 text-sm font-bold text-gray-700 hover:bg-gray-200 disabled:opacity-50">Cancel</button>
      <button onClick={onConfirm} disabled={busy}
        className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 hover:brightness-110 disabled:opacity-60">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} {busy ? "Deleting…" : "Delete"}
      </button>
    </div>
  </Modal>
);

/* ================= TOAST ================= */
const Toast = ({ text, tone = "ok", onClose }) =>
  createPortal(
    <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
      className="fixed inset-x-0 bottom-5 z-[110] flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-2xl bg-gray-900 py-3 pl-4 pr-2 text-sm font-semibold text-white shadow-2xl">
        {tone === "ok" ? <CheckCircle2 size={18} className="text-emerald-400" /> : <AlertCircle size={18} className="text-red-400" />} {text}
        <button onClick={onClose} aria-label="Dismiss" className="rounded-lg p-1 text-white/60 hover:bg-white/10 hover:text-white"><X size={15} /></button>
      </div>
    </motion.div>,
    document.body
  );

/* ================= PIECES ================= */
const fmtDate = (d) => {
  const x = new Date(d);
  return isNaN(x) ? "—" : x.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const Thumb = ({ src, className = "" }) => {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    <img src={src} alt="" onError={() => setFailed(true)} className={`shrink-0 object-cover ${className}`} />
  ) : (
    <div className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-red-100 to-rose-200 text-red-500 ${className}`}><Megaphone size={18} /></div>
  );
};

const StatusChip = ({ status, light = false }) => {
  const m = STATUS_META[status] || STATUS_META.Upcoming;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${light ? "bg-white/95 text-gray-800 shadow" : `ring-1 ${m.chip}`}`}>
      {status === "Ongoing" ? <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" /></span> : <m.Icon size={12} />}
      {status}
    </span>
  );
};

const Segmented = ({ value, options, onChange, layoutId }) => (
  <div className="flex gap-1 rounded-2xl bg-gray-100/80 p-1">
    {options.map(({ value: v, label, Icon }) => (
      <button key={v} type="button" onClick={() => onChange(v)}
        className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-bold transition ${value === v ? "text-white" : "text-gray-500 hover:text-gray-800"}`}>
        {value === v && <motion.span layoutId={layoutId} className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 shadow-md shadow-red-600/25" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
        {Icon && <Icon size={13} className="relative" />}<span className="relative">{label}</span>
      </button>
    ))}
  </div>
);

/* ================= MAIN ================= */
const AdminAnnouncement = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "Annual",
    date: "",
    venue: "",
    status: "Upcoming",
    image: null,
  });

  // UI-only
  const [feedLoading, setFeedLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [published, setPublished] = useState(false);
  const [preview, setPreview] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [imageError, setImageError] = useState("");
  const [touched, setTouched] = useState({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const fileRef = useRef(null);

  const token = localStorage.getItem("token");

  const fetchAnnouncements = async () => {
    try {
      const { data } = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/announcements`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnnouncements(Array.isArray(data?.announcements) ? data.announcements : []);
    } catch { setError("Couldn't load announcements."); } finally { setFeedLoading(false); }
  };

  useEffect(() => { fetchAnnouncements(); }, []);

  // image preview URL
  useEffect(() => {
    if (!form.image) { setPreview(""); return; }
    const url = URL.createObjectURL(form.image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [form.image]);

  // auto-hide toasts
  useEffect(() => { if (!published) return; const t = setTimeout(() => setPublished(false), 3200); return () => clearTimeout(t); }, [published]);
  useEffect(() => { if (!showSuccess) return; const t = setTimeout(() => setShowSuccess(false), 3200); return () => clearTimeout(t); }, [showSuccess]);

  const pickImage = (file) => {
    setImageError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) { setImageError("Please choose an image file."); return; }
    if (file.size > MAX_IMAGE) { setImageError("Image is larger than 5 MB."); return; }
    setForm((f) => ({ ...f, image: file }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ title: true, date: true, venue: true });
    if (!form.title.trim() || !form.date || !form.venue.trim()) return;
    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) formData.append(k, v); });
      await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/announcements/add`, formData, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
      });
      setForm({ title: "", description: "", type: "Annual", date: "", venue: "", status: "Upcoming", image: null });
      setTouched({});
      setPublished(true);
      fetchAnnouncements();
    } catch { setError("Couldn't publish the announcement. Please try again."); } finally { setLoading(false); }
  };

  const confirmDelete = async () => {
    try {
      setDeleting(true);
      await axios.delete(`${import.meta.env.VITE_BACKEND_URL}/api/announcements/${deleteId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDeleteId(null);
      setShowSuccess(true);
      fetchAnnouncements();
    } catch { setDeleteId(null); setError("Couldn't delete the announcement. Please try again."); } finally { setDeleting(false); }
  };

  /* ---------- derived ---------- */
  const counts = {
    All: announcements.length,
    Upcoming: announcements.filter((a) => a.status === "Upcoming").length,
    Ongoing: announcements.filter((a) => a.status === "Ongoing").length,
    Completed: announcements.filter((a) => a.status === "Completed").length,
  };
  const q = query.trim().toLowerCase();
  const feed = announcements
    .filter((a) => filter === "All" || a.status === filter)
    .filter((a) => !q || [a.title, a.description, a.venue, a.type].some((v) => String(v || "").toLowerCase().includes(q)))
    .sort((a, b) => {
      // ongoing first, then upcoming soonest, then completed most recent
      const rank = { Ongoing: 0, Upcoming: 1, Completed: 2 };
      const r = (rank[a.status] ?? 1) - (rank[b.status] ?? 1);
      if (r) return r;
      return a.status === "Completed" ? new Date(b.date) - new Date(a.date) : new Date(a.date) - new Date(b.date);
    });
  const errs = {
    title: touched.title && !form.title.trim() ? "Add a title." : "",
    date: touched.date && !form.date ? "Pick the event date." : "",
    venue: touched.venue && !form.venue.trim() ? "Add a venue." : "",
  };
  const pickedDate = parseISO(form.date);
  const deleteTarget = announcements.find((a) => a._id === deleteId);
  const inputCls = (err) =>
    `w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm font-semibold text-gray-900 ring-1 transition placeholder:font-normal placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-400 ${err ? "ring-red-300" : "ring-gray-200 hover:ring-red-200"}`;

  return (
    <div className={`min-h-screen ${PAGE_BG} p-4 sm:p-6 lg:p-8`}>
      <AnimatePresence>
        {deleteId && <ConfirmDeleteAlert key="del" item={deleteTarget} busy={deleting} onConfirm={confirmDelete} onCancel={() => !deleting && setDeleteId(null)} />}
        {showSuccess && <Toast key="ok-del" text="Announcement deleted" onClose={() => setShowSuccess(false)} />}
        {published && <Toast key="ok-pub" text="Announcement published" onClose={() => setPublished(false)} />}
      </AnimatePresence>

      <div className="mx-auto max-w-[1400px]">
        {/* HEADER */}
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/30">
              <Megaphone size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">Announcements</h1>
              <p className="text-sm text-gray-500">Publish events and news for everyone.</p>
            </div>
          </div>
          <div className="flex gap-2">
            {["Upcoming", "Ongoing", "Completed"].map((s) => {
              const m = STATUS_META[s];
              return (
                <div key={s} className={`${CARD} flex items-center gap-2 px-3.5 py-2.5`}>
                  <span className={`h-2 w-2 rounded-full ${m.dot}`} />
                  <span className="text-lg font-extrabold tabular-nums text-gray-900">{feedLoading ? "–" : counts[s]}</span>
                  <span className="hidden text-xs font-semibold text-gray-500 sm:inline">{s}</span>
                </div>
              );
            })}
          </div>
        </header>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mb-6 flex items-center gap-3 rounded-2xl bg-red-50 p-3.5 text-sm text-red-700 ring-1 ring-red-100">
                <AlertCircle size={18} className="shrink-0" />
                <span className="flex-1 font-semibold">{error}</span>
                <button onClick={() => setError("")} aria-label="Dismiss" className="rounded-lg p-1 hover:bg-red-100"><X size={15} /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* ---------- COMPOSER ---------- */}
          <div className="xl:col-span-5">
            <div className="space-y-4 xl:sticky xl:top-6">
              <motion.form onSubmit={handleSubmit} noValidate initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className={`${CARD} overflow-hidden`}>
                <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600"><Sparkles size={16} /></div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">New announcement</h2>
                    <p className="text-xs text-gray-500">Fields marked * are required</p>
                  </div>
                </div>

                <div className="space-y-4 p-5 sm:p-6">
                  {/* title */}
                  <div>
                    <label htmlFor="ann-title" className="mb-1.5 block text-xs font-semibold text-gray-600">Title <span className="text-red-500">*</span></label>
                    <input id="ann-title" placeholder="E.G. ANNUAL SPORTS MEET" value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value.toUpperCase() })}
                      onBlur={() => setTouched((t) => ({ ...t, title: true }))}
                      className={`${inputCls(errs.title)} tracking-wide`} />
                    {errs.title && <p className="mt-1 text-xs font-semibold text-red-600">{errs.title}</p>}
                  </div>

                  {/* type + status */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-1.5 text-xs font-semibold text-gray-600">Type</p>
                      <Segmented layoutId="ann-type" value={form.type} onChange={(v) => setForm({ ...form, type: v })}
                        options={Object.entries(TYPE_META).map(([v, m]) => ({ value: v, label: v, Icon: m.Icon }))} />
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-semibold text-gray-600">Status</p>
                      <Segmented layoutId="ann-status" value={form.status} onChange={(v) => setForm({ ...form, status: v })}
                        options={["Upcoming", "Ongoing", "Completed"].map((v) => ({ value: v, label: v }))} />
                    </div>
                  </div>

                  {/* description */}
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label htmlFor="ann-desc" className="text-xs font-semibold text-gray-600">Description</label>
                      <span className={`text-[11px] tabular-nums ${form.description.length > DESC_MAX - 50 ? "text-amber-600" : "text-gray-400"}`}>{form.description.length}/{DESC_MAX}</span>
                    </div>
                    <textarea id="ann-desc" rows={3} maxLength={DESC_MAX} placeholder="What's happening, who should attend…"
                      value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className={`${inputCls(false)} resize-none font-normal`} />
                  </div>

                  {/* date + venue */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="ann-date" className="mb-1.5 block text-xs font-semibold text-gray-600">Date <span className="text-red-500">*</span></label>
                      <DatePicker id="ann-date" value={form.date}
                        onChange={(v) => { setForm({ ...form, date: v }); setTouched((t) => ({ ...t, date: true })); }}
                        onClose={() => setTouched((t) => ({ ...t, date: true }))}
                        placeholder="Event date" title="Event date" invalid={!!errs.date} />
                      {errs.date && <p className="mt-1 text-xs font-semibold text-red-600">{errs.date}</p>}
                    </div>
                    <div>
                      <label htmlFor="ann-venue" className="mb-1.5 block text-xs font-semibold text-gray-600">Venue <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <MapPin size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input id="ann-venue" placeholder="e.g. Main auditorium" value={form.venue}
                          onChange={(e) => setForm({ ...form, venue: e.target.value })}
                          onBlur={() => setTouched((t) => ({ ...t, venue: true }))}
                          className={`${inputCls(errs.venue)} h-[3.6rem] pl-10`} />
                      </div>
                      {errs.venue && <p className="mt-1 text-xs font-semibold text-red-600">{errs.venue}</p>}
                    </div>
                  </div>

                  {/* image */}
                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-gray-600">Cover image <span className="font-normal text-gray-400">(optional)</span></p>
                    {preview ? (
                      <div className="group relative overflow-hidden rounded-2xl ring-1 ring-gray-200">
                        <img src={preview} alt="cover preview" className="h-40 w-full object-cover" />
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-3 text-white">
                          <span className="truncate text-xs font-semibold">{form.image?.name} · {(form.image?.size / 1024 / 1024).toFixed(1)} MB</span>
                          <div className="flex shrink-0 gap-1.5">
                            <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg bg-white/20 px-2.5 py-1 text-xs font-bold backdrop-blur hover:bg-white/30">Change</button>
                            <button type="button" onClick={() => setForm({ ...form, image: null })} aria-label="Remove image" className="rounded-lg bg-white/20 p-1.5 backdrop-blur hover:bg-red-600"><Trash2 size={13} /></button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => fileRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={(e) => { e.preventDefault(); setDragOver(false); pickImage(e.dataTransfer.files?.[0]); }}
                        className={`flex h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed transition ${dragOver ? "border-red-400 bg-red-50" : "border-gray-200 bg-gray-50/60 hover:border-red-300 hover:bg-red-50/40"}`}>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-red-500 shadow-sm ring-1 ring-gray-100"><ImagePlus size={20} /></span>
                        <span className="text-sm font-semibold text-gray-700">{dragOver ? "Drop to upload" : "Click or drag an image here"}</span>
                        <span className="text-[11px] text-gray-400">PNG, JPG or WEBP · up to 5 MB</span>
                      </button>
                    )}
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { pickImage(e.target.files[0]); e.target.value = ""; }} />
                    {imageError && <p className="mt-1 text-xs font-semibold text-red-600">{imageError}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-3 border-t border-gray-100 bg-gray-50/60 px-5 py-4 sm:px-6">
                  <button type="button" disabled={loading}
                    onClick={() => { setForm({ title: "", description: "", type: "Annual", date: "", venue: "", status: "Upcoming", image: null }); setTouched({}); }}
                    className="rounded-2xl px-4 py-3 text-sm font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50">Clear</button>
                  <button type="submit" disabled={loading}
                    className="ml-auto flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60 sm:flex-none">
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {loading ? "Publishing…" : "Publish"}
                  </button>
                </div>
              </motion.form>

              {/* live preview */}
              <div>
                <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Preview</p>
                <div className={`${CARD} overflow-hidden`}>
                  <div className="relative h-28">
                    {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-red-600 via-rose-600 to-rose-500" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <div className="absolute left-3 top-3 flex gap-1.5">
                      <span className="rounded-full bg-gray-900/80 px-2.5 py-1 text-[11px] font-bold text-white">{form.type}</span>
                      <StatusChip status={form.status} light />
                    </div>
                  </div>
                  <div className="p-4">
                    <p className={`break-words font-extrabold tracking-tight ${form.title.trim() ? "text-gray-900" : "text-gray-300"}`}>{form.title.trim() || "YOUR TITLE"}</p>
                    <p className={`mt-1 line-clamp-2 text-sm ${form.description ? "text-gray-500" : "text-gray-300"}`}>{form.description || "Description will appear here."}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-gray-500">
                      <span className="flex items-center gap-1"><Calendar size={12} className="text-red-500" />{pickedDate ? fmtDate(pickedDate) : "Date"}</span>
                      <span className="flex items-center gap-1"><MapPin size={12} className="text-red-500" />{form.venue || "Venue"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ---------- FEED ---------- */}
          <div className="xl:col-span-7">
            <div className={`${CARD} mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center`}>
              <div className="-mx-1 overflow-x-auto px-1">
                <div className="flex w-max gap-1 rounded-2xl bg-gray-100/80 p-1">
                  {["All", "Upcoming", "Ongoing", "Completed"].map((s) => (
                    <button key={s} onClick={() => setFilter(s)}
                      className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition ${filter === s ? "text-white" : "text-gray-500 hover:text-gray-800"}`}>
                      {filter === s && <motion.span layoutId="ann-filter" className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 shadow-md shadow-red-600/25" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                      <span className="relative">{s}</span>
                      <span className={`relative rounded-full px-1.5 text-[11px] font-bold ${filter === s ? "bg-white/25" : "bg-white text-gray-500"}`}>{counts[s]}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative flex-1">
                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, venue…"
                  className="w-full rounded-2xl border-0 bg-gray-50 py-2.5 pl-10 pr-9 text-sm ring-1 ring-gray-200 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-400" />
                {query && <button onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={15} /></button>}
              </div>
            </div>

            {feedLoading ? (
              <div className="space-y-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className={`${CARD} flex animate-pulse flex-col overflow-hidden md:flex-row`}>
                    <div className="h-40 bg-gray-100 md:h-auto md:w-52" />
                    <div className="flex-1 space-y-3 p-5"><div className="h-4 w-20 rounded-full bg-gray-100" /><div className="h-5 w-2/3 rounded bg-gray-100" /><div className="h-3 w-full rounded bg-gray-50" /><div className="h-3 w-1/2 rounded bg-gray-50" /></div>
                  </div>
                ))}
              </div>
            ) : feed.length === 0 ? (
              <div className={`${CARD} flex flex-col items-center px-6 py-16 text-center`}>
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500 ring-1 ring-red-100"><Megaphone size={28} /></div>
                <p className="text-base font-bold text-gray-900">{announcements.length ? "Nothing matches" : "No announcements yet"}</p>
                <p className="mt-1 text-sm text-gray-500">{announcements.length ? "Try another search or status." : "Use the form to publish your first one."}</p>
                {announcements.length > 0 ? (
                  <button onClick={() => { setQuery(""); setFilter("All"); }} className="mt-5 rounded-2xl bg-gray-100 px-5 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-200">Show all</button>
                ) : error && (
                  <button onClick={() => { setFeedLoading(true); setError(""); fetchAnnouncements(); }} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-600/30"><RefreshCw size={15} /> Try again</button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence initial={false}>
                  {feed.map((item, i) => {
                    const done = item.status === "Completed";
                    const d = new Date(item.date);
                    return (
                      <motion.article key={item._id} layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ delay: i * 0.03 }}
                        className={`${CARD} group flex flex-col overflow-hidden transition hover:-translate-y-0.5 md:flex-row ${done ? "opacity-80" : ""}`}>
                        <div className="relative h-44 shrink-0 overflow-hidden md:h-auto md:w-52">
                          <Thumb src={item.image} className={`h-full w-full transition duration-700 group-hover:scale-105 ${done ? "grayscale" : ""}`} />
                          {!isNaN(d) && (
                            <div className="absolute left-3 top-3 flex h-14 w-12 flex-col overflow-hidden rounded-xl bg-white text-center leading-none shadow-lg">
                              <span className="bg-gradient-to-r from-red-600 to-rose-500 py-0.5 text-[9px] font-bold uppercase text-white">{d.toLocaleDateString("en-IN", { month: "short" })}</span>
                              <span className="flex flex-1 items-center justify-center text-lg font-extrabold text-gray-900">{d.getDate()}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col p-5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-2.5 py-1 text-[11px] font-bold text-white">
                              {React.createElement((TYPE_META[item.type] || TYPE_META.Annual).Icon, { size: 11 })} {item.type}
                            </span>
                            <StatusChip status={item.status} />
                            {!done && whenLabel(item.date) && <span className="ml-auto text-xs font-semibold text-gray-400">{whenLabel(item.date)}</span>}
                          </div>
                          <h3 className="mt-3 break-words text-lg font-extrabold leading-snug tracking-tight text-gray-900 group-hover:text-red-700"><Highlight text={item.title} q={q} /></h3>
                          {item.description && <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-gray-500"><Highlight text={item.description} q={q} /></p>}
                          <div className="min-h-4 flex-1" />
                          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                            <div className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-gray-500">
                              <span className="flex items-center gap-1"><Calendar size={13} className="text-red-500" />{fmtDate(item.date)}</span>
                              <span className="flex min-w-0 items-center gap-1"><MapPin size={13} className="shrink-0 text-red-500" /><span className="truncate"><Highlight text={item.venue} q={q} /></span></span>
                            </div>
                            <div className="flex gap-1.5">
                              <NavLink to={`/admin-dashboard/announcement/edit/${item._id}`} title="Edit"
                                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-bold text-gray-600 ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200">
                                <Edit2 size={14} /> Edit
                              </NavLink>
                              <button onClick={() => setDeleteId(item._id)} aria-label="Delete" title="Delete"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-gray-400 ring-1 ring-gray-200 transition hover:bg-red-600 hover:text-white hover:ring-red-600 active:scale-90">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.article>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnnouncement;