import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Receipt, CheckCircle, Clock, XCircle, ArrowUpRight, FileText, Image as ImageIcon, Trash2,
  X, Loader2, Search, Plane, UtensilsCrossed, Laptop, Package, Wifi, MoreHorizontal, UploadCloud,
  AlertTriangle, CheckCircle2, Lock, ExternalLink, Wallet, BadgeIndianRupee, Inbox, CalendarDays,
  ChevronDown, ChevronLeft, ChevronRight, Clock3,
} from "lucide-react";
import { apiErrorMessage, authHeaders } from "../../utils/apiError";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "";

const PAGE_BG =
  "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const CARD =
  "rounded-3xl bg-white/90 ring-1 ring-white/70 shadow-[0_10px_40px_-12px_rgba(127,29,29,0.18)] backdrop-blur";

const CATEGORIES = [
  "Travel",
  "Client Lunches / Meals",
  "Equipment",
  "Office Supplies",
  "Internet / Utilities",
  "Other",
];

const CATEGORY_META = {
  Travel: { Icon: Plane, hint: "Flights, trains, cabs" },
  "Client Lunches / Meals": { Icon: UtensilsCrossed, hint: "Meals with clients" },
  Equipment: { Icon: Laptop, hint: "Devices, accessories" },
  "Office Supplies": { Icon: Package, hint: "Stationery, small items" },
  "Internet / Utilities": { Icon: Wifi, hint: "Data, phone, power" },
  Other: { Icon: MoreHorizontal, hint: "Anything else" },
};
const catIcon = (c) => (CATEGORY_META[c] || CATEGORY_META.Other).Icon;

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
            className={`z-[150] w-[19.5rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl bg-white shadow-[0_24px_60px_-12px_rgba(127,29,29,0.35)] ring-1 ring-gray-100 ${dropUp ? "origin-bottom-left" : "origin-top-left"}`}
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

/* ================= UI HELPERS ================= */
const STATUS_META = {
  Pending: { chip: "bg-amber-50 text-amber-700 ring-amber-200", strip: "bg-amber-400", Icon: Clock },
  Approved: { chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", strip: "bg-emerald-500", Icon: CheckCircle },
  Reimbursed: { chip: "bg-sky-50 text-sky-700 ring-sky-200", strip: "bg-sky-500", Icon: ArrowUpRight },
  Rejected: { chip: "bg-red-50 text-red-700 ring-red-200", strip: "bg-red-400", Icon: XCircle },
};
const metaFor = (s) => STATUS_META[s] || STATUS_META.Pending;
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmtDate = (d) => {
  if (!d) return "—";
  const x = new Date(d);
  return isNaN(x) ? String(d) : x.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};
const isImage = (url = "") => /\.(png|jpe?g|webp|gif|avif|bmp)(\?|#|$)/i.test(url) || /\/image\/upload\//.test(url);
const isPdf = (url = "") => /\.pdf(\?|#|$)/i.test(url);
const Highlight = ({ text = "", q }) => {
  const t = String(text ?? "");
  if (!q) return <>{t}</>;
  const i = t.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{t}</>;
  return <>{t.slice(0, i)}<mark className="rounded bg-red-100 px-0.5 text-red-700">{t.slice(i, i + q.length)}</mark>{t.slice(i + q.length)}</>;
};

const Modal = ({ children, onClose, dismissable = true, size = "max-w-md" }) => {
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
        className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-gray-100 ${size}`}>
        {children}
      </motion.div>
    </motion.div>,
    document.body
  );
};

const StatusChip = ({ status }) => {
  const m = metaFor(status);
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${m.chip}`}>
      <m.Icon size={12} /> {status || "Pending"}
    </span>
  );
};

const ReceiptThumb = ({ url, onOpen }) => {
  const [failed, setFailed] = useState(false);
  if (!url) return <span className="inline-flex items-center gap-1 text-xs text-gray-300"><FileText size={13} /> No bill</span>;
  const img = isImage(url) && !failed;
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }} title="View bill"
      className="group/r relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gray-50 ring-1 ring-gray-200 transition hover:ring-red-300">
      {img ? <img src={url} alt="bill" className="h-full w-full object-cover" onError={() => setFailed(true)} />
        : <span className="text-[9px] font-extrabold uppercase text-red-600">{isPdf(url) ? "PDF" : <ImageIcon size={15} />}</span>}
      <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition group-hover/r:opacity-100"><ExternalLink size={13} /></span>
    </button>
  );
};

