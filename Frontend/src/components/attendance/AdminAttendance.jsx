import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, CalendarDays, FileText, ChevronLeft, ChevronRight, Clock, ShieldAlert, Activity,
  Hash, Briefcase, MessageSquareText, X, Users, UserCheck, UserX, Plane, CircleDashed,
  RefreshCw, Pause, LogIn, LogOut, Timer,
} from "lucide-react";
import { Link } from "react-router-dom";
import AttendanceHelper from "../../utils/AttendanceHelper";

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20];

const PAGE_BG =
  "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const CARD =
  "rounded-3xl bg-white/90 ring-1 ring-white/70 shadow-[0_10px_40px_-12px_rgba(127,29,29,0.18)] backdrop-blur";

const formatTimer = (attendance) => {
  if (!attendance?.checkIn) return "00:00:00";
  const endTime = attendance.checkOut ? new Date(attendance.checkOut) : attendance.isPaused ? new Date(attendance.pauseStartedAt) : new Date();
  const diffMs = endTime - new Date(attendance.checkIn) - (attendance.totalPausedMs || 0);
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const normalizeStatus = (status) => {
  if (status === null || status === undefined || status === "") return "";
  return status.toString().toLowerCase().replace(/\s+/g, "");
};

const getTodayLabel = () => new Date().toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });

