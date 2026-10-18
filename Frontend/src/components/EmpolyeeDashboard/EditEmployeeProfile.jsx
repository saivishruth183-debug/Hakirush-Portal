import axios from "axios";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiErrorCode, apiErrorMessage } from "../../utils/apiError";
import {
  User, Calendar, Briefcase, Heart, Droplets,
  Fingerprint, CreditCard, PiggyBank, Camera, Check, X, Globe,
  CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Loader2, Undo2, RotateCcw, Lock,
  AlertTriangle, CheckCircle2, Save, ShieldCheck, Trash2, Info,
} from "lucide-react";

const PAGE_BG =
  "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const CARD =
  "rounded-3xl bg-white/90 ring-1 ring-white/70 shadow-[0_10px_40px_-12px_rgba(127,29,29,0.18)] backdrop-blur";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // matches server limit (5MB)

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

/* ================= CONFIRMATION DIALOG ================= */
const ConfirmDialog = ({ onClose, changed }) => (
  <Modal dismissable={false}>
    <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400" />
    <div className="p-7 text-center">
      <motion.div initial={{ scale: 0.4, rotate: -15 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}
        className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
        <CheckCircle2 size={30} />
      </motion.div>
      <h3 className="text-xl font-extrabold tracking-tight text-gray-900">Profile updated</h3>
      <p className="mt-2 text-sm text-gray-500">Your details have been saved successfully.</p>
      {changed.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {changed.map((c) => <span key={c} className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600">{c}</span>)}
        </div>
      )}
      <button onClick={onClose}
        className="mt-6 w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 hover:brightness-110">
        Return to profile
      </button>
    </div>
  </Modal>
);

const LeaveConfirm = ({ count, onStay, onLeave }) => (
  <Modal onClose={onStay}>
    <div className="h-1.5 bg-gradient-to-r from-amber-400 to-orange-400" />
    <div className="p-7 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100"><AlertTriangle size={28} /></div>
      <h3 className="text-xl font-extrabold tracking-tight text-gray-900">Discard your changes?</h3>
      <p className="mt-2 text-sm text-gray-500">You have {count} unsaved change{count === 1 ? "" : "s"}. They'll be lost if you leave now.</p>
    </div>
    <div className="grid grid-cols-2 gap-2 px-7 pb-7">
      <button onClick={onStay} className="rounded-2xl bg-gray-100 py-3 text-sm font-bold text-gray-700 hover:bg-gray-200">Keep editing</button>
      <button onClick={onLeave} className="rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 hover:brightness-110">Discard</button>
    </div>
  </Modal>
);

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const MARITAL = ["Single", "Married", "Divorced"];
const AADHAAR_RE = /^\d{12}$/;
const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/i;

const EditEmployeeProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState(null);
  const [name, setName] = useState("");
  const [experience, setExperience] = useState("");
  const [dob, setDob] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("");

  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState("/default-avatar.png");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  const [aadharcard, setAadharcard] = useState("");
  const [pancard, setPancard] = useState("");
  const [pfNumber, setPfNumber] = useState("");
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");

  // UI-only
  const [orig, setOrig] = useState(null);
  const [origPreview, setOrigPreview] = useState("/default-avatar.png");
  const [imageError, setImageError] = useState("");
  const [imgFailed, setImgFailed] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [savedList, setSavedList] = useState([]);
  const fileRef = useRef(null);

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/api/employee/${id}`,
          { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
        );

        const emp = res.data.employee;
        setEmployee(emp);
        setName(emp?.userId?.name || "");
        setExperience(emp?.experience || "");
        setDob(emp?.dob ? emp.dob.split("T")[0] : "");
        setBloodGroup(emp?.bloodGroup || "");
        setMaritalStatus(emp?.maritalStatus || "");
        setAadharcard(emp?.aadharcard || "");
        setPancard(emp?.pancard || "");
        setPfNumber(emp?.pfNumber || "");
        setOrig({
          name: emp?.userId?.name || "",
          experience: String(emp?.experience || ""),
          dob: emp?.dob ? emp.dob.split("T")[0] : "",
          bloodGroup: emp?.bloodGroup || "",
          maritalStatus: emp?.maritalStatus || "",
          aadharcard: emp?.aadharcard || "",
          pancard: emp?.pancard || "",
          pfNumber: emp?.pfNumber || "",
        });

        const profileImg = emp?.userId?.profileImage;
        if (profileImg) {
          const url = profileImg.startsWith("http")
            ? profileImg
            : `${import.meta.env.VITE_BACKEND_URL}/${profileImg}`;
          setPreview(url);
          setOrigPreview(url);
        }
      } catch (err) {
        console.error("Failed to load employee");
        setLoadError(apiErrorMessage(err, "Couldn't load your profile."));
      } finally {
        setLoading(false);
      }
    };

    fetchEmployee();
  }, [id]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (e.target) e.target.value = "";
    setImageError("");
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      setImageError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setImageError("Image must be under 5MB");
      return;
    }
    setImage(file);
    setImgFailed(false);
    setPreview(URL.createObjectURL(file));
  };

  /* ---------- dirty tracking (UI only) ---------- */
  const current = { name, experience: String(experience ?? ""), dob, bloodGroup, maritalStatus, aadharcard, pancard, pfNumber };
  const LABELS = { name: "Name", experience: "Experience", dob: "Date of birth", bloodGroup: "Blood group", maritalStatus: "Marital status", aadharcard: "Aadhaar", pancard: "PAN", pfNumber: "PF number" };
  const SETTERS = { name: setName, experience: setExperience, dob: setDob, bloodGroup: setBloodGroup, maritalStatus: setMaritalStatus, aadharcard: setAadharcard, pancard: setPancard, pfNumber: setPfNumber };
  const isDirty = (k) => orig && current[k] !== orig[k];
  const dirtyKeys = orig ? Object.keys(LABELS).filter(isDirty) : [];
  const dirtyCount = dirtyKeys.length + (image ? 1 : 0);
  const undo = (k) => SETTERS[k](orig[k]);
  const undoImage = () => { setImage(null); setPreview(origPreview); setImgFailed(false); setImageError(""); };
  const resetAll = () => { Object.keys(LABELS).forEach(undo); undoImage(); setSaveError(""); };

  useEffect(() => {
    if (!dirtyCount || showAlert) return;
    const h = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirtyCount, showAlert]);

  const leave = () => (dirtyCount ? setLeaveOpen(true) : navigate(-1));

  // Self-service allowlist only: name, experience, dob, bloodGroup,
  // maritalStatus, aadharcard, pancard, pfNumber (+ profileImage).
  // Salary, department and designation are admin-managed and never sent.
  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaveError("");
    try {
      setSaving(true);
      const fd = new FormData();
      fd.append("name", name);
      fd.append("experience", experience);
      fd.append("dob", dob);
      fd.append("bloodGroup", bloodGroup);
      fd.append("maritalStatus", maritalStatus);
      fd.append("aadharcard", aadharcard);
      fd.append("pancard", pancard);
      fd.append("pfNumber", pfNumber);
      if (image) fd.append("profileImage", image);

      await axios.put(
        `${import.meta.env.VITE_BACKEND_URL}/api/employee/update-profile/${id}`,
        fd,
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );

      setSavedList([...dirtyKeys.map((k) => LABELS[k]), ...(image ? ["Photo"] : [])]);
      setShowAlert(true);
    } catch (err) {
      if (apiErrorCode(err) === "FIELD_NOT_EDITABLE") {
        setSaveError(
          `${apiErrorMessage(err, "Some of these fields can only be changed by an administrator.")} ` +
            "Contact HR to change salary, department or designation."
        );
      } else {
        setSaveError(apiErrorMessage(err, "Update failed"));
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingPulse />;

  if (!employee) {
    return (
      <div className={`flex min-h-screen items-center justify-center p-6 ${PAGE_BG}`}>
        <div className={`${CARD} w-full max-w-sm p-8 text-center`}>
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100"><AlertTriangle size={28} /></div>
          <p className="text-base font-bold text-gray-900">{loadError || "Profile not found."}</p>
          <button onClick={() => navigate(-1)}
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30">
            Go back
          </button>
        </div>
      </div>
    );
  }

  /* ---------- hints (non-blocking) ---------- */
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dobDate = parseISO(dob);
  const age = dobDate ? (() => { let a = today.getFullYear() - dobDate.getFullYear(); if (today < new Date(today.getFullYear(), dobDate.getMonth(), dobDate.getDate())) a--; return a; })() : null;
  const hints = {
    name: !name.trim() ? "Name can't be empty." : "",
    aadharcard: aadharcard && !AADHAAR_RE.test(aadharcard.replace(/\s/g, "")) ? "Aadhaar is usually 12 digits." : "",
    pancard: pancard && !PAN_RE.test(pancard) ? "PAN looks like ABCDE1234F." : "",
    experience: experience !== "" && Number(experience) < 0 ? "Experience can't be negative." : "",
  };
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  const showImg = preview && preview !== "/default-avatar.png" && !imgFailed;

  const EditedTag = ({ k }) =>
    isDirty(k) ? (
      <span className="ml-auto flex items-center gap-1">
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-100">Edited</span>
        <button type="button" onClick={() => undo(k)} title="Undo" aria-label={`Undo ${LABELS[k]}`}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><Undo2 size={13} /></button>
      </span>
    ) : null;

  const Label = ({ k, icon: Icon, children, htmlFor }) => (
    <div className="mb-1.5 flex items-center gap-1.5">
      <Icon size={13} className="text-gray-400" />
      <label htmlFor={htmlFor} className="text-xs font-semibold text-gray-600">{children}</label>
      <EditedTag k={k} />
    </div>
  );

  const inputCls = (k) =>
    `w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm font-semibold text-gray-900 ring-1 transition placeholder:font-normal placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-400 ${
      hints[k] ? "ring-amber-300" : isDirty(k) ? "ring-amber-200 bg-amber-50/30" : "ring-gray-200 hover:ring-red-200"
    }`;
  const Hint = ({ k }) => (hints[k] ? <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-amber-700"><Info size={12} />{hints[k]}</p> : null);

  return (
    <div className={`min-h-screen ${PAGE_BG} p-4 pb-6 sm:p-6 lg:p-8`}>
      <AnimatePresence>
        {showAlert && (
          <ConfirmDialog key="ok" changed={savedList} onClose={() => navigate(`/employee-dashboard/profile/${employee._id}`)} />
        )}
        {leaveOpen && <LeaveConfirm key="leave" count={dirtyCount} onStay={() => setLeaveOpen(false)} onLeave={() => navigate(-1)} />}
      </AnimatePresence>

      <div className="mx-auto max-w-5xl">
        <button onClick={leave}
          className="group mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-gray-500 ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200">
          <ChevronLeft size={14} className="transition-transform group-hover:-translate-x-0.5" /> Back to profile
        </button>

        <form onSubmit={handleSave} noValidate>
          {/* ============ HERO / PHOTO + NAME ============ */}
          <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className={`${CARD} overflow-hidden`}>
            <div className="relative h-28 bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 sm:h-32">
              <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/15 blur-2xl" />
              <div className="absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-orange-300/25 blur-2xl" />
              <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/25 backdrop-blur">
                <User size={12} /> Editing profile
              </span>
            </div>
            <div className="px-5 pb-6 sm:px-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
                {/* photo */}
                <div className="relative z-10 -mt-12 shrink-0 sm:-mt-14">
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="group relative block h-28 w-28 overflow-hidden rounded-3xl bg-white shadow-xl ring-4 ring-white sm:h-32 sm:w-32">
                    {showImg ? (
                      <img src={preview} alt="preview" className="h-full w-full object-cover" onError={() => setImgFailed(true)} />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-red-500 to-rose-400 text-4xl font-extrabold text-white">{initials}</span>
                    )}
                    <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 text-xs font-bold text-white opacity-0 transition group-hover:opacity-100">
                      <Camera size={20} /> Change
                    </span>
                  </button>
                  <button type="button" onClick={() => fileRef.current?.click()} aria-label="Upload photo"
                    className="absolute -bottom-1.5 -right-1.5 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/40 ring-2 ring-white transition hover:scale-105">
                    <Camera size={15} />
                  </button>
                  <input ref={fileRef} type="file" hidden accept="image/*" onChange={handleImageChange} />
                </div>

                {/* name */}
                <div className="min-w-0 flex-1 sm:pt-4">
                  <Label k="name" icon={User} htmlFor="ep-name">Full name</Label>
                  <input id="ep-name" name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter full name" required
                    className={`${inputCls("name")} text-lg font-extrabold`} />
                  <Hint k="name" />
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {image ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700 ring-1 ring-amber-100">
                        New photo: <span className="max-w-[10rem] truncate">{image.name}</span>
                        <button type="button" onClick={undoImage} aria-label="Undo photo" className="rounded p-0.5 hover:bg-amber-100"><Undo2 size={12} /></button>
                      </span>
                    ) : (
                      <span className="text-gray-400">JPG, PNG or WEBP · up to 5 MB</span>
                    )}
                    {imageError && <span className="inline-flex items-center gap-1 font-semibold text-red-600"><AlertTriangle size={12} />{imageError}</span>}
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* ============ LEFT: editable ============ */}
            <div className="space-y-6 lg:col-span-3">
              <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={`${CARD} space-y-5 p-5 sm:p-6`}>
                <SectionTitle icon={User} title="Personal details" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label k="dob" icon={Calendar} htmlFor="ep-dob">Date of birth</Label>
                    <DatePicker id="ep-dob" value={dob} onChange={setDob} title="Date of birth" placeholder="Pick your birthday"
                      max={toISO(today)} startView="years" defaultDate={new Date(today.getFullYear() - 25, 0, 1)} quick={[]}
                      describe={(d) => { let a = today.getFullYear() - d.getFullYear(); if (today < new Date(today.getFullYear(), d.getMonth(), d.getDate())) a--; return `${d.toLocaleDateString("en-IN", { weekday: "long" })} · ${a} years old`; }} />
                    {age !== null && age < 18 && <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-amber-700"><Info size={12} />That's under 18 — please double-check.</p>}
                  </div>
                  <div>
                    <Label k="experience" icon={Briefcase} htmlFor="ep-exp">Prior experience</Label>
                    <div className="relative">
                      <input id="ep-exp" type="number" min="0" step="0.5" inputMode="decimal" value={experience} onChange={(e) => setExperience(e.target.value)}
                        onWheel={(e) => e.currentTarget.blur()} placeholder="0"
                        className={`${inputCls("experience")} pr-16 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none`} />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">years</span>
                    </div>
                    <Hint k="experience" />
                  </div>
                </div>

                <div>
                  <Label k="maritalStatus" icon={Heart}>Marital status</Label>
                  <div className="flex gap-1 rounded-2xl bg-gray-100/80 p-1">
                    {MARITAL.map((m) => (
                      <button key={m} type="button" onClick={() => setMaritalStatus(maritalStatus === m ? "" : m)}
                        className={`relative flex-1 rounded-xl py-2.5 text-sm font-bold transition ${maritalStatus === m ? "text-white" : "text-gray-500 hover:text-gray-800"}`}>
                        {maritalStatus === m && <motion.span layoutId="ep-marital" className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 shadow-md shadow-red-600/25" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                        <span className="relative">{m}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label k="bloodGroup" icon={Droplets}>Blood group</Label>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                    {BLOOD_GROUPS.map((g) => {
                      const on = bloodGroup === g;
                      return (
                        <button key={g} type="button" onClick={() => setBloodGroup(on ? "" : g)}
                          className={`flex flex-col items-center gap-0.5 rounded-2xl py-2.5 text-sm font-extrabold transition ${on ? "bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/30" : "bg-white text-gray-700 ring-1 ring-gray-200 hover:text-red-600 hover:ring-red-200"}`}>
                          <Droplets size={13} className={on ? "text-white/80" : "text-red-400"} />
                          {g}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.section>

              <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className={`${CARD} space-y-4 p-5 sm:p-6`}>
                <SectionTitle icon={ShieldCheck} title="Identity documents" subtitle="Only you and HR can see these" />
                <div>
                  <Label k="aadharcard" icon={CreditCard} htmlFor="ep-aadhar">Aadhaar card</Label>
                  <input id="ep-aadhar" inputMode="numeric" value={aadharcard} onChange={(e) => setAadharcard(e.target.value)} placeholder="12-digit Aadhaar number"
                    className={`${inputCls("aadharcard")} font-mono tracking-wider`} />
                  <Hint k="aadharcard" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label k="pancard" icon={CreditCard} htmlFor="ep-pan">PAN card</Label>
                    <input id="ep-pan" value={pancard} onChange={(e) => setPancard(e.target.value)} placeholder="ABCDE1234F"
                      className={`${inputCls("pancard")} font-mono uppercase tracking-wider`} />
                    <Hint k="pancard" />
                  </div>
                  <div>
                    <Label k="pfNumber" icon={PiggyBank} htmlFor="ep-pf">PF number</Label>
                    <input id="ep-pf" value={pfNumber} onChange={(e) => setPfNumber(e.target.value)} placeholder="PF number"
                      className={`${inputCls("pfNumber")} font-mono tracking-wider`} />
                  </div>
                </div>
              </motion.section>
            </div>

            {/* ============ RIGHT: read-only + changes ============ */}
            <div className="space-y-6 lg:col-span-2">
              <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`${CARD} p-5 sm:p-6`}>
                <SectionTitle icon={Lock} title="Managed by HR" subtitle="Read-only on this page" />
                <div className="mt-4 space-y-2">
                  {[
                    { label: "Employee ID", value: employee?.employeeId, Icon: Fingerprint, mono: true },
                    { label: "Department", value: employee?.department?.dep_name, Icon: Globe },
                    { label: "Designation", value: employee?.designation, Icon: Briefcase },
                  ].map((f) => (
                    <div key={f.label} className="flex items-center gap-3 rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-100">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-gray-400 ring-1 ring-gray-100"><f.Icon size={14} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{f.label}</p>
                        <p className={`truncate text-sm font-bold text-gray-600 ${f.mono ? "font-mono" : ""}`}>{f.value || "—"}</p>
                      </div>
                      <Lock size={13} className="shrink-0 text-gray-300" />
                    </div>
                  ))}
                </div>
                <p className="mt-3 flex items-start gap-1.5 text-xs text-gray-400"><Info size={13} className="mt-px shrink-0" /> To change these or your salary, contact HR.</p>
              </motion.section>

              <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className={`${CARD} p-5 sm:p-6 lg:sticky lg:top-6`}>
                <div className="flex items-center justify-between">
                  <SectionTitle icon={RotateCcw} title="Pending changes" />
                  {dirtyCount > 0 && (
                    <button type="button" onClick={resetAll} className="rounded-xl px-2.5 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-800">Reset all</button>
                  )}
                </div>
                {dirtyCount === 0 ? (
                  <p className="mt-4 rounded-2xl bg-gray-50 p-4 text-center text-sm text-gray-400 ring-1 ring-gray-100">No changes yet.</p>
                ) : (
                  <ul className="mt-4 space-y-1.5">
                    {image && (
                      <li className="flex items-center gap-2 rounded-xl bg-amber-50/60 px-3 py-2 text-sm">
                        <Camera size={13} className="text-amber-600" /><span className="flex-1 font-semibold text-gray-800">Photo</span>
                        <button type="button" onClick={undoImage} className="rounded p-1 text-gray-400 hover:bg-white hover:text-gray-700" aria-label="Undo photo"><Undo2 size={13} /></button>
                      </li>
                    )}
                    {dirtyKeys.map((k) => (
                      <li key={k} className="flex items-center gap-2 rounded-xl bg-amber-50/60 px-3 py-2 text-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        <span className="min-w-0 flex-1">
                          <span className="font-semibold text-gray-800">{LABELS[k]}</span>
                          <span className="block truncate text-xs text-gray-400">
                            <span className="line-through">{orig[k] || "empty"}</span> → <span className="text-gray-700">{current[k] || "empty"}</span>
                          </span>
                        </span>
                        <button type="button" onClick={() => undo(k)} className="rounded p-1 text-gray-400 hover:bg-white hover:text-gray-700" aria-label={`Undo ${LABELS[k]}`}><Undo2 size={13} /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.section>
            </div>
          </div>

          {/* ============ STICKY ACTIONS ============ */}
          <div className="sticky bottom-0 z-30 mt-6 pb-3 pt-2 sm:pb-4">
            <div>
              <AnimatePresence>
                {saveError && (
                  <motion.div role="alert" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                    className="mb-2 flex items-start gap-2 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700 shadow-lg ring-1 ring-red-100">
                    <AlertTriangle size={16} className="mt-px shrink-0" />
                    <span className="flex-1">{saveError}</span>
                    <button type="button" onClick={() => setSaveError("")} aria-label="Dismiss" className="rounded-lg p-0.5 hover:bg-red-100"><X size={15} /></button>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className={`${CARD} flex items-center gap-3 p-3`}>
                <button type="button" onClick={leave}
                  className="rounded-2xl px-5 py-3 text-sm font-semibold text-gray-500 transition hover:bg-gray-100 hover:text-gray-800">
                  Discard
                </button>
                <span className="hidden flex-1 text-xs text-gray-400 sm:block">
                  {dirtyCount ? `${dirtyCount} unsaved change${dirtyCount === 1 ? "" : "s"}` : "Nothing to save yet"}
                </span>
                <button type="submit" disabled={saving || !dirtyCount || !name.trim()}
                  className="ml-auto flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {saving ? "Saving…" : "Save changes"}
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

const SectionTitle = ({ icon: Icon, title, subtitle }) => (
  <div className="flex items-center gap-3">
    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600"><Icon size={16} /></div>
    <div>
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
    </div>
  </div>
);

const LoadingPulse = () => (
  <div className={`min-h-screen ${PAGE_BG} p-4 sm:p-6 lg:p-8`}>
    <div className="mx-auto max-w-5xl animate-pulse">
      <div className="mb-4 h-7 w-32 rounded-full bg-white/80" />
      <div className={`${CARD} overflow-hidden`}>
        <div className="h-28 bg-red-200/60 sm:h-32" />
        <div className="flex items-start gap-6 px-5 pb-6 sm:px-8">
          <div className="-mt-12 h-28 w-28 rounded-3xl bg-gray-200 ring-4 ring-white sm:h-32 sm:w-32" />
          <div className="flex-1 space-y-2 pt-4"><div className="h-3 w-20 rounded bg-gray-100" /><div className="h-11 w-full max-w-md rounded-2xl bg-gray-100" /></div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className={`${CARD} h-96 lg:col-span-3`} />
        <div className={`${CARD} h-96 lg:col-span-2`} />
      </div>
    </div>
  </div>
);

export default EditEmployeeProfile;