const ReceiptViewer = ({ url, onClose }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const img = isImage(url) && !failed;
  return createPortal(
    <motion.div role="dialog" aria-modal="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] flex flex-col bg-slate-950/90 p-4 backdrop-blur" onClick={onClose}>
      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
        <a href={url} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/20"><ExternalLink size={15} /> Open in new tab</a>
        <button onClick={onClose} aria-label="Close" className="rounded-xl bg-white/10 p-2 text-white ring-1 ring-white/20 hover:bg-white/20"><X size={18} /></button>
      </div>
      <div className="flex flex-1 items-center justify-center p-2" onClick={(e) => e.stopPropagation()}>
        {img ? (
          <motion.img initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} src={url} alt="bill"
            onError={() => setFailed(true)} className="max-h-[82vh] max-w-full rounded-2xl object-contain shadow-2xl" />
        ) : isPdf(url) ? (
          <iframe title="bill" src={url} className="h-[82vh] w-full max-w-4xl rounded-2xl bg-white" />
        ) : (
          <div className="rounded-3xl bg-white p-8 text-center">
            <FileText size={36} className="mx-auto text-red-500" />
            <p className="mt-3 font-bold text-gray-900">Preview not available</p>
            <a href={url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-5 py-2.5 text-sm font-bold text-white"><ExternalLink size={15} /> Open bill</a>
          </div>
        )}
      </div>
    </motion.div>,
    document.body
  );
};

