import axios from "axios";
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Search, ClipboardList, PlusCircle, Calendar, Info, XCircle, AlertTriangle, Check,
  Clock3, CheckCircle2, Ban, X, Loader2, ArrowRight, Umbrella, Stethoscope, Plane, Baby, Briefcase, RefreshCw,
  CalendarX2, Quote, ChevronDown, HeartHandshake, Repeat, Wallet,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/authContext";

/* ===== STYLES & HELPERS ===== */
const PAGE_BG =
  "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const CARD =
  "rounded-3xl bg-white/90 ring-1 ring-white/70 shadow-[0_10px_40px_-12px_rgba(127,29,29,0.18)] backdrop-blur";
const PAGE_SIZE_OPTIONS = [5, 8, 10, 15, 20];

const STATUS_THEME = {
  approved: { chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", strip: "bg-emerald-500", Icon: CheckCircle2 },
  pending: { chip: "bg-amber-50 text-amber-700 ring-amber-200", strip: "bg-amber-400", Icon: Clock3 },
  rejected: { chip: "bg-red-50 text-red-700 ring-red-200", strip: "bg-red-500", Icon: XCircle },
  cancelled: { chip: "bg-gray-100 text-gray-500 ring-gray-200", strip: "bg-gray-300", Icon: Ban },
  default: { chip: "bg-gray-100 text-gray-500 ring-gray-200", strip: "bg-gray-300", Icon: Info },
};
const themeFor = (s) => STATUS_THEME[(s || "").toLowerCase()] || STATUS_THEME.default;

const typeIcon = (t = "") => {
  const s = t.toLowerCase();
  if (s.includes("sick") || s.includes("medical")) return Stethoscope;
  if (s.includes("casual")) return Umbrella;
  if (s.includes("annual") || s.includes("vacation") || s.includes("earned")) return Plane;
  if (s.includes("maternity")) return Baby;
  if (s.includes("paternity")) return HeartHandshake;
  if (s.includes("comp")) return Repeat;
  if (s.includes("loss of pay") || s.includes("lop")) return Wallet;
  return Briefcase;
};

/* ---------- modal shell ---------- */
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
        className="relative max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-3xl bg-white shadow-2xl ring-1 ring-gray-100">
        {children}
      </motion.div>
    </motion.div>,
    document.body
  );
};

const ActionModal = ({ modalState, onClose }) => {
  const isSuccess = modalState?.type === "success";
  const leave = modalState?.leave;

  return (
    <AnimatePresence>
      {modalState && (
        <Modal key="action" onClose={onClose}>
          <div className={`h-1.5 bg-gradient-to-r ${isSuccess ? "from-emerald-500 to-teal-400" : "from-red-600 to-rose-400"}`} />
          <div className="p-7 text-center">
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 15 }}
              className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ring-1 ${isSuccess ? "bg-emerald-50 text-emerald-600 ring-emerald-100" : "bg-red-50 text-red-600 ring-red-100"}`}>
              {isSuccess ? <Check size={28} /> : <AlertTriangle size={28} />}
            </motion.div>
            <h3 className="text-xl font-extrabold tracking-tight text-gray-900">{modalState.title}</h3>
            <p className="mt-2 text-sm text-gray-500">{modalState.message}</p>
            {leave && (
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-gray-50 p-3 text-left ring-1 ring-gray-100">
                <DateBadge date={leave.startDate} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-gray-900">{leave.leaveType}</p>
                  <p className="truncate text-xs text-gray-500">{formatDate(leave.startDate)} → {formatDate(leave.endDate)}</p>
                </div>
                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-gray-700 ring-1 ring-gray-200">{leave.days} d</span>
              </div>
            )}
            {leave && (leave.status || "").toLowerCase() === "approved" && !isSuccess && (
              <p className="mt-3 text-xs font-semibold text-amber-700">This leave is already approved — cancelling gives the days back to your balance.</p>
            )}
          </div>
          <div className={`grid gap-2 px-7 pb-7 ${isSuccess ? "grid-cols-1" : "grid-cols-2"}`}>
            {!isSuccess && (
              <button onClick={onClose} className="rounded-2xl bg-gray-100 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-200">
                {modalState.cancelLabel || "No, keep it"}
              </button>
            )}
            <button
              onClick={() => {
                if (isSuccess) {
                  onClose();
                  return;
                }
                onClose();
                modalState.onConfirm?.();
              }}
              className={`rounded-2xl bg-gradient-to-r py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98] ${isSuccess ? "from-emerald-600 to-teal-500 shadow-emerald-600/30" : "from-red-600 to-rose-500 shadow-red-600/30"}`}
            >
              {modalState.confirmLabel || "Got it, thanks"}
            </button>
          </div>
        </Modal>
      )}
    </AnimatePresence>
  );
};

const formatDate = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
};

const getNetDays = (start, end, holidaySet) => {
  if (!start || !end) return 0;
  let count = 0;
  let current = new Date(start);
  const last = new Date(end);
  current.setHours(0, 0, 0, 0);
  last.setHours(0, 0, 0, 0);
  while (current <= last) {
    const day = current.getDay();
    const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(current.getDate()).padStart(2, "0")}`;
    if (day !== 0 && day !== 6 && !holidaySet.has(dateStr)) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
};

