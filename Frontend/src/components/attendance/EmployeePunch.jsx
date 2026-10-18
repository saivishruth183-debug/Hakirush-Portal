import React, { useEffect, useState, useCallback, useMemo, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { apiErrorMessage } from "../../utils/apiError";
import {
  Play, Square, Coffee, RotateCcw, Timer, LogIn, LogOut, Loader2, AlertTriangle, PartyPopper,
  CheckCircle2, X, Sun, Flag, Hourglass,
} from "lucide-react";

const TARGET_HOURS = 8;

const formatClock = (dateStr) => {
  if (!dateStr) return "--:--";
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

// local "YYYY-MM-DD" (toISOString is UTC and shifts dates in IST)
const toLocalYMD = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

const fmtDuration = (ms) => {
  const mins = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(mins / 60), m = mins % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
};

/* status → colours */
const TONES = {
  idle: { label: "Not started", chip: "bg-gray-100 text-gray-500", ring: ["#e5e7eb", "#e5e7eb"], text: "text-gray-400" },
  live: { label: "Working", chip: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200", ring: ["#dc2626", "#f43f5e"], text: "text-gray-900" },
  paused: { label: "On break", chip: "bg-amber-50 text-amber-700 ring-1 ring-amber-200", ring: ["#f59e0b", "#fbbf24"], text: "text-amber-600" },
  Present: { label: "Present", chip: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200", ring: ["#10b981", "#14b8a6"], text: "text-emerald-600" },
  "Half Day": { label: "Half day", chip: "bg-amber-50 text-amber-700 ring-1 ring-amber-200", ring: ["#f59e0b", "#fbbf24"], text: "text-amber-600" },
  Absent: { label: "Absent", chip: "bg-red-50 text-red-700 ring-1 ring-red-200", ring: ["#dc2626", "#f87171"], text: "text-red-600" },
};

/* ---------- modal shell (portal, so it is never clipped by parent cards) ---------- */
const Modal = ({ children, onClose, dismissable = true }) => {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && dismissable && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, dismissable]);
  return createPortal(
    <motion.div className="fixed inset-0 z-[300] flex items-end justify-center p-4 sm:items-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={() => dismissable && onClose?.()} />
      <motion.div role="dialog" aria-modal="true"
        initial={{ y: 40, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 30, opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white text-gray-900 shadow-2xl ring-1 ring-gray-100">
        {children}
      </motion.div>
    </motion.div>,
    document.body
  );
};

const ActionModal = ({ tone = "red", Icon, title, text, cancel, confirm, onCancel, onConfirm }) => {
  const t = {
    red: { bar: "from-red-600 to-rose-400", icon: "bg-red-50 text-red-600 ring-red-100", btn: "from-red-600 to-rose-500 shadow-red-600/30" },
    green: { bar: "from-emerald-500 to-teal-400", icon: "bg-emerald-50 text-emerald-600 ring-emerald-100", btn: "from-emerald-600 to-teal-500 shadow-emerald-600/30" },
    amber: { bar: "from-amber-400 to-orange-400", icon: "bg-amber-50 text-amber-600 ring-amber-100", btn: "from-red-600 to-rose-500 shadow-red-600/30" },
  }[tone];
  return (
    <Modal onClose={onCancel}>
      <div className={`h-1.5 bg-gradient-to-r ${t.bar}`} />
      <div className="p-7 text-center">
        <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ring-1 ${t.icon}`}><Icon size={28} /></div>
        <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
        <div className="mt-2 text-sm text-gray-500">{text}</div>
      </div>
      <div className={`grid gap-2 px-7 pb-7 ${cancel ? "grid-cols-2" : "grid-cols-1"}`}>
        {cancel && (
          <button onClick={onCancel} className="rounded-2xl bg-gray-100 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-200">{cancel}</button>
        )}
        <button onClick={onConfirm} className={`rounded-2xl bg-gradient-to-r py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98] ${t.btn}`}>{confirm}</button>
      </div>
    </Modal>
  );
};

/* ---------- progress ring ---------- */
const Ring = ({ pct, colors, children, pulse }) => {
  const R = 84, C = 2 * Math.PI * R;
  const id = `punch-grad-${colors.join("").replace(/#/g, "")}`;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[15rem]">
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={colors[0]} />
            <stop offset="100%" stopColor={colors[1]} />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r={R} fill="none" stroke="#f3f4f6" strokeWidth="14" />
        {/* hour ticks */}
        {Array.from({ length: TARGET_HOURS }).map((_, i) => {
          const a = (i / TARGET_HOURS) * 2 * Math.PI;
          return <circle key={i} cx={100 + R * Math.cos(a)} cy={100 + R * Math.sin(a)} r="1.6" fill="#d1d5db" />;
        })}
        <motion.circle
          cx="100" cy="100" r={R} fill="none" stroke={`url(#${id})`} strokeWidth="14" strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - Math.min(1, pct)) }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      {pulse && <span className="absolute inset-6 animate-ping rounded-full bg-red-400/10 [animation-duration:2.4s]" />}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
};

const EmployeePunch = ({ onSuccess }) => {
  const headers = useMemo(() => ({ Authorization: `Bearer ${localStorage.getItem("token")}` }), []);
  const [attendance, setAttendance] = useState(null);
  const [timer, setTimer] = useState("00:00:00");
  const [workedHours, setWorkedHours] = useState(0);
  const [isHoliday, setIsHoliday] = useState(false);
  const [holidayName, setHolidayName] = useState("");
  const [showCheckInPopup, setShowCheckInPopup] = useState(false);
  // UI-only
  const [busy, setBusy] = useState(null); // endpoint currently running
  const [errorMsg, setErrorMsg] = useState("");
  const [loaded, setLoaded] = useState(false);

  const fetchTodayAttendance = useCallback(async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/attendance/today/me`, { headers });
      if (res.data.success && res.data.attendance) {
        setAttendance(res.data.attendance);
      }
    } catch (error) {
      console.error("Error fetching attendance", error);
    } finally {
      setLoaded(true);
    }
  }, [headers]);

  // Check if today is a weekend or holiday
  const checkHolidayOrWeekend = useCallback(async () => {
    const today = new Date();
    const day = today.getDay();
    // 0 = Sunday, 6 = Saturday
    if (day === 0 || day === 6) {
      setIsHoliday(true);
      setHolidayName(day === 0 ? "Sunday" : "Saturday");
      return;
    }
    try {
      const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/holiday/upcoming`, { headers });
      if (res.data.success && Array.isArray(res.data.holidays)) {
        const todayStr = toLocalYMD(today);
        const found = res.data.holidays.find((h) => toLocalYMD(h.date) === todayStr);
        if (found) {
          setIsHoliday(true);
          setHolidayName(found.title || "Holiday");
        }
      }
    } catch (error) {
      // If error, do not block check-in, just log
      console.error("Error checking holidays", error);
    }
  }, [headers]);

  const handleAction = async (endpoint) => {
    try {
      setBusy(endpoint);
      const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/attendance/${endpoint}`, {}, { headers });
      if (res.data.success) {
        setAttendance(res.data.attendance);
        if (onSuccess) onSuccess();
      }
    } catch (error) {
      console.error(`Error during ${endpoint}:`, apiErrorMessage(error));
      // 409 INVALID_TRANSITION carries the authoritative record: resync the UI.
      const serverAttendance = error.response?.data?.details?.attendance;
      if (serverAttendance) setAttendance(serverAttendance);
      setErrorMsg(apiErrorMessage(error, "Couldn't update attendance. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  // Only for check-in, show popup first
  const [showHolidayPopup, setShowHolidayPopup] = useState(false);
  const [showCheckOutPopup, setShowCheckOutPopup] = useState(false);

  const handleCheckInClick = () => {
    if (isHoliday) {
      setShowHolidayPopup(true);
    } else {
      setShowCheckInPopup(true);
    }
  };

  const confirmCheckIn = () => {
    setShowCheckInPopup(false);
    handleAction("check-in");
  };
  const cancelCheckIn = () => {
    setShowCheckInPopup(false);
  };
  const closeHolidayPopup = () => {
    setShowHolidayPopup(false);
  };

  const handleCheckOutClick = () => {
    setShowCheckOutPopup(true);
  };
  const confirmCheckOut = () => {
    setShowCheckOutPopup(false);
    handleAction("check-out");
  };
  const cancelCheckOut = () => {
    setShowCheckOutPopup(false);
  };

  const calculateTime = useCallback(() => {
    if (!attendance?.checkIn) return;

    const checkInTime = new Date(attendance.checkIn).getTime();
    // totalPausedMs must be treated as 0 if undefined/null to avoid NaN
    const totalPausedMs = attendance.totalPausedMs || 0;

    let currentTime;
    if (attendance.checkOut) {
      currentTime = new Date(attendance.checkOut).getTime();
    } else if (attendance.isPaused && attendance.pauseStartedAt) {
      // FREEZE TIMER: Use the exact time the pause started
      currentTime = new Date(attendance.pauseStartedAt).getTime();
    } else {
      currentTime = new Date().getTime();
    }

    const diffMs = Math.max(0, currentTime - checkInTime - totalPausedMs);
    const sec = Math.floor(diffMs / 1000);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;

    setWorkedHours(diffMs / (1000 * 60 * 60));
    setTimer(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
  }, [attendance]);

  useEffect(() => {
    if (!attendance?.checkIn) {
      // No check-in: timer and workedHours are always zero
      if (timer !== "00:00:00") setTimer("00:00:00");
      if (workedHours !== 0) setWorkedHours(0);
      return;
    }
    calculateTime();
    let interval;
    // Only tick the timer if checked in, NOT checked out, and NOT on break
    if (attendance.checkIn && !attendance.checkOut && !attendance.isPaused) {
      interval = setInterval(calculateTime, 1000);
    }
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendance, calculateTime]);

  useLayoutEffect(() => {
    fetchTodayAttendance();
    checkHolidayOrWeekend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // UI-only: tick once a minute while on break so the break length stays current
  const [, setBreakTick] = useState(0);
  useEffect(() => {
    if (!attendance?.isPaused || attendance?.checkOut) return;
    const t = setInterval(() => setBreakTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, [attendance?.isPaused, attendance?.checkOut]);

  const getFinalStatus = () => {
    if (!attendance?.checkOut) return null;
    if (workedHours >= 8) return "Present";
    if (workedHours >= 4) return "Half Day";
    return "Absent";
  };

  const finalStatus = getFinalStatus();

  /* ---------- UI-only derived ---------- */
  const stateKey = attendance?.checkOut
    ? finalStatus
    : attendance?.isPaused
    ? "paused"
    : attendance?.checkIn
    ? "live"
    : "idle";
  const tone = TONES[stateKey] || TONES.idle;
  const pct = workedHours / TARGET_HOURS;
  const remainingMs = Math.max(0, (TARGET_HOURS - workedHours) * 3600000);
  const breakMs = (attendance?.totalPausedMs || 0) +
    (attendance?.isPaused && attendance?.pauseStartedAt && !attendance?.checkOut ? Date.now() - new Date(attendance.pauseStartedAt).getTime() : 0);
  const doneBy = attendance?.checkIn && !attendance?.checkOut && !attendance?.isPaused && remainingMs > 0
    ? new Date(Date.now() + remainingMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;
  const [hh, mm, ss] = timer.split(":");
  const todayLabel = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

  const subLine = (() => {
    if (!attendance?.checkIn) return isHoliday ? `${holidayName} — day off` : `Target ${TARGET_HOURS}h today`;
    if (attendance.checkOut) return finalStatus === "Present" ? "Full day completed" : finalStatus === "Half Day" ? "Half day recorded" : "Less than 4 hours worked";
    if (attendance.isPaused) return `On break since ${formatClock(attendance.pauseStartedAt)}`;
    return remainingMs > 0 ? `${fmtDuration(remainingMs)} to go` : "Target reached 🎉";
  })();

  return (
    <div className="w-full">
      <div className="relative overflow-hidden rounded-3xl bg-white text-gray-900">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-red-100/60 blur-3xl" />

        {/* ---- header ---- */}
        <div className="relative flex items-center justify-between gap-3 px-5 pt-5 sm:px-6">
          <div className="min-w-0">
            <p className="text-sm font-extrabold tracking-tight text-gray-900">Today's shift</p>
            <p className="truncate text-xs text-gray-400">{todayLabel}</p>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${tone.chip}`}>
            {stateKey === "live" && (
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
            )}
            {stateKey === "paused" && <Coffee size={12} />}
            {["Present", "Half Day", "Absent"].includes(stateKey) && <Flag size={12} />}
            {tone.label}
          </span>
        </div>

        {/* ---- ring + timer ---- */}
        <div className="relative px-5 pt-4 sm:px-6">
          {!loaded ? (
            <div className="mx-auto aspect-square w-full max-w-[15rem] animate-pulse rounded-full border-[14px] border-gray-100" />
          ) : (
            <Ring pct={pct} colors={tone.ring} pulse={stateKey === "live"}>
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400"><Timer size={11} /> Worked</p>
              <p className={`mt-1 font-extrabold leading-none tabular-nums tracking-tight ${tone.text}`}>
                <span className="text-4xl sm:text-5xl">{hh}:{mm}</span>
                <span className="ml-0.5 text-xl text-gray-300 sm:text-2xl">:{ss}</span>
              </p>
              <p className="mt-2 max-w-[9rem] text-xs font-semibold text-gray-500">{subLine}</p>
              {attendance?.checkIn && (
                <p className="mt-1 text-[11px] font-bold tabular-nums text-gray-400">{Math.min(100, Math.round(pct * 100))}% of {TARGET_HOURS}h</p>
              )}
            </Ring>
          )}
        </div>

        {/* ---- holiday notice ---- */}
        {isHoliday && !attendance?.checkIn && (
          <div className="relative mx-5 mt-4 flex items-center gap-3 rounded-2xl bg-rose-50 p-3 ring-1 ring-rose-100 sm:mx-6">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-rose-500 shadow-sm">{/sunday|saturday/i.test(holidayName) ? <Sun size={17} /> : <PartyPopper size={17} />}</span>
            <p className="text-sm text-rose-800">Today is <b>{holidayName}</b>. Check-in is off — enjoy the day!</p>
          </div>
        )}

        {/* ---- times ---- */}
        <div className="relative mt-4 grid grid-cols-3 gap-2 px-5 sm:px-6">
          {[
            { label: "Check-in", value: formatClock(attendance?.checkIn), Icon: LogIn, c: "text-emerald-600 bg-emerald-50" },
            { label: "Break", value: attendance?.checkIn ? fmtDuration(breakMs) : "--", Icon: Coffee, c: "text-amber-600 bg-amber-50" },
            { label: attendance?.checkOut ? "Check-out" : doneBy ? "8h done by" : "Check-out", value: attendance?.checkOut ? formatClock(attendance.checkOut) : doneBy || "--:--", Icon: attendance?.checkOut ? LogOut : Hourglass, c: "text-red-600 bg-red-50" },
          ].map((t) => (
            <div key={t.label} className="rounded-2xl bg-gray-50 p-2.5 text-center ring-1 ring-gray-100">
              <span className={`mx-auto flex h-7 w-7 items-center justify-center rounded-lg ${t.c}`}><t.Icon size={14} /></span>
              <p className="mt-1.5 truncate text-[10px] font-bold uppercase tracking-wider text-gray-400">{t.label}</p>
              <p className="text-sm font-extrabold tabular-nums text-gray-900">{t.value}</p>
            </div>
          ))}
        </div>

        {/* ---- actions ---- */}
        <div className="relative p-5 sm:p-6">
          {!attendance?.checkIn ? (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleCheckInClick}
              disabled={!!busy || !loaded}
              className={`flex w-full items-center justify-center gap-2.5 rounded-2xl py-4 text-base font-extrabold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60 ${isHoliday ? "bg-gray-300 shadow-none" : "bg-gradient-to-r from-red-600 to-rose-500 shadow-red-600/30"}`}
            >
              {busy === "check-in" ? <Loader2 size={19} className="animate-spin" /> : <Play fill="currentColor" size={18} />}
              {busy === "check-in" ? "Checking in…" : "Check in"}
            </motion.button>
          ) : !attendance?.checkOut ? (
            <div className="grid grid-cols-2 gap-2.5">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => handleAction(attendance.isPaused ? "resume" : "pause")}
                disabled={!!busy}
                className={`flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition disabled:opacity-60 ${
                  attendance.isPaused
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
                    : "bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100"
                }`}
              >
                {busy === "pause" || busy === "resume" ? <Loader2 size={17} className="animate-spin" /> : attendance.isPaused ? <RotateCcw size={17} /> : <Coffee size={17} />}
                {attendance.isPaused ? "Resume" : "Take a break"}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleCheckOutClick}
                disabled={!!busy}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:brightness-110 disabled:opacity-60"
              >
                {busy === "check-out" ? <Loader2 size={17} className="animate-spin" /> : <Square fill="currentColor" size={14} />}
                Check out
              </motion.button>
            </div>
          ) : (
            <div className={`flex items-center gap-3 rounded-2xl p-4 ring-1 ${finalStatus === "Present" ? "bg-emerald-50 ring-emerald-100" : finalStatus === "Half Day" ? "bg-amber-50 ring-amber-100" : "bg-red-50 ring-red-100"}`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${finalStatus === "Present" ? "bg-emerald-500" : finalStatus === "Half Day" ? "bg-amber-400" : "bg-red-500"}`}>
                <CheckCircle2 size={20} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-gray-900">Shift completed · {finalStatus}</p>
                <p className="text-xs text-gray-500">{formatClock(attendance.checkIn)} – {formatClock(attendance.checkOut)} · {fmtDuration(workedHours * 3600000)} worked</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ---- popups ---- */}
      <AnimatePresence>
        {showCheckInPopup && !attendance?.checkIn && !isHoliday && (
          <ActionModal key="in" tone="green" Icon={LogIn} title="Start today's shift?"
            text={<>The timer starts the moment you confirm.<br /><span className="font-semibold text-gray-700">{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span> will be your check-in time.</>}
            cancel="Not yet" confirm="Check in" onCancel={cancelCheckIn} onConfirm={confirmCheckIn} />
        )}
        {showHolidayPopup && !attendance?.checkIn && isHoliday && (
          <ActionModal key="hol" tone="amber" Icon={PartyPopper} title="Check-in isn't available"
            text={<>Today is <span className="font-semibold text-gray-800">{holidayName}</span>.</>}
            confirm="Got it" onCancel={closeHolidayPopup} onConfirm={closeHolidayPopup} />
        )}
        {showCheckOutPopup && attendance?.checkIn && !attendance?.checkOut && (
          <ActionModal key="out" tone="red" Icon={LogOut} title="End today's shift?"
            text={
              <>
                You've worked <b className="text-gray-800">{fmtDuration(workedHours * 3600000)}</b>
                {workedHours < TARGET_HOURS && <> — that's {workedHours >= 4 ? <b className="text-amber-600">a half day</b> : <b className="text-red-600">under 4 hours (absent)</b>}</>}.
                <br />You can't check in again today after this.
              </>
            }
            cancel="Keep working" confirm="Check out" onCancel={cancelCheckOut} onConfirm={confirmCheckOut} />
        )}
        {errorMsg && (
          <ActionModal key="err" tone="red" Icon={AlertTriangle} title="Couldn't update attendance"
            text={errorMsg} confirm="Got it" onCancel={() => setErrorMsg("")} onConfirm={() => setErrorMsg("")} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default EmployeePunch;