const EmployeeExpenses = () => {
  const [claims, setClaims] = useState([]);
  const [summary, setSummary] = useState({ totalSubmitted: 0, totalApproved: 0, totalReimbursed: 0 });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    title: "",
    category: "Travel",
    amount: "",
    date: toISO(new Date()), // local date (toISOString is UTC and can be yesterday in IST)
    description: "",
    receipt: null,
  });

  // UI-only
  const [preview, setPreview] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [viewer, setViewer] = useState(null);
  const [query, setQuery] = useState("");
  const [statusTab, setStatusTab] = useState("All");

  const resetForm = () => {
    setFormData({
      title: "",
      category: "Travel",
      amount: "",
      date: toISO(new Date()),
      description: "",
      receipt: null,
    });
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const fetchClaims = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${BACKEND}/api/expenses/me`, {
        headers: authHeaders(),
      });
      if (res.data.success) {
        setClaims(res.data.claims || []);
        setSummary({
          totalSubmitted: res.data.totalSubmitted || 0,
          totalApproved: res.data.totalApproved || 0,
          totalReimbursed: res.data.totalReimbursed || 0,
        });
      }
    } catch (err) {
      console.error("Failed to load expense claims:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, []);

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(""), 3500);
    return () => clearTimeout(t);
  }, [successMsg]);

  // receipt preview URL (UI only)
  useEffect(() => {
    const f = formData.receipt;
    if (!f || !f.type?.startsWith("image/")) { setPreview(""); return; }
    const url = URL.createObjectURL(f);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [formData.receipt]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!formData.title.trim() || !formData.amount || Number(formData.amount) < 1 || !formData.date) {
      setError("Please fill in the title, amount and date.");
      return;
    }

    if (!formData.receipt) {
      setError("Please upload a bill or receipt photo.");
      return;
    }

    setSubmitting(true);

    try {
      const data = new FormData();
      data.append("title", formData.title);
      data.append("category", formData.category);
      data.append("amount", formData.amount);
      data.append("date", formData.date);
      data.append("description", formData.description);
      data.append("receipt", formData.receipt);

      const res = await axios.post(`${BACKEND}/api/expenses`, data, {
        headers: {
          ...authHeaders(),
          "Content-Type": "multipart/form-data",
        },
      });

      if (res.data.success) {
        setSuccessMsg(res.data.message || "Expense claim submitted successfully!");
        setIsModalOpen(false);
        resetForm();
        fetchClaims();
      }
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to submit expense claim"));
    } finally {
      setSubmitting(false);
    }
  };

  // confirmation now happens in the styled modal before this runs
  const handleDelete = async (claimId) => {
    try {
      setDeleting(true);
      const res = await axios.delete(`${BACKEND}/api/expenses/${claimId}`, {
        headers: authHeaders(),
      });
      if (res.data.success) {
        setSuccessMsg("Expense claim deleted successfully.");
        setDeleteTarget(null);
        fetchClaims();
      }
    } catch (err) {
      setDeleteTarget(null);
      setErrorMsg(apiErrorMessage(err, "Failed to delete expense claim"));
    } finally {
      setDeleting(false);
    }
  };

  const pickFile = (file) => {
    if (!file) return;
    setError("");
    setFormData((f) => ({ ...f, receipt: file }));
  };
  const closeModal = () => { if (submitting) return; setIsModalOpen(false); resetForm(); };

  /* ---------- derived (UI only) ---------- */
  const pendingTotal = claims.filter((c) => c.status !== "Approved" && c.status !== "Reimbursed" && c.status !== "Rejected").reduce((s, c) => s + (c.amount || 0), 0);
  const STATUSES = ["All", "Pending", "Approved", "Reimbursed", "Rejected"];
  const isPendingLike = (c) => !["Approved", "Reimbursed", "Rejected"].includes(c.status);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, s === "All" ? claims.length : s === "Pending" ? claims.filter(isPendingLike).length : claims.filter((c) => c.status === s).length]));
  const q = query.trim().toLowerCase();
  const visible = claims
    .filter((c) => statusTab === "All" || (statusTab === "Pending" ? isPendingLike(c) : c.status === statusTab))
    .filter((c) => !q || [c.title, c.description, c.category].some((v) => String(v || "").toLowerCase().includes(q)));
  const amountNum = Number(formData.amount) || 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const fileKB = formData.receipt ? formData.receipt.size / 1024 : 0;

  return (
    <div className={`min-h-screen ${PAGE_BG}`}>
      {/* toast */}
      {createPortal(
        <AnimatePresence>
          {successMsg && (
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
              className="fixed inset-x-0 bottom-5 z-[110] flex justify-center px-4">
              <div className="flex items-center gap-3 rounded-2xl bg-gray-900 py-3 pl-4 pr-2 text-sm font-semibold text-white shadow-2xl">
                <CheckCircle2 size={18} className="text-emerald-400" /> {successMsg}
                <button onClick={() => setSuccessMsg("")} aria-label="Dismiss" className="rounded-lg p-1 text-white/60 hover:bg-white/10 hover:text-white"><X size={15} /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">
        {/* HEADER */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/30">
              <Receipt size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">My expenses</h1>
              <p className="text-sm text-gray-500">Approved claims are added to your next payslip automatically.</p>
            </div>
          </div>
          <button onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98]">
            <Plus size={17} strokeWidth={2.5} /> New expense claim
          </button>
        </header>

        {/* STATS */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="relative col-span-2 overflow-hidden rounded-3xl bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 p-5 text-white shadow-xl shadow-red-600/25 lg:col-span-1">
            <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/15 blur-2xl" />
            <p className="relative flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/80"><BadgeIndianRupee size={13} /> Coming in next payslip</p>
            <p className="relative mt-2 text-3xl font-extrabold tabular-nums">{loading ? "–" : inr(summary.totalApproved)}</p>
            <p className="relative mt-1 text-sm text-white/85">Approved and ready for payroll</p>
          </motion.div>
          {[
            { label: "Total submitted", value: inr(summary.totalSubmitted), sub: `${claims.length} claim${claims.length === 1 ? "" : "s"} filed`, Icon: Receipt, tone: "bg-red-50 text-red-600", tab: "All" },
            { label: "Waiting for review", value: inr(pendingTotal), sub: `${counts.Pending} pending`, Icon: Clock3, tone: "bg-amber-50 text-amber-600", tab: "Pending" },
            { label: "Paid to you", value: inr(summary.totalReimbursed), sub: "In past payslips", Icon: Wallet, tone: "bg-sky-50 text-sky-600", tab: "Reimbursed" },
          ].map((s, i) => (
            <motion.button type="button" key={s.label} onClick={() => setStatusTab(s.tab)}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * (i + 1) }}
              className={`${CARD} p-4 text-left transition hover:-translate-y-0.5 sm:p-5 ${statusTab === s.tab && s.tab !== "All" ? "ring-2 ring-red-300" : ""}`}>
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.tone}`}><s.Icon size={17} /></div>
              <p className="mt-3 truncate text-xl font-extrabold tabular-nums text-gray-900 sm:text-2xl">{loading ? "–" : s.value}</p>
              <p className="text-xs font-semibold text-gray-500">{s.label}</p>
              <p className="text-[11px] text-gray-400">{s.sub}</p>
            </motion.button>
          ))}
        </div>

        {/* LIST */}
        <div className={`${CARD} overflow-hidden`}>
          <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="-mx-1 overflow-x-auto px-1">
              <div className="flex w-max gap-1 rounded-2xl bg-gray-100/80 p-1">
                {STATUSES.map((st) => (
                  <button key={st} onClick={() => setStatusTab(st)}
                    className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition ${statusTab === st ? "text-white" : "text-gray-500 hover:text-gray-800"}`}>
                    {statusTab === st && <motion.span layoutId="myexp-tab" className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 shadow-md shadow-red-600/25" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                    <span className="relative">{st}</span>
                    <span className={`relative rounded-full px-1.5 text-[11px] font-bold ${statusTab === st ? "bg-white/25" : "bg-white text-gray-500"}`}>{counts[st]}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="relative w-full lg:w-80">
              <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, category…"
                className="w-full rounded-2xl border-0 bg-gray-50 py-2.5 pl-10 pr-9 text-sm text-gray-900 ring-1 ring-gray-200 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-400" />
              {query && <button onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={15} /></button>}
            </div>
          </div>

          {loading ? (
            <div className="divide-y divide-gray-50">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-4 px-5 py-4">
                  <div className="h-10 w-10 rounded-2xl bg-gray-100" />
                  <div className="flex-1 space-y-2"><div className="h-4 w-1/4 rounded bg-gray-100" /><div className="h-3 w-1/6 rounded bg-gray-50" /></div>
                  <div className="h-6 w-20 rounded-full bg-gray-100" />
                </div>
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500 ring-1 ring-red-100">{claims.length ? <Inbox size={28} /> : <Receipt size={28} />}</div>
              <p className="text-base font-bold text-gray-900">{claims.length ? "No claims match" : "No expense claims filed yet"}</p>
              <p className="mt-1 max-w-sm text-sm text-gray-500">{claims.length ? "Try another search or status." : "Upload bills for travel, client lunches, or equipment to get reimbursed."}</p>
              {claims.length ? (
                <button onClick={() => { setQuery(""); setStatusTab("All"); }} className="mt-5 rounded-2xl bg-gray-100 px-5 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-200">Show all</button>
              ) : (
                <button onClick={() => setIsModalOpen(true)} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-600/30"><Plus size={16} /> File your first claim</button>
              )}
            </div>
          ) : (
            <>
              {/* MOBILE */}
              <div className="space-y-3 p-4 lg:hidden">
                {visible.map((c) => {
                  const m = metaFor(c.status);
                  const CIcon = catIcon(c.category);
                  return (
                    <motion.div key={c._id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="relative overflow-hidden rounded-2xl bg-white p-4 ring-1 ring-gray-100">
                      <span className={`absolute inset-y-0 left-0 w-1 ${m.strip}`} />
                      <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600"><CIcon size={18} /></span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-gray-900"><Highlight text={c.title} q={q} /></p>
                          <p className="truncate text-xs text-gray-500">{c.category} · {fmtDate(c.date)}</p>
                        </div>
                        <p className="text-lg font-extrabold tabular-nums text-gray-900">{inr(c.amount)}</p>
                      </div>
                      {c.description && <p className="mt-2 line-clamp-2 text-xs text-gray-500">{c.description}</p>}
                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-50 pt-3">
                        <div className="flex items-center gap-2">
                          <ReceiptThumb url={c.receiptUrl} onOpen={() => setViewer(c.receiptUrl)} />
                          <StatusChip status={c.status} />
                        </div>
                        {c.status !== "Reimbursed" ? (
                          <button onClick={() => setDeleteTarget(c)} aria-label="Delete claim"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-gray-400 ring-1 ring-gray-200 hover:bg-red-600 hover:text-white hover:ring-red-600"><Trash2 size={15} /></button>
                        ) : <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400"><Lock size={12} /> Locked</span>}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* DESKTOP */}
              <div className="hidden lg:block">
                <table className="w-full table-auto border-collapse text-left">
                  <thead>
                    <tr className="bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      <th className="py-3 pl-6 pr-3">Expense</th>
                      <th className="px-3 py-3">Category</th>
                      <th className="px-3 py-3">Date</th>
                      <th className="px-3 py-3 text-right">Amount</th>
                      <th className="px-3 py-3">Bill</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="w-px whitespace-nowrap py-3 pl-3 pr-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {visible.map((c, i) => {
                      const m = metaFor(c.status);
                      const CIcon = catIcon(c.category);
                      return (
                        <motion.tr key={c._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="group transition hover:bg-red-50/40">
                          <td className="relative max-w-0 py-3.5 pl-6 pr-3 xl:w-[32%]">
                            <span className={`absolute inset-y-2 left-0 w-1 rounded-r-full ${m.strip}`} />
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600"><CIcon size={17} /></span>
                              <div className="min-w-0">
                                <p className="truncate font-bold text-gray-900 group-hover:text-red-700" title={c.title}><Highlight text={c.title} q={q} /></p>
                                {c.description && <p className="truncate text-xs text-gray-500" title={c.description}>{c.description}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3.5"><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600"><Highlight text={c.category} q={q} /></span></td>
                          <td className="whitespace-nowrap px-3 py-3.5 text-sm text-gray-500">{fmtDate(c.date)}</td>
                          <td className="whitespace-nowrap px-3 py-3.5 text-right text-base font-extrabold tabular-nums text-gray-900">{inr(c.amount)}</td>
                          <td className="px-3 py-3.5"><ReceiptThumb url={c.receiptUrl} onOpen={() => setViewer(c.receiptUrl)} /></td>
                          <td className="px-3 py-3.5"><StatusChip status={c.status} /></td>
                          <td className="w-px whitespace-nowrap py-3.5 pl-3 pr-6 text-right">
                            {c.status !== "Reimbursed" ? (
                              <button onClick={() => setDeleteTarget(c)} title="Delete this claim" aria-label="Delete this claim"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-gray-400 ring-1 ring-gray-200 transition hover:bg-red-600 hover:text-white hover:ring-red-600 active:scale-90"><Trash2 size={15} /></button>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-400"><Lock size={11} /> Locked</span>
                            )}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-gray-100 px-6 py-3 text-sm text-gray-500">
                {visible.length} claim{visible.length === 1 ? "" : "s"} · total <b className="text-gray-900">{inr(visible.reduce((s, c) => s + (c.amount || 0), 0))}</b>
              </div>
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {/* ================= CLAIM FORM ================= */}
        {isModalOpen && (
          <Modal key="form" onClose={closeModal} dismissable={!submitting} size="max-w-2xl">
            <div className="relative shrink-0 bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 px-6 pb-5 pt-6 text-white">
              <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
              <button onClick={closeModal} disabled={submitting} aria-label="Close"
                className="absolute right-4 top-4 rounded-full bg-white/15 p-1.5 ring-1 ring-white/25 hover:bg-white/25 disabled:opacity-40"><X size={16} /></button>
              <p className="relative flex items-center gap-2 text-lg font-extrabold"><Receipt size={18} /> File expense claim</p>
              <p className="relative text-sm text-white/80">Fields marked * are required</p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
              <div className="space-y-5 overflow-y-auto p-6">
                {error && (
                  <p className="flex items-start gap-2 rounded-2xl bg-red-50 p-3 text-xs font-semibold text-red-700 ring-1 ring-red-100">
                    <AlertTriangle size={14} className="mt-px shrink-0" />{error}
                  </p>
                )}

                <div>
                  <label htmlFor="ex-title" className="mb-1.5 block text-xs font-semibold text-gray-600">Expense title <span className="text-red-500">*</span></label>
                  <input id="ex-title" type="text" required autoFocus
                    placeholder="e.g. Flight ticket to Bangalore client meeting"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm font-semibold text-gray-900 ring-1 ring-gray-200 placeholder:font-normal placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-400" />
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-semibold text-gray-600">Category <span className="text-red-500">*</span></p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {CATEGORIES.map((cat) => {
                      const on = formData.category === cat;
                      const { Icon, hint } = CATEGORY_META[cat];
                      return (
                        <button key={cat} type="button" onClick={() => setFormData({ ...formData, category: cat })}
                          className={`flex items-center gap-2.5 rounded-2xl p-3 text-left transition ${on ? "bg-red-50 ring-2 ring-red-400" : "bg-white ring-1 ring-gray-200 hover:ring-red-200"}`}>
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${on ? "bg-gradient-to-br from-red-600 to-rose-500 text-white" : "bg-gray-50 text-gray-500"}`}><Icon size={16} /></span>
                          <span className="min-w-0">
                            <span className={`block truncate text-xs font-bold ${on ? "text-red-700" : "text-gray-800"}`}>{cat}</span>
                            <span className="block truncate text-[10px] text-gray-400">{hint}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="ex-amount" className="mb-1.5 block text-xs font-semibold text-gray-600">Amount <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-extrabold text-gray-400">₹</span>
                      <input id="ex-amount" type="number" required min="1" inputMode="decimal" placeholder="2500"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="h-[3.6rem] w-full rounded-2xl border-0 bg-white pl-9 pr-4 text-xl font-extrabold tabular-nums text-gray-900 ring-1 ring-gray-200 placeholder:font-normal placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                    </div>
                    {amountNum > 0 && <p className="mt-1 text-xs text-gray-400">{inr(amountNum)}</p>}
                  </div>
                  <div>
                    <label htmlFor="ex-date" className="mb-1.5 block text-xs font-semibold text-gray-600">Expense date <span className="text-red-500">*</span></label>
                    <DatePicker id="ex-date" value={formData.date} onChange={(v) => setFormData({ ...formData, date: v })}
                      max={toISO(today)} title="Expense date" placeholder="When did you spend?"
                      quick={[["Today", today], ["Yesterday", addDays(today, -1)], ["2 days ago", addDays(today, -2)]]} />
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-semibold text-gray-600">Bill / receipt <span className="text-red-500">*</span></p>
                  {formData.receipt ? (
                    <div className="flex items-center gap-3 rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-200">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-gray-100">
                        {preview ? <img src={preview} alt="receipt preview" className="h-full w-full object-cover" /> : <span className="text-xs font-extrabold text-red-600">PDF</span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-gray-900">{formData.receipt.name}</p>
                        <p className="text-xs text-gray-400">{fileKB > 1024 ? `${(fileKB / 1024).toFixed(1)} MB` : `${Math.round(fileKB)} KB`}</p>
                      </div>
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-gray-700 ring-1 ring-gray-200 hover:text-red-600 hover:ring-red-200">Change</button>
                      <button type="button" onClick={() => { setFormData({ ...formData, receipt: null }); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                        aria-label="Remove file" className="rounded-xl p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
                      className={`flex h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed transition ${dragOver ? "border-red-400 bg-red-50" : "border-gray-200 bg-gray-50/60 hover:border-red-300 hover:bg-red-50/40"}`}>
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-red-500 shadow-sm ring-1 ring-gray-100"><UploadCloud size={20} /></span>
                      <span className="text-sm font-semibold text-gray-700">{dragOver ? "Drop to attach" : "Click or drag your bill here"}</span>
                      <span className="text-[11px] text-gray-400">Photo or PDF</span>
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => pickFile(e.target.files[0] || null)}
                  />
                </div>

                <div>
                  <label htmlFor="ex-desc" className="mb-1.5 block text-xs font-semibold text-gray-600">Notes <span className="font-normal text-gray-400">(optional)</span></label>
                  <textarea id="ex-desc" rows="2" placeholder="Additional context or purpose of expenditure"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full resize-none rounded-2xl border-0 bg-white p-3 text-sm text-gray-900 ring-1 ring-gray-200 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-400" />
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3 border-t border-gray-100 bg-gray-50/60 p-4">
                <p className="hidden flex-1 text-sm text-gray-500 sm:block">
                  {amountNum > 0 ? <>Claiming <b className="text-gray-900">{inr(amountNum)}</b> for {formData.category.toLowerCase()}</> : "Enter an amount to continue"}
                </p>
                <button type="button" onClick={closeModal} disabled={submitting}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={submitting}
                  className="ml-auto flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:brightness-110 disabled:opacity-60 sm:ml-0 sm:flex-none">
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} {submitting ? "Submitting…" : "Submit claim"}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* ================= DELETE CONFIRM ================= */}
        {deleteTarget && (
          <Modal key="del" onClose={() => !deleting && setDeleteTarget(null)} dismissable={!deleting} size="max-w-sm">
            <div className="h-1.5 bg-gradient-to-r from-red-600 to-rose-400" />
            <div className="p-7 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100"><Trash2 size={28} /></div>
              <h3 className="text-xl font-extrabold tracking-tight text-gray-900">Delete this claim?</h3>
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-gray-50 p-3 text-left ring-1 ring-gray-100">
                {React.createElement(catIcon(deleteTarget.category), { size: 18, className: "shrink-0 text-red-500" })}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-gray-900">{deleteTarget.title}</p>
                  <p className="truncate text-xs text-gray-500">{deleteTarget.category} · {fmtDate(deleteTarget.date)}</p>
                </div>
                <span className="text-sm font-extrabold tabular-nums text-gray-900">{inr(deleteTarget.amount)}</span>
              </div>
              <p className={`mt-3 text-sm ${deleteTarget.status === "Approved" ? "font-semibold text-red-600" : "text-gray-500"}`}>
                {deleteTarget.status === "Approved" ? "It's already approved — deleting removes it from your next payslip. " : ""}This cannot be undone.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 px-7 pb-7">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="rounded-2xl bg-gray-100 py-3 text-sm font-bold text-gray-700 hover:bg-gray-200 disabled:opacity-50">Cancel</button>
              <button onClick={() => handleDelete(deleteTarget._id)} disabled={deleting}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 hover:brightness-110 disabled:opacity-60">
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </Modal>
        )}

        {errorMsg && (
          <Modal key="err" onClose={() => setErrorMsg("")} size="max-w-sm">
            <div className="h-1.5 bg-gradient-to-r from-red-600 to-rose-400" />
            <div className="p-7 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100"><AlertTriangle size={28} /></div>
              <h3 className="text-xl font-extrabold tracking-tight text-gray-900">Something went wrong</h3>
              <p className="mt-2 text-sm text-gray-500">{errorMsg}</p>
              <button onClick={() => setErrorMsg("")} className="mt-6 w-full rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 hover:brightness-110">Got it</button>
            </div>
          </Modal>
        )}

        {viewer && <ReceiptViewer key="viewer" url={viewer} onClose={() => setViewer(null)} />}
      </AnimatePresence>
    </div>
  );
};

export default EmployeeExpenses;