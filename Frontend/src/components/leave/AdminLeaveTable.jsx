import axios from "axios";
import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye, ChevronLeft, ChevronRight, Search, ClipboardList, CalendarClock, X, Hash, Briefcase,
  Clock3, CheckCircle2, XCircle, ListFilter, Inbox, ArrowRight, Info, RefreshCw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

/* ===== STYLES & HELPERS ===== */
const PAGE_BG =
  "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const CARD =
  "rounded-3xl bg-white/90 ring-1 ring-white/70 shadow-[0_10px_40px_-12px_rgba(127,29,29,0.18)] backdrop-blur";

const STATUS_THEME = {
  approved: { chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", bar: "bg-emerald-500", Icon: CheckCircle2 },
  pending: { chip: "bg-amber-50 text-amber-700 ring-amber-200", bar: "bg-amber-400", Icon: Clock3 },
  rejected: { chip: "bg-red-50 text-red-700 ring-red-200", bar: "bg-red-500", Icon: XCircle },
  default: { chip: "bg-gray-100 text-gray-500 ring-gray-200", bar: "bg-gray-300", Icon: Info },
};
const themeFor = (status) => STATUS_THEME[status?.toLowerCase()] || STATUS_THEME.default;

const TYPE_TONES = [
  "bg-violet-50 text-violet-700 ring-violet-100",
  "bg-sky-50 text-sky-700 ring-sky-100",
  "bg-rose-50 text-rose-700 ring-rose-100",
  "bg-teal-50 text-teal-700 ring-teal-100",
  "bg-orange-50 text-orange-700 ring-orange-100",
];
const typeTone = (t = "") => TYPE_TONES[[...String(t)].reduce((a, c) => a + c.charCodeAt(0), 0) % TYPE_TONES.length];

const formatDate = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    day: "numeric", month: "short", year: "numeric",
  });
};
const shortDate = (value) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—");