/* ---------- UI helpers ---------- */
const STATUS_META = {
  present: { label: "Present", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 ring-emerald-100", bar: "bg-emerald-500" },
  absent: { label: "Absent", dot: "bg-red-500", chip: "bg-red-50 text-red-700 ring-red-100", bar: "bg-red-500" },
  leave: { label: "On leave", dot: "bg-amber-500", chip: "bg-amber-50 text-amber-700 ring-amber-100", bar: "bg-amber-400" },
  halfday: { label: "Half day", dot: "bg-sky-500", chip: "bg-sky-50 text-sky-700 ring-sky-100", bar: "bg-sky-500" },
  "": { label: "Not marked", dot: "bg-gray-300", chip: "bg-gray-100 text-gray-500 ring-gray-200", bar: "bg-gray-300" },
};
const metaFor = (status) => STATUS_META[normalizeStatus(status)] || {
  label: String(status), dot: "bg-sky-500", chip: "bg-sky-50 text-sky-700 ring-sky-100", bar: "bg-sky-500",
};

const timeOf = (v) => (v ? new Date(v).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : null);

const AVATAR_BG = ["from-red-500 to-rose-400", "from-violet-500 to-fuchsia-400", "from-sky-500 to-cyan-400", "from-amber-500 to-orange-400", "from-emerald-500 to-teal-400"];
const colorFor = (s = "") => AVATAR_BG[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_BG.length];
const initials = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

const sessionState = (a) => {
  if (!a.checkIn) return "idle";
  if (a.checkOut) return "done";
  if (a.isPaused) return "paused";
  return "live";
};

const TimerPill = ({ a, compact }) => {
  const st = sessionState(a);
  const tone = {
    live: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    paused: "bg-amber-50 text-amber-800 ring-amber-200",
    done: "bg-gray-50 text-gray-700 ring-gray-200",
    idle: "bg-gray-50 text-gray-300 ring-gray-100",
  }[st];
  return (
    <div className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 font-mono text-sm font-bold tabular-nums ring-1 ${tone} ${compact ? "text-xs" : ""}`}>
      {st === "live" ? (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
      ) : st === "paused" ? <Pause size={12} /> : <Clock size={12} className="opacity-60" />}
      {a.timer}
    </div>
  );
};

const AdminAttendance = () => {
  const [attendance, setAttendance] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  const [dayStatus, setDayStatus] = useState("");
  const [isOffDay, setIsOffDay] = useState(false);
  // UI-only
  const [statusFilter, setStatusFilter] = useState("all");
  const [lastSynced, setLastSynced] = useState(null);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/attendance`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (res.data.success) {
        setIsOffDay(res.data.isOffDay || false);
        setDayStatus(res.data.reason || "");

        setAttendance((res.data.attendance || []).map((a) => ({
          ...a,
          employeeMongoId: a.employeeId?._id,
          employeeCode: a.employeeId?.employeeId || "N/A",
          name: a.employeeId?.userId?.name || "Unknown",
          department: a.employeeId?.department?.dep_name || "N/A",
          timer: formatTimer(a),
        })));
        setCurrentPage(1);
        setLastSynced(new Date());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_BACKEND_URL}/api/attendance-request`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        params: { status: "Pending" },
      })
      .then((res) => { if (res.data?.success) setPendingRequestCount(res.data.requests.length); })
      .catch(() => {});
  }, []);

  // Manual status changes go through AttendanceHelper -> PUT /api/attendance/update/:employeeId
  // (the single admin manual-status contract; POST /api/attendance/admin-mark does not exist).

  useEffect(() => { fetchAttendance(); }, []);

  const sorted = useMemo(() => {
    const q = search.toLowerCase();
    return attendance
      .filter((e) =>
        e.name.toLowerCase().includes(q) ||
        String(e.employeeCode).toLowerCase().includes(q) ||
        String(e.department).toLowerCase().includes(q)
      )
      .filter((e) => statusFilter === "all" || normalizeStatus(e.status) === statusFilter)
      .sort((a, b) => a.employeeCode.localeCompare(b.employeeCode, undefined, { numeric: true }));
  }, [attendance, search, statusFilter]);

  const totalPages = Math.ceil(sorted.length / itemsPerPage);
  const paginated = useMemo(() => sorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [sorted, currentPage, itemsPerPage]);

  const handlePageSizeChange = (size) => {
    setItemsPerPage(size);
    setCurrentPage(1);
  };

  const presentCount = useMemo(
    () => attendance.filter((a) => normalizeStatus(a.status) === "present").length,
    [attendance]
  );

  const absentCount = useMemo(
    () => attendance.filter((a) => normalizeStatus(a.status) === "absent").length,
    [attendance]
  );

  const leaveCount = useMemo(
    () => attendance.filter((a) => normalizeStatus(a.status) === "leave").length,
    [attendance]
  );

  useEffect(() => {
    const visibleIds = paginated.map((p) => p._id ?? p.employeeMongoId);
    const interval = setInterval(() => {
      setAttendance((prev) => prev.map((att) => {
        const key = att._id ?? att.employeeMongoId;
        if (!visibleIds.includes(key) || att.isPaused || att.checkOut) return att;
        return { ...att, timer: formatTimer(att) };
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, [paginated]);

  /* ---------- derived UI values ---------- */
  const total = attendance.length;
  const unmarkedCount = attendance.filter((a) => !normalizeStatus(a.status)).length;
  const halfDayCount = attendance.filter((a) => normalizeStatus(a.status) === "halfday").length;
  const liveCount = attendance.filter((a) => sessionState(a) === "live").length;
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
  const startIndex = (currentPage - 1) * itemsPerPage;

  const FILTERS = [
    ["all", "All", total, Users],
    ["present", "Present", presentCount, UserCheck],
    ["absent", "Absent", absentCount, UserX],
    ["halfday", "Half day", halfDayCount, Clock],
    ["leave", "On leave", leaveCount, Plane],
    ["", "Not marked", unmarkedCount, CircleDashed],
  ];

  const pageNumbers = useMemo(() => {
    const t = totalPages || 1;
    if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1);
    const set = new Set([1, t, currentPage - 1, currentPage, currentPage + 1]);
    const arr = [...set].filter((p) => p >= 1 && p <= t).sort((a, b) => a - b);
    const out = [];
    arr.forEach((p, i) => { if (i && p - arr[i - 1] > 1) out.push("…" + i); out.push(p); });
    return out;
  }, [totalPages, currentPage]);

  const hasFilters = search || statusFilter !== "all";
  const clearFilters = () => { setSearch(""); setStatusFilter("all"); setCurrentPage(1); };
  const emptyText = isOffDay && dayStatus ? dayStatus : hasFilters ? "No one matches these filters." : "No records found for today.";

  return (
    <div className={`min-h-screen overflow-x-hidden ${PAGE_BG} pb-20 text-gray-900`}>
      <div className="mx-auto w-full max-w-[1400px] space-y-5 p-3 sm:space-y-6 sm:p-6 lg:p-8">

        {/* HEADER SECTION */}
        <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="relative flex h-12 w-12 shrink-0 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/30">
              <Activity size={26} />
              {!isOffDay && liveCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-500 ring-2 ring-white" />
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-500">Attendance</p>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                Live <span className="bg-gradient-to-r from-red-600 to-rose-500 bg-clip-text text-transparent">Attendance</span>
              </h1>
              <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-gray-500">
                <CalendarDays size={14} /> {getTodayLabel()}
                {!isOffDay && liveCount > 0 && <span className="text-emerald-600">· {liveCount} working now</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={fetchAttendance} disabled={loading} aria-label="Refresh" title="Refresh"
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-white text-sm font-bold text-gray-600 shadow-sm ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200 disabled:opacity-60 lg:w-auto lg:px-4">
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              <span className="hidden lg:inline">Refresh</span>
            </button>
            <Link
              to="/admin-dashboard/attendance-requests"
              className="relative inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold text-gray-700 sm:flex-none shadow-sm ring-1 ring-gray-200 transition hover:-translate-y-0.5 hover:text-red-600 hover:ring-red-200"
            >
              <MessageSquareText size={16} />
              <span>Requests</span>
              {pendingRequestCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow ring-2 ring-white">
                  {pendingRequestCount}
                </span>
              )}
            </Link>
            <Link
              to="/admin-dashboard/attendance-report"
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-5 text-sm font-bold text-white sm:flex-none shadow-lg shadow-red-600/30 transition hover:-translate-y-0.5 hover:brightness-110"
            >
              <FileText size={16} />
              <span>Archive</span>
            </Link>
          </div>
        </motion.header>

        {/* OFF-DAY BANNER */}
        <AnimatePresence>
          {isOffDay && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-start gap-3 rounded-3xl bg-gradient-to-r from-amber-50 to-orange-50 p-4 ring-1 ring-amber-200">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-600 shadow-sm"><ShieldAlert size={18} /></div>
              <div>
                <p className="text-sm font-bold text-amber-900">{dayStatus || "Off day"} · attendance is inactive today</p>
                <p className="text-xs text-amber-800/80">Check-ins are paused. You can still view records and review requests.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* STATS */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="col-span-2 flex min-w-0 flex-col justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 p-4 text-white sm:p-5 shadow-[0_20px_50px_-15px_rgba(220,38,38,0.55)] lg:col-span-1 lg:row-span-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">Attendance today</p>
            {loading && !total ? <div className="mt-2 h-9 w-20 animate-pulse rounded bg-white/30" /> :
              <p className="mt-1 text-4xl font-extrabold tracking-tight">{pct(presentCount)}%</p>}
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-white/20">
              <motion.div className="h-full bg-white" animate={{ width: `${pct(presentCount)}%` }} />
              <motion.div className="h-full bg-sky-200" animate={{ width: `${pct(halfDayCount)}%` }} />
              <motion.div className="h-full bg-amber-300" animate={{ width: `${pct(leaveCount)}%` }} />
              <motion.div className="h-full bg-red-900/40" animate={{ width: `${pct(absentCount)}%` }} />
            </div>
            <p className="mt-2 text-[11px] text-white/80">{presentCount} of {total} present{halfDayCount ? ` · ${halfDayCount} half day` : ""}</p>
          </motion.div>
          {[
            ["Personnel", total, Users, "from-slate-600 to-slate-800", "bg-slate-500"],
            ["Present", presentCount, UserCheck, "from-emerald-500 to-teal-400", "bg-emerald-500"],
            ["Absent", absentCount, UserX, "from-red-500 to-rose-400", "bg-red-500"],
            ["On leave", leaveCount, Plane, "from-amber-500 to-orange-400", "bg-amber-400"],
          ].map(([label, value, Icon, tone, bar], i) => (
            <motion.button type="button" key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * (i + 1) }}
              onClick={() => { setStatusFilter(label === "Personnel" ? "all" : label === "On leave" ? "leave" : label.toLowerCase()); setCurrentPage(1); }}
              className={`${CARD} flex min-w-0 flex-col justify-between gap-3 p-3.5 text-left transition hover:-translate-y-0.5 sm:p-4 ${
                statusFilter === (label === "Personnel" ? "all" : label === "On leave" ? "leave" : label.toLowerCase()) ? "!ring-2 !ring-red-300" : ""
              }`}>
              <div className="flex items-center gap-2.5">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br sm:h-10 sm:w-10 ${tone} text-white shadow-md`}>
                  <Icon size={17} />
                </div>
                <p className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
              </div>
              <div>
                {loading && !total ? <div className="h-7 w-12 animate-pulse rounded bg-gray-200" /> : (
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-2xl font-extrabold tracking-tight tabular-nums text-gray-900 sm:text-3xl">{value}</p>
                    {label !== "Personnel" && total > 0 && <span className="text-xs font-bold tabular-nums text-gray-400">{pct(value)}%</span>}
                  </div>
                )}
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <motion.div className={`h-full rounded-full ${bar}`} initial={{ width: 0 }} animate={{ width: `${label === "Personnel" ? (total ? 100 : 0) : pct(value)}%` }} transition={{ duration: 0.8 }} />
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* MAIN CARD */}
        <div className={`${CARD} overflow-hidden`}>
          {/* Toolbar */}
          <div className="space-y-3 border-b border-gray-100 p-3 sm:space-y-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="group relative flex min-w-0 flex-1 items-center rounded-2xl bg-gray-50 px-4 ring-1 ring-gray-200 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-red-400">
                <Search size={17} className="text-gray-400 transition group-focus-within:text-red-500" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  placeholder="Search name, ID or department…"
                  className="w-full bg-transparent py-3 pl-3 text-sm font-medium text-gray-900 outline-none placeholder:text-gray-400"
                />
                {search && (
                  <button onClick={() => { setSearch(""); setCurrentPage(1); }} aria-label="Clear search" className="rounded-full p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
              </div>
              {lastSynced && (
                <span className="hidden items-center gap-1.5 whitespace-nowrap text-xs text-gray-400 sm:flex">
                  <Timer size={13} /> Synced {lastSynced.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
              {FILTERS.map(([v, label, count, Icon]) => {
                const active = statusFilter === v;
                return (
                  <button key={label} onClick={() => { setStatusFilter(v); setCurrentPage(1); }}
                    className={`relative flex min-w-0 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-[11px] font-semibold transition sm:shrink-0 sm:justify-start sm:gap-2 sm:px-3.5 sm:text-xs ${active ? "text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:text-red-600 hover:ring-red-200"}`}>
                    {active && <motion.span layoutId="att-chip" className="absolute inset-0 rounded-full bg-gradient-to-r from-red-600 to-rose-500 shadow shadow-red-600/30" transition={{ type: "spring", stiffness: 420, damping: 32 }} />}
                    <Icon size={13} className="relative hidden shrink-0 sm:block" />
                    <span className="relative truncate">{label}</span>
                    <span className={`relative rounded-full px-1.5 text-[10px] ${active ? "bg-white/25" : "bg-gray-100 text-gray-500"}`}>{count}</span>
                  </button>
                );
              })}
            </div>

            {hasFilters && !loading && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500"><b className="text-gray-900">{sorted.length}</b> of {total} people</span>
                <button onClick={clearFilters} className="font-semibold text-red-600 hover:underline">Clear filters</button>
              </div>
            )}
          </div>

          {loading && !total ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-4 rounded-2xl p-3">
                  <div className="h-11 w-11 rounded-2xl bg-gray-200" />
                  <div className="flex-1 space-y-2"><div className="h-3 w-40 rounded bg-gray-200" /><div className="h-2.5 w-28 rounded bg-gray-100" /></div>
                  <div className="hidden h-7 w-24 rounded-xl bg-gray-100 sm:block" />
                  <div className="h-8 w-32 rounded-xl bg-gray-100" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE */}
              <div className="hidden md:block">
                <table className="w-full table-auto border-collapse text-left">
                  <thead>
                    <tr className="bg-gray-50/70 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      <th className="w-14 py-3 pl-5 pr-2 font-bold lg:pl-6">#</th>
                      <th className="px-3 py-3 font-bold">Employee</th>
                      <th className="px-3 py-3 font-bold">Status</th>
                      <th className="hidden px-3 py-3 font-bold lg:table-cell">In / Out</th>
                      <th className="px-3 py-3 font-bold">Timer</th>
                      <th className="w-px whitespace-nowrap py-3 pl-3 pr-5 text-right font-bold lg:pr-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginated.length > 0 ? paginated.map((a, i) => {
                      const meta = metaFor(a.status);
                      return (
                        <motion.tr
                          key={a.employeeMongoId}
                          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(i, 10) * 0.03 }}
                          className="group transition-colors hover:bg-red-50/40"
                        >
                          <td className="relative py-3.5 pl-5 pr-2 text-xs font-semibold tabular-nums text-gray-400 lg:pl-6">
                            <span className={`absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full ${meta.bar}`} />
                            {String(startIndex + i + 1).padStart(2, "0")}
                          </td>
                          <td className="max-w-0 px-3 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${colorFor(a.name)} text-xs font-bold text-white shadow-md`}>
                                {initials(a.name)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-gray-900 transition group-hover:text-red-700">{a.name}</p>
                                <p className="flex items-center gap-2 truncate text-xs text-gray-400">
                                  <span className="inline-flex items-center gap-0.5 font-mono"><Hash size={10} />{a.employeeCode}</span>
                                  <span className="inline-flex items-center gap-1 truncate"><Briefcase size={10} />{a.department}</span>
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3.5">
                            <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${meta.chip}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} /> {meta.label}
                            </span>
                          </td>
                          <td className="hidden whitespace-nowrap px-3 py-3.5 text-xs lg:table-cell">
                            {a.checkIn ? (
                              <div className="space-y-0.5">
                                <p className="flex items-center gap-1.5 font-semibold text-gray-700"><LogIn size={12} className="text-emerald-500" /> {timeOf(a.checkIn)}</p>
                                <p className="flex items-center gap-1.5 text-gray-400"><LogOut size={12} className={a.checkOut ? "text-red-500" : ""} /> {timeOf(a.checkOut) || "—"}</p>
                              </div>
                            ) : <span className="text-gray-300">Not checked in</span>}
                          </td>
                          <td className="px-3 py-3.5">
                            <TimerPill a={a} />
                          </td>
                          <td className="w-px whitespace-nowrap py-3.5 pl-3 pr-5 text-right lg:pr-6">
                            <div className="inline-flex justify-end">
                              <AttendanceHelper
                                employeeId={a.employeeMongoId}
                                status={a.status}
                                statusChange={fetchAttendance}
                                checkIn={a.checkIn}
                                checkOut={a.checkOut}
                              />
                            </div>
                          </td>
                        </motion.tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan="6">
                          <EmptyState text={emptyText} offDay={isOffDay} onClear={hasFilters ? clearFilters : null} />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* MOBILE VIEW */}
              <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4 md:hidden">
                {paginated.length > 0 ? paginated.map((a, i) => {
                  const meta = metaFor(a.status);
                  return (
                    <motion.div key={a.employeeMongoId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }}
                      className="relative min-w-0 overflow-hidden rounded-3xl bg-white p-3.5 shadow-sm ring-1 ring-gray-100">
                      <span className={`absolute inset-y-0 left-0 w-1.5 ${meta.bar}`} />
                      <div className="flex items-start justify-between gap-3 pl-2">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${colorFor(a.name)} text-sm font-bold text-white shadow-md`}>
                            {initials(a.name)}
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate font-bold text-gray-900">{a.name}</h3>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span className="inline-flex items-center gap-0.5 rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-gray-500"><Hash size={9} />{a.employeeCode}</span>
                              <span className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500"><Briefcase size={9} className="shrink-0" /><span className="truncate">{a.department}</span></span>
                            </div>
                          </div>
                        </div>
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${meta.chip}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} /> {meta.label}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2 pl-2">
                        <div className="text-[11px] text-gray-400">
                          {a.checkIn ? <>In {timeOf(a.checkIn)}{a.checkOut ? ` · Out ${timeOf(a.checkOut)}` : ""}</> : "Not checked in"}
                        </div>
                        <TimerPill a={a} compact />
                      </div>
                      <div className="mt-3 min-w-0 border-t border-gray-100 pl-2 pt-3 [&>*]:flex-wrap">
                        <AttendanceHelper
                          employeeId={a.employeeMongoId}
                          status={a.status}
                          statusChange={fetchAttendance}
                          checkIn={a.checkIn}
                          checkOut={a.checkOut}
                        />
                      </div>
                    </motion.div>
                  );
                }) : (
                  <EmptyState text={emptyText} offDay={isOffDay} onClear={hasFilters ? clearFilters : null} />
                )}
              </div>

              {/* PAGINATION */}
              {sorted.length > 0 && (
                <div className="flex flex-col items-center gap-3 border-t border-gray-100 bg-gray-50/50 p-3 sm:flex-row sm:p-4 sm:justify-between sm:px-6">
                  <p className="text-xs text-gray-500">
                    Showing <b className="text-gray-900">{startIndex + 1}–{Math.min(startIndex + itemsPerPage, sorted.length)}</b> of <b className="text-gray-900">{sorted.length}</b>
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-1">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                      disabled={currentPage === 1}
                      aria-label="Previous page"
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-gray-500 ring-1 ring-gray-200 transition enabled:hover:text-red-600 enabled:hover:ring-red-200 disabled:opacity-40"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    {pageNumbers.map((p) =>
                      typeof p === "string" ? (
                        <span key={p} className="px-1 text-gray-400">…</span>
                      ) : (
                        <button key={p} onClick={() => setCurrentPage(p)}
                          className={`relative h-9 min-w-9 rounded-xl px-2 text-sm font-semibold transition ${p === currentPage ? "text-white" : "text-gray-600 hover:bg-white hover:text-red-600"}`}>
                          {p === currentPage && <motion.span layoutId="att-page" className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 shadow shadow-red-600/30" />}
                          <span className="relative">{p}</span>
                        </button>
                      )
                    )}
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                      disabled={currentPage === totalPages || totalPages === 0}
                      aria-label="Next page"
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-gray-500 ring-1 ring-gray-200 transition enabled:hover:text-red-600 enabled:hover:ring-red-200 disabled:opacity-40"
                    >
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
        </div>
      </div>
    </div>
  );
};

const EmptyState = ({ text, offDay, onClear }) => (
  <div className="flex flex-col items-center py-14 text-center">
    <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${offDay ? "bg-amber-50 text-amber-500 ring-amber-100" : "bg-gray-50 text-gray-300 ring-gray-100"}`}>
      {offDay ? <ShieldAlert size={22} /> : <Users size={22} />}
    </div>
    <p className="text-sm font-bold text-gray-700">{text}</p>
    {onClear && (
      <button onClick={onClear} className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100">
        Clear filters
      </button>
    )}
  </div>
);

export default AdminAttendance;