const daysFromToday = (d) => {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  return Math.round((x - t) / 86400000);
};
const whenLabel = (leave) => {
  const s = daysFromToday(leave.startDate), e = daysFromToday(leave.endDate);
  if (isNaN(s)) return null;
  if (s > 1) return { text: `Starts in ${s} days`, tone: "bg-sky-50 text-sky-700 ring-sky-100" };
  if (s === 1) return { text: "Starts tomorrow", tone: "bg-sky-50 text-sky-700 ring-sky-100" };
  if (s === 0) return { text: "Starts today", tone: "bg-red-600 text-white ring-red-600" };
  if (e >= 0) return { text: "On leave now", tone: "bg-violet-50 text-violet-700 ring-violet-100" };
  return null;
};
const pageList = (total, cur) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out = [1];
  const s = Math.max(2, cur - 1), e = Math.min(total - 1, cur + 1);
  if (s > 2) out.push("…");
  for (let i = s; i <= e; i++) out.push(i);
  if (e < total - 1) out.push("…");
  out.push(total);
  return out;
};
const Highlight = ({ text = "", q }) => {
  const t = String(text ?? "");
  if (!q) return <>{t}</>;
  const i = t.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{t}</>;
  return <>{t.slice(0, i)}<mark className="rounded bg-red-100 px-0.5 text-red-700">{t.slice(i, i + q.length)}</mark>{t.slice(i + q.length)}</>;
};

const DateBadge = ({ date, size = "md", muted = false }) => {
  const d = new Date(date);
  const big = size === "md";
  return (
    <div className={`flex shrink-0 flex-col overflow-hidden rounded-xl bg-white text-center leading-none shadow-sm ring-1 ring-gray-100 ${big ? "h-14 w-14" : "h-11 w-11"}`}>
      <span className={`py-0.5 text-[9px] font-bold uppercase text-white ${muted ? "bg-gray-300" : "bg-gradient-to-r from-red-600 to-rose-500"}`}>{isNaN(d) ? "—" : d.toLocaleDateString("en-IN", { month: "short" })}</span>
      <span className={`flex flex-1 items-center justify-center font-extrabold ${muted ? "text-gray-400" : "text-gray-900"} ${big ? "text-xl" : "text-base"}`}>{isNaN(d) ? "" : d.getDate()}</span>
    </div>
  );
};

