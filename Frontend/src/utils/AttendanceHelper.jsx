import axios from "axios";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Clock, CalendarDays, Loader2, Pencil, X, AlertTriangle } from "lucide-react";
import { apiErrorMessage } from "./apiError";

const normalizeStatus = (status) => {
  if (status === null || status === undefined || status === "") return null;
  const s = status.toString().toLowerCase().replace(/\s+/g, "");
  if (s === "halfday") return "Half Day";
  if (s === "present") return "Present";
  if (s === "leave") return "Leave";
  if (s === "absent") return "Absent";
  return null;
};

/* ================= THEME CONFIGURATION ================= */
const statusConfig = {
  Present: {
    icon: CheckCircle2,
    short: "Present",
    pill: "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100",
    btn: "text-emerald-600 hover:bg-emerald-500 hover:text-white hover:shadow-emerald-500/30",
    active: "bg-emerald-500 text-white shadow-emerald-500/30",
  },
  "Half Day": {
    icon: Clock,
    short: "Half",
    pill: "bg-sky-50 text-sky-700 ring-sky-200 hover:bg-sky-100",
    btn: "text-sky-600 hover:bg-sky-500 hover:text-white hover:shadow-sky-500/30",
    active: "bg-sky-500 text-white shadow-sky-500/30",
  },
  Absent: {
    icon: XCircle,
    short: "Absent",
    pill: "bg-red-50 text-red-700 ring-red-200 hover:bg-red-100",
    btn: "text-red-600 hover:bg-red-600 hover:text-white hover:shadow-red-600/30",
    active: "bg-red-600 text-white shadow-red-600/30",
  },
  Leave: {
    icon: CalendarDays,
    short: "Leave",
    pill: "bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100",
    btn: "text-amber-600 hover:bg-amber-500 hover:text-white hover:shadow-amber-500/30",
    active: "bg-amber-500 text-white shadow-amber-500/30",
  },
};

/* ================= SHARED TOOLTIP WRAPPER ================= */
const Tooltip = ({ label, children }) => (
  <div className="group/tt relative">
    {children}
    <span className="pointer-events-none absolute -top-9 left-1/2 z-30 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1 text-[11px] font-semibold text-white opacity-0 shadow-lg transition-all duration-150 group-hover/tt:translate-y-0 group-hover/tt:opacity-100">
      {label}
      <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
    </span>
  </div>
);

/* ================= ERROR POPUP ================= */
const ErrorAlert = ({ message, onClose }) => {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <motion.div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div role="dialog" aria-modal="true"
        initial={{ y: 40, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 30, opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white p-7 text-center shadow-2xl ring-1 ring-gray-100">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-red-600 to-rose-400" />
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100"><AlertTriangle size={28} /></div>
        <h3 className="text-xl font-extrabold tracking-tight text-gray-900">Couldn't update attendance</h3>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">{message}</p>
        <button onClick={onClose}
          className="mt-6 w-full rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 hover:brightness-110">
          Got it
        </button>
      </motion.div>
    </motion.div>,
    document.body
  );
};

// Active admin manual-status workflow: PUT /api/attendance/update/:employeeId (Employee._id).
const AttendanceHelper = ({ status, employeeId, statusChange }) => {
  const finalStatus = normalizeStatus(status);
  const [loading, setLoading] = useState(false);
  const [localStatus, setLocalStatus] = useState(finalStatus);
  const [editMode, setEditMode] = useState(false);
  const [pending, setPending] = useState(null); // UI-only: which button is saving
  const [errorMsg, setErrorMsg] = useState("");

  const markEmployee = async (newStatus) => {
    try {
      setLoading(true);
      setPending(newStatus);
      // Map button label to backend status value
      let backendStatus = newStatus;
      if (newStatus === "Half Day") backendStatus = "Halfday";
      else if (newStatus === "Present") backendStatus = "Present";
      else if (newStatus === "Absent") backendStatus = "Absent";
      else if (newStatus === "Leave") backendStatus = "Leave";
      await axios.put(
        `${import.meta.env.VITE_BACKEND_URL}/api/attendance/update/${employeeId}`,
        { status: backendStatus },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      setLocalStatus(normalizeStatus(backendStatus));
      statusChange();
    } catch (err) {
      console.error("Attendance Sync Error:", err);
      setErrorMsg(apiErrorMessage(err, "Failed to update attendance status."));
    } finally {
      setLoading(false);
      setPending(null);
    }
  };

  // Update localStatus if status prop changes
  useEffect(() => {
    setLocalStatus(normalizeStatus(status));
    setEditMode(false);
  }, [status]);

  const errorPopup = (
    <AnimatePresence>
      {errorMsg && <ErrorAlert key="err" message={errorMsg} onClose={() => setErrorMsg("")} />}
    </AnimatePresence>
  );

  // Status badge (click to change)
  if (localStatus && !editMode && !loading) {
    const config = statusConfig[localStatus];
    const Icon = config.icon;
    return (
      <>
        {errorPopup}
        <Tooltip label="Click to change status">
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setEditMode(true)}
            className={`group inline-flex items-center gap-2 rounded-full py-1.5 pl-3 pr-2 text-xs font-bold ring-1 transition ${config.pill}`}
          >
            <Icon size={14} strokeWidth={2.5} />
            <span>{localStatus}</span>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/70 opacity-60 transition group-hover:opacity-100">
              <Pencil size={10} />
            </span>
          </motion.button>
        </Tooltip>
      </>
    );
  }

  // Action buttons (no status yet, editing, or saving)
  return (
    <>
      {errorPopup}
      <motion.div
        initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }}
        className="inline-flex items-center gap-1 rounded-2xl bg-gray-50 p-1 ring-1 ring-gray-200"
        role="group" aria-label="Mark attendance"
      >
        {["Present", "Half Day", "Absent", "Leave"].map((s) => {
          const config = statusConfig[s];
          const Icon = config.icon;
          const isCurrent = localStatus === s;
          const isSaving = pending === s;
          return (
            <Tooltip key={s} label={isCurrent ? `Currently ${s}` : `Mark as ${s}`}>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  markEmployee(s);
                  setEditMode(false);
                }}
                aria-label={`Mark as ${s}`}
                className={`flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold transition-all duration-200 hover:shadow-md active:scale-95 disabled:cursor-wait disabled:opacity-60 ${
                  isCurrent || isSaving ? `${config.active} shadow-md` : `bg-white ${config.btn}`
                }`}
              >
                {isSaving ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} strokeWidth={2.5} />}
                <span className="hidden xl:inline">{config.short}</span>
              </button>
            </Tooltip>
          );
        })}
        {editMode && !loading && (
          <Tooltip label="Cancel">
            <button type="button" onClick={() => setEditMode(false)} aria-label="Cancel"
              className="flex h-9 w-8 items-center justify-center rounded-xl text-gray-400 transition hover:bg-white hover:text-gray-700">
              <X size={15} />
            </button>
          </Tooltip>
        )}
      </motion.div>
    </>
  );
};

export default AttendanceHelper;