/* ===== UPDATED NET DAYS CALCULATOR HELPER ===== */
const toLocalYMD = (dateInput) => {
  const d = new Date(dateInput);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const calculateNetDays = (startDate, endDate, holidays) => {
  if (!startDate || !endDate) return 0;
  let count = 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  let current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const holidayStrings = holidays.map(h => toLocalYMD(h.date));
  while (current <= last) {
    const dateStr = toLocalYMD(current);
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayStrings.includes(dateStr)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
};

/* calendar span (UI only, to show "x of y days counted") */
const calendarDays = (s, e) => {
  if (!s || !e) return 0;
  const a = new Date(s), b = new Date(e);
  const A = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const B = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((B - A) / 86400000) + 1;
};

/* ===== MONTH HELPERS ===== */
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
const isCurrentMonth = (d) => {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};
const monthLabel = (d) => d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
/* Leave "belongs" to the selected month if its range overlaps that month at all */
const leaveOverlapsMonth = (leave, monthStart, monthEnd) => {
  if (!leave.startDate || !leave.endDate) return false;
  const s = new Date(leave.startDate);
  const e = new Date(leave.endDate);
  return s <= monthEnd && e >= monthStart;
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

const StatusChip = ({ status }) => {
  const t = themeFor(status);
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${t.chip}`}>
      <t.Icon size={12} /> {status || "—"}
    </span>
  );
};

/* ===== MOBILE CARD ===== */
const MobileLeaveCard = ({ leave, index, handleView }) => {
  const t = themeFor(leave.status);
  const cal = calendarDays(leave.startDate, leave.endDate);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index % 8, 8) * 0.04 }}
      className="relative overflow-hidden rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
      <span className={`absolute inset-y-0 left-0 w-1.5 ${t.bar}`} />
      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${colorFor(leave.name)} text-xs font-bold text-white shadow-md`}>
            {initials(leave.name)}
          </div>
          <div className="min-w-0">
            <h4 className="truncate font-bold text-gray-900">{leave.name}</h4>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-0.5 rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-gray-500"><Hash size={9} />{leave.employeeId}</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500"><Briefcase size={9} />{leave.department}</span>
            </div>
          </div>
        </div>
        <StatusChip status={leave.status} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-gray-50 p-3 pl-4 ring-1 ring-gray-100">
        <div className="min-w-0">
          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${typeTone(leave.leaveType)}`}>{leave.leaveType}</span>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-600">
            {shortDate(leave.startDate)} <ArrowRight size={11} className="text-gray-300" /> {shortDate(leave.endDate)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-extrabold leading-none text-gray-900 tabular-nums">{leave.days}</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{leave.days === 1 ? "day" : "days"}{cal > leave.days ? ` of ${cal}` : ""}</p>
        </div>
      </div>

      <button
        onClick={() => handleView(leave._id)}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-2.5 text-sm font-bold text-white shadow-md shadow-red-600/25 transition active:scale-95"
      >
        <Eye size={15} /> View request
      </button>
    </motion.div>
  );
};

const PAGE_SIZE_OPTIONS = [5, 8, 10, 15, 20];

const AdminLeaveTable = () => {
  const [leaves, setLeaves] = useState([]);
  const [filteredLeaves, setFilteredLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(8);

  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()));
  const [dir, setDir] = useState(0); // UI-only: month slide direction

  const handleView = (id) => navigate(`/admin-dashboard/leaves/${id}`);

  const goToPrevMonth = () => {
    setDir(-1);
    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const goToNextMonth = () => {
    setDir(1);
    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };
  const goToCurrentMonth = () => {
    setDir(selectedMonth < startOfMonth(new Date()) ? 1 : -1);
    setSelectedMonth(startOfMonth(new Date()));
  };

  const fetchLeavesAndHolidays = async () => {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };

      const [leaveRes, holidayRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/leave`, { headers }),
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/holiday/all`, { headers })
      ]);

      if (leaveRes.data.success) {
        const holidays = holidayRes.data.holidays || [];

        const data = (leaveRes.data.leaves || [])
          .filter((leave) => leave.employeeId)
          .map((leave) => {
            const displayDays = calculateNetDays(leave.startDate, leave.endDate, holidays);

            return {
              _id: leave._id,
              employeeId: leave.employeeId?.employeeId || "N/A",
              name: leave.employeeId?.userId?.name || "N/A",
              leaveType: leave.leaveType,
              department: leave.employeeId?.department?.dep_name || "N/A",
              days: displayDays,
              status: leave.status,
              startDate: leave.startDate,
              endDate: leave.endDate,
              reason: leave.reason
            };
          });
        setLeaves(data);
        setFilteredLeaves(data);
      }
    } catch (error) {
      console.error("Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeavesAndHolidays(); }, []);

  const monthStart = useMemo(() => startOfMonth(selectedMonth), [selectedMonth]);
  const monthEnd = useMemo(() => endOfMonth(selectedMonth), [selectedMonth]);

  useEffect(() => {
    let result = leaves.filter((l) => leaveOverlapsMonth(l, monthStart, monthEnd));
    if (statusFilter !== "All") result = result.filter((l) => l.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((l) => l.employeeId.toLowerCase().includes(q) || l.name.toLowerCase().includes(q));
    }
    setFilteredLeaves(result);
    setCurrentPage(1);
  }, [search, statusFilter, leaves, monthStart, monthEnd]);

  const totalPages = Math.ceil(filteredLeaves.length / itemsPerPage);
  const currentItems = filteredLeaves.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handlePageSizeChange = (size) => {
    setItemsPerPage(size);
    setCurrentPage(1);
  };

  const monthLeaves = useMemo(
    () => leaves.filter((l) => leaveOverlapsMonth(l, monthStart, monthEnd)),
    [leaves, monthStart, monthEnd]
  );

  const pendingCount = useMemo(
    () => monthLeaves.filter((l) => l.status === "Pending").length,
    [monthLeaves]
  );
  const approvedCount = useMemo(
    () => monthLeaves.filter((l) => l.status === "Approved").length,
    [monthLeaves]
  );
  const rejectedCount = useMemo(
    () => monthLeaves.filter((l) => l.status === "Rejected").length,
    [monthLeaves]
  );

  /* UI-only extras */
  const approvedDays = monthLeaves.filter((l) => l.status === "Approved").reduce((s, l) => s + (l.days || 0), 0);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const hasFilters = !!search.trim() || statusFilter !== "All";
  const clearFilters = () => { setSearch(""); setStatusFilter("All"); };

  const STATS = [
    ["All", "Total", monthLeaves.length, ListFilter, "bg-white/15 ring-white/20"],
    ["Pending", "Pending", pendingCount, Clock3, "bg-amber-300/25 ring-amber-200/40"],
    ["Approved", "Approved", approvedCount, CheckCircle2, "bg-emerald-300/25 ring-emerald-200/40"],
    ["Rejected", "Rejected", rejectedCount, XCircle, "bg-red-900/25 ring-red-200/30"],
  ];

  return (
    <div className={`min-h-screen ${PAGE_BG} pb-16 text-gray-900`}>
      <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">

        {/* HEADER */}
        <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/30">
              <ClipboardList size={26} />
              {pendingCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-amber-950 ring-2 ring-white">{pendingCount}</span>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-500">People</p>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                Leave <span className="bg-gradient-to-r from-red-600 to-rose-500 bg-clip-text text-transparent">Requests</span>
              </h1>
              <p className="flex items-center gap-1.5 text-sm text-gray-500">
                <Info size={13} /> Days counted exclude Saturdays, Sundays and holidays
              </p>
            </div>
          </div>
          <button type="button" onClick={fetchLeavesAndHolidays} disabled={loading}
            className="inline-flex items-center justify-center gap-2 self-start rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-gray-600 shadow-sm ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200 disabled:opacity-60 sm:self-auto">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </motion.header>

        {/* MONTH COMMAND BAR */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 p-5 text-white shadow-[0_20px_50px_-15px_rgba(220,38,38,0.55)] sm:p-6">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/15 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-orange-300/25 blur-3xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            {/* month identity + navigation */}
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                <CalendarClock size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/75">Viewing period</p>
                <div className="relative h-8 overflow-hidden">
                  <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                    <motion.p key={monthLabel(selectedMonth)} custom={dir}
                      initial={{ y: dir * 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -dir * 24, opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      className="text-2xl font-extrabold leading-8 tracking-tight">
                      {monthLabel(selectedMonth)}
                    </motion.p>
                  </AnimatePresence>
                </div>
                <p className="text-xs text-white/70">{formatDate(monthStart)} — {formatDate(monthEnd)}</p>
              </div>
              <div className="ml-auto flex items-center gap-1.5 lg:ml-4">
                <button onClick={goToPrevMonth} aria-label="Previous month"
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20 transition hover:bg-white/25 active:scale-90">
                  <ChevronLeft size={17} />
                </button>
                {!isCurrentMonth(selectedMonth) ? (
                  <button onClick={goToCurrentMonth}
                    className="h-9 whitespace-nowrap rounded-xl bg-white px-3 text-xs font-bold text-red-600 shadow transition hover:-translate-y-0.5 active:scale-95">
                    This month
                  </button>
                ) : (
                  <span className="flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl bg-white/15 px-3 text-xs font-semibold ring-1 ring-white/20">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                    </span>
                    Current
                  </span>
                )}
                <button onClick={goToNextMonth} aria-label="Next month"
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20 transition hover:bg-white/25 active:scale-90">
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>

            {/* stats — clickable filters */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[30rem]">
              {STATS.map(([key, label, count, Icon, tone]) => {
                const active = statusFilter === key;
                return (
                  <button key={key} type="button" onClick={() => setStatusFilter(key)}
                    className={`relative rounded-2xl p-3 text-left ring-1 transition hover:-translate-y-0.5 ${active ? "bg-white text-red-600 ring-white shadow-lg" : `${tone} text-white`}`}>
                    <p className={`flex items-center gap-1.5 text-[11px] font-semibold ${active ? "text-red-500" : "text-white/80"}`}><Icon size={12} /> {label}</p>
                    <p className="mt-0.5 text-2xl font-extrabold tabular-nums">{count}</p>
                  </button>
                );
              })}
            </div>
          </div>
          {approvedDays > 0 && (
            <p className="relative mt-4 text-xs text-white/80">
              <b className="text-white">{approvedDays}</b> working day{approvedDays > 1 ? "s" : ""} of approved leave this month
            </p>
          )}
        </motion.div>

        {/* TABLE CARD */}
        <div className={`${CARD} overflow-hidden`}>
          {/* Controls */}
          <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:p-5 lg:flex-row lg:items-center">
            <div className="group relative flex flex-1 items-center rounded-2xl bg-gray-50 px-4 ring-1 ring-gray-200 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-red-400">
              <Search size={17} className="text-gray-400 transition group-focus-within:text-red-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by employee ID or name…"
                className="w-full bg-transparent py-3 pl-3 text-sm font-medium text-gray-900 outline-none placeholder:text-gray-400"
              />
              {search && (
                <button onClick={() => setSearch("")} aria-label="Clear search" className="rounded-full p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"><X size={14} /></button>
              )}
            </div>
            <div className="flex gap-1 rounded-2xl bg-gray-100/80 p-1">
              {["All", "Pending", "Approved", "Rejected"].map((item) => {
                const active = statusFilter === item;
                return (
                  <button key={item} onClick={() => setStatusFilter(item)}
                    className={`relative flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors sm:flex-none sm:px-4 ${active ? "text-red-600" : "text-gray-500 hover:text-gray-800"}`}>
                    {active && <motion.span layoutId="leave-filter" className="absolute inset-0 rounded-xl bg-white shadow-sm" transition={{ type: "spring", stiffness: 420, damping: 32 }} />}
                    <span className="relative">{item}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {hasFilters && !loading && (
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-2.5 text-xs sm:px-6">
              <span className="text-gray-500"><b className="text-gray-900">{filteredLeaves.length}</b> of {monthLeaves.length} requests in {monthLabel(selectedMonth)}</span>
              <button onClick={clearFilters} className="font-semibold text-red-600 hover:underline">Clear filters</button>
            </div>
          )}

          {loading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-4 rounded-2xl p-3">
                  <div className="h-10 w-10 rounded-2xl bg-gray-200" />
                  <div className="flex-1 space-y-2"><div className="h-3 w-40 rounded bg-gray-200" /><div className="h-2.5 w-24 rounded bg-gray-100" /></div>
                  <div className="hidden h-6 w-40 rounded-full bg-gray-100 sm:block" />
                  <div className="h-8 w-20 rounded-xl bg-gray-100" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* MOBILE */}
              <div className="space-y-3 p-4 lg:hidden">
                {currentItems.length > 0 ? (
                  currentItems.map((leave, i) => (
                    <MobileLeaveCard key={leave._id} leave={leave} index={startIndex + i} handleView={handleView} />
                  ))
                ) : (
                  <EmptyState month={monthLabel(selectedMonth)} filtered={hasFilters} onClear={clearFilters} />
                )}
              </div>

              {/* DESKTOP TABLE */}
              <div className="hidden lg:block">
                <table className="w-full table-auto border-collapse text-left">
                  <thead>
                    <tr className="bg-gray-50/70 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      <th className="w-14 py-3 pl-6 pr-2 font-bold">#</th>
                      <th className="px-3 py-3 font-bold">Employee</th>
                      <th className="px-3 py-3 font-bold">Type</th>
                      <th className="px-3 py-3 font-bold">Dates</th>
                      <th className="px-3 py-3 text-center font-bold">Days</th>
                      <th className="px-3 py-3 font-bold">Status</th>
                      <th className="w-px whitespace-nowrap py-3 pl-3 pr-6 text-right font-bold">View</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {currentItems.map((leave, i) => {
                      const t = themeFor(leave.status);
                      const cal = calendarDays(leave.startDate, leave.endDate);
                      return (
                        <motion.tr key={leave._id}
                          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}
                          onClick={() => handleView(leave._id)}
                          className="group cursor-pointer transition-colors hover:bg-red-50/40">
                          <td className="relative py-3.5 pl-6 pr-2 text-xs font-semibold tabular-nums text-gray-400">
                            <span className={`absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full ${t.bar}`} />
                            {String(startIndex + i + 1).padStart(2, "0")}
                          </td>
                          <td className="max-w-0 px-3 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${colorFor(leave.name)} text-xs font-bold text-white shadow-md`}>
                                {initials(leave.name)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-gray-900 transition group-hover:text-red-700">{leave.name}</p>
                                <p className="flex items-center gap-2 truncate text-xs text-gray-400">
                                  <span className="inline-flex items-center gap-0.5 font-mono"><Hash size={10} />{leave.employeeId}</span>
                                  <span className="inline-flex items-center gap-1 truncate"><Briefcase size={10} />{leave.department}</span>
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3.5">
                            <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${typeTone(leave.leaveType)}`}>{leave.leaveType || "—"}</span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3.5">
                            <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                              {shortDate(leave.startDate)} <ArrowRight size={12} className="text-gray-300" /> {shortDate(leave.endDate)}
                            </p>
                            <p className="text-[11px] text-gray-400">{new Date(leave.endDate).getFullYear()}</p>
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            <p className="text-xl font-extrabold tabular-nums text-gray-900">{leave.days}</p>
                            {cal > leave.days && <p className="text-[10px] text-gray-400" title="Calendar days in range">of {cal}</p>}
                          </td>
                          <td className="px-3 py-3.5"><StatusChip status={leave.status} /></td>
                          <td className="w-px whitespace-nowrap py-3.5 pl-3 pr-6 text-right">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleView(leave._id); }}
                              aria-label={`View leave for ${leave.name}`}
                              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${
                                leave.status === "Pending"
                                  ? "bg-gradient-to-r from-red-600 to-rose-500 text-white shadow-md shadow-red-600/25 hover:brightness-110"
                                  : "bg-white text-gray-600 ring-1 ring-gray-200 hover:text-red-600 hover:ring-red-200"
                              }`}
                            >
                              <Eye size={14} /> {leave.status === "Pending" ? "Review" : "View"}
                            </button>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
                {currentItems.length === 0 && <EmptyState month={monthLabel(selectedMonth)} filtered={hasFilters} onClear={clearFilters} />}
              </div>

              {/* PAGINATION */}
              {filteredLeaves.length > 0 && (
                <div className="flex flex-col items-center gap-3 border-t border-gray-100 bg-gray-50/50 p-4 sm:flex-row sm:justify-between sm:px-6">
                  <p className="text-xs text-gray-500">
                    Showing <b className="text-gray-900">{startIndex + 1}–{Math.min(startIndex + itemsPerPage, filteredLeaves.length)}</b> of <b className="text-gray-900">{filteredLeaves.length}</b>
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1} aria-label="Previous page"
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-gray-500 ring-1 ring-gray-200 transition enabled:hover:text-red-600 enabled:hover:ring-red-200 disabled:opacity-40">
                      <ChevronLeft size={16} />
                    </button>
                    {pageList(totalPages, currentPage).map((p) =>
                      typeof p === "string" ? <span key={p} className="px-1 text-gray-400">…</span> : (
                        <button key={p} onClick={() => setCurrentPage(p)}
                          className={`relative h-9 min-w-9 rounded-xl px-2 text-sm font-semibold transition ${p === currentPage ? "text-white" : "text-gray-600 hover:bg-white hover:text-red-600"}`}>
                          {p === currentPage && <motion.span layoutId="leave-page" className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 shadow shadow-red-600/30" />}
                          <span className="relative">{p}</span>
                        </button>
                      )
                    )}
                    <button onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} aria-label="Next page"
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
        </div>
      </div>
    </div>
  );
};

const EmptyState = ({ month, filtered, onClear }) => (
  <div className="flex flex-col items-center px-6 py-14 text-center">
    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-300 ring-1 ring-gray-100"><Inbox size={22} /></div>
    <p className="text-sm font-bold text-gray-700">{filtered ? "No requests match these filters" : `No leave requests in ${month}`}</p>
    <p className="mt-1 text-xs text-gray-400">{filtered ? "Try a different status or search." : "Use the arrows above to check another month."}</p>
    {filtered && (
      <button onClick={onClear} className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-100">Clear filters</button>
    )}
  </div>
);

export default AdminLeaveTable;