const StatusChip = ({ status }) => {
  const t = themeFor(status);
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${t.chip}`}>
      <t.Icon size={12} /> {status || "Unknown"}
    </span>
  );
};

const EmployeeLeaveList = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [cancellingId, setCancellingId] = useState(null);
  const [modalState, setModalState] = useState(null);
  const navigate = useNavigate();
  // UI-only
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [statusTab, setStatusTab] = useState("all");
  const [expanded, setExpanded] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };
      const [leaveRes, holidayRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/leave/${id}/${user.role}`, { headers }),
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/holiday/all`, { headers })
      ]);
      if (leaveRes.data.success) setLeaves(leaveRes.data.leaves || []);
      if (holidayRes.data.success) setHolidays(holidayRes.data.holidays || []);
    } catch (err) {
      setError("Couldn't load your leave records.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id, user.role]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(""), 3500);
    return () => clearTimeout(t);
  }, [successMessage]);

  const processedData = useMemo(() => {
    const q = search.toLowerCase();
    return leaves
      .filter(l => (l.leaveType || "").toLowerCase().includes(q) || (l.reason || "").toLowerCase().includes(q))
      .filter(l => statusTab === "all" || (l.status || "").toLowerCase() === statusTab)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [leaves, search, statusTab]);

  const totalPages = Math.max(1, Math.ceil(processedData.length / itemsPerPage));
  const page = Math.min(currentPage, totalPages);
  const currentItems = processedData.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const handleCancelLeave = async (leaveId) => {
    try {
      setCancellingId(leaveId);
      setError(null);
      const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };
      const res = await axios.put(`${import.meta.env.VITE_BACKEND_URL}/api/leave/cancel/${leaveId}`, {}, { headers });

      if (res.data.success) {
        await fetchData();
        setCurrentPage(1);
        setSuccessMessage("Leave request cancelled successfully.");
        setModalState({
          type: "success",
          title: "Leave cancelled",
          message: "Your leave request has been cancelled.",
          confirmLabel: "Got it, thanks",
        });
      } else {
        setError(res.data.message || "Unable to cancel leave request");
      }
    } catch (err) {
      setError("Unable to cancel leave request");
      console.error(err);
    } finally {
      setCancellingId(null);
    }
  };

  /* ---------- UI-only derived ---------- */
  const year = new Date().getFullYear();
  const lc = (l) => (l.status || "").toLowerCase();
  const counts = {
    all: leaves.length,
    pending: leaves.filter((l) => lc(l) === "pending").length,
    approved: leaves.filter((l) => lc(l) === "approved").length,
    rejected: leaves.filter((l) => lc(l) === "rejected").length,
    cancelled: leaves.filter((l) => lc(l) === "cancelled").length,
  };
  const approvedThisYear = leaves.filter((l) => lc(l) === "approved" && new Date(l.startDate).getFullYear() === year);
  const daysTakenThisYear = approvedThisYear.reduce((s, l) => s + (Number(l.days) || 0), 0);
  const byType = approvedThisYear.reduce((m, l) => { m[l.leaveType || "Other"] = (m[l.leaveType || "Other"] || 0) + (Number(l.days) || 0); return m; }, {});
  const nextLeave = leaves
    .filter((l) => ["approved", "pending"].includes(lc(l)) && daysFromToday(l.endDate) >= 0)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))[0];
  const canCancel = (leave) => user.role === "employee" && ["pending", "approved"].includes(lc(leave));
  const askCancel = (leave) => setModalState({
    type: "confirm",
    title: "Cancel this leave request?",
    message: `Are you sure you want to cancel this ${leave.leaveType || "leave"} request?`,
    cancelLabel: "No, keep it",
    confirmLabel: "Yes, cancel it",
    leave,
    onConfirm: () => handleCancelLeave(leave._id),
  });
  const TABS = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
    { key: "cancelled", label: "Cancelled" },
  ];
  const q = search.trim();

  const CancelBtn = ({ leave, full = false }) =>
    canCancel(leave) ? (
      <button
        onClick={(e) => { e.stopPropagation(); askCancel(leave); }}
        disabled={cancellingId === leave._id}
        className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-bold text-red-600 ring-1 ring-red-200 transition hover:bg-red-600 hover:text-white hover:ring-red-600 disabled:opacity-60 ${full ? "w-full" : ""}`}
      >
        {cancellingId === leave._id ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
        {cancellingId === leave._id ? "Cancelling…" : "Cancel"}
      </button>
    ) : null;

  return (
    <>
      <ActionModal
        modalState={modalState}
        onClose={() => setModalState(null)}
      />
      {createPortal(
        <AnimatePresence>
          {successMessage && !modalState && (
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
              className="fixed inset-x-0 bottom-5 z-[110] flex justify-center px-4">
              <div className="flex max-w-full items-center gap-3 rounded-2xl bg-gray-900 py-3 pl-4 pr-2 text-sm font-semibold text-white shadow-2xl">
                <CheckCircle2 size={18} className="shrink-0 text-emerald-400" /> <span className="min-w-0">{successMessage}</span>
                <button onClick={() => setSuccessMessage("")} aria-label="Dismiss" className="rounded-lg p-1 text-white/60 hover:bg-white/10 hover:text-white"><X size={15} /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <div className={`min-h-screen w-full overflow-x-hidden ${PAGE_BG} pb-12`}>
        <div className="mx-auto w-full max-w-[1400px] space-y-5 p-3 sm:space-y-6 sm:p-6 lg:p-8">

          {/* HEADER */}
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/30">
                <ClipboardList size={26} />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">{user.role === "employee" ? "My leaves" : "Leave records"}</h1>
                <p className="text-sm text-gray-500">Requests, approvals and history</p>
              </div>
            </div>
            {user.role === "employee" && (
              <Link
                to="/employee-dashboard/add-leave"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:-translate-y-0.5 sm:w-auto hover:brightness-110 active:scale-[0.98]"
              >
                <PlusCircle size={17} /> Request leave
              </Link>
            )}
          </header>

          {/* STATS */}
          <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="relative col-span-2 min-w-0 overflow-hidden rounded-3xl bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 p-4 text-white sm:p-5 shadow-xl shadow-red-600/25 lg:col-span-1">
              <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/15 blur-2xl" />
              <p className="relative text-[11px] font-semibold uppercase tracking-wider text-white/80">Days taken in {year}</p>
              <p className="relative mt-2 text-3xl font-extrabold tabular-nums sm:text-4xl">{loading ? "–" : daysTakenThisYear}</p>
              <div className="relative mt-2 flex flex-wrap gap-1.5">
                {Object.entries(byType).slice(0, 3).map(([t, d]) => (
                  <span key={t} className="max-w-full truncate rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold ring-1 ring-white/20">{t}: {d}</span>
                ))}
                {!Object.keys(byType).length && !loading && <span className="text-xs text-white/80">No approved leave yet</span>}
              </div>
              <div className="relative mt-4 grid grid-cols-2 gap-2 sm:hidden">
                {[
                  { key: "pending", label: "Awaiting", value: counts.pending, Icon: Clock3 },
                  { key: "approved", label: "Approved", value: counts.approved, Icon: CheckCircle2 },
                ].map((s) => (
                  <button key={s.key} type="button" onClick={() => { setStatusTab(s.key); setCurrentPage(1); }}
                    className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-left ring-1 transition ${statusTab === s.key ? "bg-white text-red-700 ring-white" : "bg-white/15 ring-white/20"}`}>
                    <s.Icon size={16} className="shrink-0" />
                    <span className="text-lg font-extrabold tabular-nums leading-none">{loading ? "–" : s.value}</span>
                    <span className="truncate text-[11px] font-semibold opacity-90">{s.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
            {[
              { key: "pending", label: "Awaiting approval", value: counts.pending, Icon: Clock3, tone: "bg-amber-50 text-amber-600" },
              { key: "approved", label: "Approved", value: counts.approved, Icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600" },
            ].map((s, i) => (
              <motion.button type="button" key={s.key} onClick={() => { setStatusTab(s.key); setCurrentPage(1); }}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * (i + 1) }}
                className={`${CARD} hidden min-w-0 p-3.5 text-left transition hover:-translate-y-0.5 sm:block sm:p-5 ${statusTab === s.key ? "ring-2 ring-red-300" : ""}`}>
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.tone}`}><s.Icon size={17} /></div>
                <p className="mt-3 text-2xl font-extrabold tabular-nums text-gray-900">{loading ? "–" : s.value}</p>
                <p className="truncate text-xs font-semibold text-gray-500">{s.label}</p>
              </motion.button>
            ))}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className={`${CARD} col-span-2 min-w-0 px-4 py-3 sm:p-5 lg:col-span-1`}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Next leave</p>
              {nextLeave ? (
                <div className="mt-2 flex items-center gap-3">
                  <DateBadge date={nextLeave.startDate} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-900">{nextLeave.leaveType}</p>
                    <p className="text-xs text-gray-500">{nextLeave.days} day{Number(nextLeave.days) === 1 ? "" : "s"} · {nextLeave.status}</p>
                    {whenLabel(nextLeave) && <p className="mt-0.5 text-xs font-semibold text-red-600">{whenLabel(nextLeave).text}</p>}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-gray-400">{loading ? "…" : "Nothing planned"}</p>
              )}
            </motion.div>
          </div>

          {/* MAIN CONTAINER */}
          <div className={`${CARD} overflow-hidden`}>
            {/* toolbar */}
            <div className="flex min-w-0 flex-col gap-3 border-b border-gray-100 p-3 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="-mx-1 min-w-0 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="grid grid-cols-5 gap-1 rounded-2xl bg-gray-100/80 p-1 sm:flex sm:w-max">
                  {TABS.map((t) => (
                    <button key={t.key} onClick={() => { setStatusTab(t.key); setCurrentPage(1); }}
                      className={`relative flex min-w-0 flex-col items-center justify-center gap-0.5 whitespace-nowrap rounded-xl px-0.5 py-1.5 text-[11px] sm:flex-row sm:gap-1.5 sm:px-3.5 sm:py-2 sm:text-sm font-semibold transition ${statusTab === t.key ? "text-white" : "text-gray-500 hover:text-gray-800"}`}>
                      {statusTab === t.key && (
                        <motion.span layoutId="leave-tab" className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 shadow-md shadow-red-600/25"
                          transition={{ type: "spring", stiffness: 400, damping: 32 }} />
                      )}
                      <span className="relative max-w-full truncate">{t.label}</span>
                      <span className={`relative rounded-full px-1.5 text-[11px] font-bold ${statusTab === t.key ? "bg-white/25" : t.key === "pending" && counts.pending ? "bg-amber-400 text-white" : "bg-white text-gray-500"}`}>{counts[t.key]}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative w-full lg:w-80">
                <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search leave type or reason…"
                  className="w-full rounded-2xl border-0 bg-gray-50 py-2.5 pl-10 pr-9 text-sm text-gray-900 ring-1 ring-gray-200 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-400"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                />
                {search && (
                  <button onClick={() => { setSearch(""); setCurrentPage(1); }} aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X size={15} /></button>
                )}
              </div>
            </div>

            {error && (
              <div className="flex flex-wrap items-center gap-2 border-b border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 sm:gap-3 sm:px-5">
                <AlertTriangle size={16} className="shrink-0" />
                <span className="min-w-0 flex-1 break-words">{error}</span>
                <button onClick={fetchData} className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-red-700 ring-1 ring-red-200 hover:bg-red-100"><RefreshCw size={12} /> Retry</button>
                <button onClick={() => setError(null)} aria-label="Dismiss" className="rounded-lg p-1 hover:bg-red-100"><X size={15} /></button>
              </div>
            )}

            {loading ? (
              <div className="divide-y divide-gray-50">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex animate-pulse items-center gap-4 px-5 py-4">
                    <div className="h-14 w-14 rounded-xl bg-gray-100" />
                    <div className="flex-1 space-y-2"><div className="h-4 w-1/4 rounded bg-gray-100" /><div className="h-3 w-1/3 rounded bg-gray-50" /></div>
                    <div className="hidden h-6 w-20 rounded-full bg-gray-100 sm:block" />
                  </div>
                ))}
              </div>
            ) : processedData.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-16 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500 ring-1 ring-red-100"><CalendarX2 size={28} /></div>
                <p className="text-base font-bold text-gray-900">{leaves.length ? "No leaves match" : "No leave requests yet"}</p>
                <p className="mt-1 text-sm text-gray-500">{leaves.length ? "Try another search or status." : "When you request leave it will show up here."}</p>
                {leaves.length ? (
                  <button onClick={() => { setSearch(""); setStatusTab("all"); setCurrentPage(1); }} className="mt-5 rounded-2xl bg-gray-100 px-5 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-200">Show all</button>
                ) : user.role === "employee" && (
                  <Link to="/employee-dashboard/add-leave" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-600/30"><PlusCircle size={16} /> Request leave</Link>
                )}
              </div>
            ) : (
              <>
                {/* MOBILE VIEW */}
                <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:hidden">
                  {currentItems.map((leave) => {
                    const t = themeFor(leave.status);
                    const TIcon = typeIcon(leave.leaveType);
                    const muted = ["cancelled", "rejected"].includes(lc(leave));
                    const w = whenLabel(leave);
                    return (
                      <motion.div key={leave._id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className={`relative min-w-0 overflow-hidden rounded-2xl bg-white p-3 pl-4 ring-1 ring-gray-100 ${muted ? "opacity-80" : ""}`}>
                        <span className={`absolute inset-y-0 left-0 w-1 ${t.strip}`} />
                        <div className="flex items-center gap-3">
                          <DateBadge date={leave.startDate} size="sm" muted={muted} />
                          <div className="min-w-0 flex-1">
                            <p className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-gray-900"><TIcon size={13} className="shrink-0 text-red-500" /><span className="min-w-0 truncate"><Highlight text={leave.leaveType} q={q} /></span></p>
                            <p className="mt-0.5 truncate text-xs text-gray-500">{formatDate(leave.startDate)} → {formatDate(leave.endDate)}</p>
                          </div>
                          <div className="shrink-0 rounded-xl bg-gray-50 px-2.5 py-1.5 text-center ring-1 ring-gray-100">
                            <p className="text-base font-extrabold leading-none tabular-nums text-gray-900">{leave.days}</p>
                            <p className="mt-0.5 text-[9px] font-semibold uppercase text-gray-400">day{Number(leave.days) === 1 ? "" : "s"}</p>
                          </div>
                        </div>
                        {leave.reason && <p className="mt-2 truncate text-xs text-gray-500" title={leave.reason}><Highlight text={leave.reason} q={q} /></p>}
                        {leave.compOffFor && <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-sky-700"><Repeat size={11} /> Worked on {formatDate(leave.compOffFor)}</p>}
                        <div className="mt-2.5 flex items-center gap-1.5 border-t border-gray-50 pt-2.5">
                          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                            <StatusChip status={leave.status} />
                            {w && !muted && <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${w.tone}`}>{w.text}</span>}
                          </div>
                          <CancelBtn leave={leave} />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* DESKTOP TABLE */}
                <div className="hidden lg:block">
                  <table className="w-full table-auto border-collapse text-left">
                    <thead>
                      <tr className="bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                        <th className="py-3 pl-6 pr-3">Leave</th>
                        <th className="px-3 py-3">Dates</th>
                        <th className="px-3 py-3 text-center">Days</th>
                        <th className="px-3 py-3">Reason</th>
                        <th className="px-3 py-3">Status</th>
                        <th className="w-px whitespace-nowrap py-3 pl-3 pr-6 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {currentItems.map((leave, i) => {
                        const t = themeFor(leave.status);
                        const TIcon = typeIcon(leave.leaveType);
                        const muted = ["cancelled", "rejected"].includes(lc(leave));
                        const w = whenLabel(leave);
                        const open = expanded === leave._id;
                        return (
                          <React.Fragment key={leave._id}>
                            <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                              onClick={() => setExpanded(open ? null : leave._id)}
                              className={`group cursor-pointer transition hover:bg-red-50/40 ${open ? "bg-red-50/30" : ""}`}>
                              <td className="relative py-3.5 pl-6 pr-3">
                                <span className={`absolute inset-y-2 left-0 w-1 rounded-r-full ${t.strip}`} />
                                <div className="flex items-center gap-3">
                                  <DateBadge date={leave.startDate} size="sm" muted={muted} />
                                  <div className="min-w-0">
                                    <p className={`flex items-center gap-1.5 font-bold ${muted ? "text-gray-500" : "text-gray-900 group-hover:text-red-700"}`}>
                                      <TIcon size={14} className="shrink-0 text-red-500" /><Highlight text={leave.leaveType} q={q} />
                                    </p>
                                    <p className="text-xs text-gray-400">Requested {formatDate(leave.createdAt)}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-3 py-3.5">
                                <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                                  {formatDate(leave.startDate)} <ArrowRight size={12} className="text-gray-300" /> {formatDate(leave.endDate)}
                                </p>
                                {w && !muted && <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${w.tone}`}>{w.text}</span>}
                              </td>
                              <td className="px-3 py-3.5 text-center">
                                <span className="text-xl font-extrabold tabular-nums text-gray-900">{leave.days}</span>
                              </td>
                              <td className="max-w-0 px-3 py-3.5 xl:w-[28%]">
                                <p className="flex items-center gap-1 truncate text-sm text-gray-500" title={leave.reason}>
                                  {leave.reason ? <Highlight text={leave.reason} q={q} /> : <span className="text-gray-300">—</span>}
                                </p>
                              </td>
                              <td className="px-3 py-3.5"><StatusChip status={leave.status} /></td>
                              <td className="w-px whitespace-nowrap py-3.5 pl-3 pr-6 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <CancelBtn leave={leave} />
                                  <ChevronDown size={16} className={`text-gray-300 transition ${open ? "rotate-180 text-red-500" : ""}`} />
                                </div>
                              </td>
                            </motion.tr>
                            <AnimatePresence initial={false}>
                              {open && (
                                <tr>
                                  <td colSpan={6} className="p-0">
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                      <div className="flex flex-col gap-3 border-t border-red-50 bg-red-50/20 px-6 py-4 sm:flex-row">
                                        <div className="flex-1">
                                          <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400"><Quote size={11} /> Reason</p>
                                          <p className="whitespace-pre-line text-sm text-gray-700">{leave.reason || "No reason provided"}</p>
                                          {leave.compOffFor && <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-100"><Repeat size={12} /> For the day you worked: {formatDate(leave.compOffFor)}</p>}
                                          {leave.leaveType === "Loss of Pay" && <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"><Wallet size={12} /> Unpaid, deducted from salary</p>}
                                        </div>
                                        <div className="flex gap-2 sm:w-72">
                                          {[["From", formatDate(leave.startDate)], ["To", formatDate(leave.endDate)], ["Days", leave.days]].map(([l, v]) => (
                                            <div key={l} className="flex-1 rounded-xl bg-white p-2.5 text-center ring-1 ring-gray-100">
                                              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{l}</p>
                                              <p className="text-sm font-bold text-gray-900">{v}</p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </motion.div>
                                  </td>
                                </tr>
                              )}
                            </AnimatePresence>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* PAGINATION */}
                <div className="flex flex-col gap-3 border-t border-gray-100 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4 sm:px-6">
                  <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-gray-500 sm:justify-start">
                    <span>Showing <b className="text-gray-900">{(page - 1) * itemsPerPage + 1}–{Math.min(page * itemsPerPage, processedData.length)}</b> of <b className="text-gray-900">{processedData.length}</b></span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400">Per page</span>
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <button key={n} onClick={() => { setItemsPerPage(n); setCurrentPage(1); }}
                          className={`h-7 min-w-7 rounded-lg px-1.5 text-xs font-bold transition ${itemsPerPage === n ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "text-gray-500 hover:bg-gray-100"}`}>{n}</button>
                      ))}
                    </div>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex flex-wrap items-center justify-center gap-1">
                      <button onClick={() => setCurrentPage(Math.max(page - 1, 1))} disabled={page === 1} aria-label="Previous page"
                        className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl text-gray-500 ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200 disabled:opacity-30"><ChevronLeft size={16} /></button>
                      {pageList(totalPages, page).map((p, i) =>
                        p === "…" ? <span key={`g${i}`} className="w-6 text-center text-gray-400">…</span> : (
                          <button key={p} onClick={() => setCurrentPage(p)}
                            className={`relative h-8 min-w-8 rounded-xl px-2 text-sm sm:h-9 sm:min-w-9 font-bold transition ${p === page ? "text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                            {p === page && <motion.span layoutId="leave-page" className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 shadow-md shadow-red-600/25" />}
                            <span className="relative">{p}</span>
                          </button>
                        )
                      )}
                      <button onClick={() => setCurrentPage(Math.min(page + 1, totalPages))} disabled={page === totalPages} aria-label="Next page"
                        className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl text-gray-500 ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200 disabled:opacity-30"><ChevronRight size={16} /></button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default EmployeeLeaveList;