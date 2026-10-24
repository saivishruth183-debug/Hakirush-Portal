import axios from "axios";
import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye, ChevronLeft, ChevronRight, Search, ClipboardList, Calendar, CalendarClock, X, Clock3,
  CheckCircle2, XCircle, Inbox, Users, ArrowRight, Umbrella, Stethoscope, Briefcase, ClipboardCheck,
  Building2, Info, Baby, HeartHandshake, Repeat, Wallet,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

/* ===== STYLES & HELPERS ===== */
const PAGE_BG =
  "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const CARD =
  "rounded-3xl bg-white/90 ring-1 ring-white/70 shadow-[0_10px_40px_-12px_rgba(127,29,29,0.18)] backdrop-blur";

const STATUS_THEME = {
  approved: { chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", strip: "bg-emerald-500", Icon: CheckCircle2 },
  pending: { chip: "bg-amber-50 text-amber-700 ring-amber-200", strip: "bg-amber-400", Icon: Clock3 },
  rejected: { chip: "bg-red-50 text-red-700 ring-red-200", strip: "bg-red-500", Icon: XCircle },
  default: { chip: "bg-gray-100 text-gray-500 ring-gray-200", strip: "bg-gray-300", Icon: Info },
};
const themeFor = (s) => STATUS_THEME[(s || "").toLowerCase()] || STATUS_THEME.default;

const formatDate = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
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

/* ===== MONTH HELPERS ===== */
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
const isCurrentMonth = (d) => {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};
const monthLabel = (d) => d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
/* Leave "belongs" to the selected month if its range overlaps that month at all */
const leaveOverlapsMonth = (leave, monthStart, monthEnd) => {
  if (!leave.startDate || !leave.endDate) return false;
  const s = new Date(leave.startDate);
  const e = new Date(leave.endDate);
  return s <= monthEnd && e >= monthStart;
};

/* ===== UI helpers ===== */
const AVATAR_BG = ["from-red-500 to-rose-400", "from-violet-500 to-fuchsia-400", "from-sky-500 to-cyan-400", "from-amber-500 to-orange-400", "from-emerald-500 to-teal-400"];
const colorFor = (s = "") => AVATAR_BG[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_BG.length];
const initials = (name = "") => String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
const typeIcon = (t = "") =>
  /sick|medical/i.test(t) ? Stethoscope
  : /casual/i.test(t) ? Umbrella
  : /maternity/i.test(t) ? Baby
  : /paternity/i.test(t) ? HeartHandshake
  : /comp/i.test(t) ? Repeat
  : /loss of pay|lop/i.test(t) ? Wallet
  : Briefcase;
const calDays = (s, e) => {
  if (!s || !e) return 0;
  const a = new Date(s), b = new Date(e);
  return Math.round((new Date(b.getFullYear(), b.getMonth(), b.getDate()) - new Date(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000) + 1;
};
const whenLabel = (leave) => {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const s = new Date(leave.startDate); s.setHours(0, 0, 0, 0);
  const e = new Date(leave.endDate); e.setHours(0, 0, 0, 0);
  const d = Math.round((s - t) / 86400000);
  if (d > 1) return { text: `in ${d} days`, tone: "text-sky-600" };
  if (d === 1) return { text: "tomorrow", tone: "text-sky-600" };
  if (d === 0) return { text: "starts today", tone: "text-red-600" };
  if (e >= t) return { text: "on leave now", tone: "text-violet-600" };
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

const StatusChip = ({ status }) => {
  const t = themeFor(status);
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${t.chip}`}>
      <t.Icon size={12} /> {status || "Unknown"}
    </span>
  );
};

const ActionButton = ({ leave, onClick, full = false }) => {
  const pending = (leave.status || "").toLowerCase() === "pending";
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(leave._id); }}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition active:scale-95 ${full ? "w-full py-3" : ""} ${
        pending
          ? "bg-gradient-to-r from-red-600 to-rose-500 text-white shadow shadow-red-600/25 hover:brightness-110"
          : "bg-white text-gray-600 ring-1 ring-gray-200 hover:text-red-600 hover:ring-red-200"
      }`}
    >
      {pending ? <ClipboardCheck size={14} /> : <Eye size={14} />} {pending ? "Review" : "View"}
    </button>
  );
};

/* ===== MOBILE CARD ===== */
const MobileLeaveCard = ({ leave, handleView, q }) => {
  const t = themeFor(leave.status);
  const TIcon = typeIcon(leave.leaveType);
  const w = whenLabel(leave);
  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      onClick={() => handleView(leave._id)}
      className="relative min-w-0 cursor-pointer overflow-hidden rounded-2xl bg-white p-3.5 ring-1 ring-gray-100 transition active:scale-[0.99]">
      <span className={`absolute inset-y-0 left-0 w-1 ${t.strip}`} />
      <div className="flex items-start gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${colorFor(leave.name)} text-sm font-bold text-white`}>{initials(leave.name)}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-gray-900"><Highlight text={leave.name} q={q} /></p>
          <p className="truncate text-xs text-gray-500"><Highlight text={leave.employeeId} q={q} /> · {leave.department}</p>
        </div>
        <StatusChip status={leave.status} />
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-gray-50 p-3 ring-1 ring-gray-100">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900"><TIcon size={14} className="text-red-500" />{leave.leaveType}</p>
          <p className="text-xs leading-snug text-gray-500">{shortDate(leave.startDate)} → {formatDate(leave.endDate)}{w && <span className={`ml-1 font-semibold ${w.tone}`}>· {w.text}</span>}</p>
          {leave.compOffFor && <p className="mt-0.5 text-[11px] font-semibold text-sky-600">Worked on {shortDate(leave.compOffFor)}</p>}
        </div>
        <div className="text-right">
          <p className="text-2xl font-extrabold leading-none tabular-nums text-gray-900">{leave.days}</p>
          <p className="text-[10px] font-semibold uppercase text-gray-400">days</p>
        </div>
      </div>
      <div className="mt-3"><ActionButton leave={leave} onClick={handleView} full /></div>
    </motion.div>
  );
};

const PAGE_SIZE_OPTIONS = [5, 8, 10, 15, 20];

const TeamRequests = () => {
  const [leaves, setLeaves] = useState([]);
  const [filteredLeaves, setFilteredLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(8);

  const [selectedMonth, setSelectedMonth] = useState(() => startOfMonth(new Date()));
  const [monthDir, setMonthDir] = useState(0); // UI-only: slide direction

  // Navigate to LeaveDetails component for manager
  const handleView = (id) => navigate(`/employee-dashboard/team-requests/${id}`);

  const goToPrevMonth = () => {
    setMonthDir(-1);
    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  const goToNextMonth = () => {
    setMonthDir(1);
    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };
  const goToCurrentMonth = () => {
    setMonthDir(startOfMonth(new Date()) > selectedMonth ? 1 : -1);
    setSelectedMonth(startOfMonth(new Date()));
  };

  const fetchLeavesAndHolidays = async () => {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };

      // FETCH FROM /api/leave/team/requests for Manager
      const [leaveRes, holidayRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/leave/team/requests`, { headers }),
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
              reason: leave.reason,
              compOffFor: leave.compOffFor || null,
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
      const q = search.trim().toLowerCase();
      result = result.filter((l) => l.employeeId.toLowerCase().includes(q) || l.name.toLowerCase().includes(q));
    }
    // pending first, then soonest start
    result = [...result].sort((a, b) => {
      const pa = a.status === "Pending" ? 0 : 1, pb = b.status === "Pending" ? 0 : 1;
      return pa - pb || new Date(a.startDate) - new Date(b.startDate);
    });
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

  /* UI-only derived */
  const approvedDays = monthLeaves.filter((l) => l.status === "Approved").reduce((s, l) => s + (l.days || 0), 0);
  const onLeaveToday = leaves.filter((l) => {
    if (l.status !== "Approved") return false;
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const s = new Date(l.startDate); s.setHours(0, 0, 0, 0);
    const e = new Date(l.endDate); e.setHours(0, 0, 0, 0);
    return s <= t && e >= t;
  });
  const allPending = leaves.filter((l) => l.status === "Pending").length;
  const q = search.trim();
  const start = (currentPage - 1) * itemsPerPage;
  const TILES = [
    { key: "All", label: "Total", value: monthLeaves.length, dot: "bg-white" },
    { key: "Pending", label: "Pending", value: pendingCount, dot: "bg-amber-300" },
    { key: "Approved", label: "Approved", value: approvedCount, dot: "bg-emerald-300" },
    { key: "Rejected", label: "Rejected", value: rejectedCount, dot: "bg-red-200" },
  ];

  return (
    <div className={`min-h-screen overflow-x-hidden ${PAGE_BG} pb-12`}>
      <div className="mx-auto w-full max-w-[1400px] space-y-5 p-3 sm:space-y-6 sm:p-6 lg:p-8">

        {/* HEADER */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/30 sm:h-14 sm:w-14">
              <ClipboardList size={24} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">Team requests</h1>
              <p className="text-xs text-gray-500 sm:text-sm">Approve or reject leave for your department</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {allPending > 0 && (
              <button onClick={() => setStatusFilter("Pending")}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-amber-50 px-3 py-2.5 text-sm font-bold text-amber-800 sm:px-4 ring-1 ring-amber-200 transition hover:bg-amber-100">
                <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" /></span>
                {allPending} waiting for you
              </button>
            )}
            <div className={`${CARD} inline-flex items-center justify-center gap-2 whitespace-nowrap px-3 py-2.5 text-sm sm:px-4 ${allPending > 0 ? "" : "col-span-2"}`}>
              <Users size={15} className="text-violet-500" />
              <span className="font-bold text-gray-900">{onLeaveToday.length}</span>
              <span className="text-gray-500">on leave today</span>
            </div>
          </div>
        </header>

        {/* MONTH BAR */}
        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 p-4 text-white shadow-2xl shadow-red-600/25 sm:p-6">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-10 h-52 w-52 rounded-full bg-orange-300/25 blur-3xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap sm:gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-red-600 shadow-lg sm:h-12 sm:w-12"><CalendarClock size={22} /></div>
              <div className="min-w-0 flex-1 sm:flex-none">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/75">Viewing</p>
                <div className="relative h-8 overflow-hidden">
                  <AnimatePresence mode="popLayout" initial={false} custom={monthDir}>
                    <motion.p key={selectedMonth.toISOString()} custom={monthDir}
                      initial={{ y: monthDir * 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -monthDir * 24, opacity: 0 }}
                      transition={{ duration: 0.22 }}
                      className="whitespace-nowrap text-2xl font-extrabold leading-8 tracking-tight">
                      {monthLabel(selectedMonth)}
                    </motion.p>
                  </AnimatePresence>
                </div>
                <p className="text-xs text-white/70">
                  <span className="hidden sm:inline">{formatDate(monthStart)} – {formatDate(monthEnd)} · </span>
                  {approvedDays} approved day{approvedDays === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex w-full items-center gap-1.5 sm:ml-auto sm:w-auto lg:ml-4">
                <button onClick={goToPrevMonth} aria-label="Previous month"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 transition hover:bg-white/25 active:scale-90"><ChevronLeft size={17} /></button>
                {!isCurrentMonth(selectedMonth) ? (
                  <button onClick={goToCurrentMonth}
                    className="h-9 flex-1 whitespace-nowrap rounded-xl bg-white px-3 text-xs font-bold text-red-600 shadow transition hover:-translate-y-0.5 sm:flex-none">This month</button>
                ) : (
                  <span className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-white/15 px-3 text-xs font-semibold ring-1 ring-white/25 sm:flex-none">
                    <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" /></span>
                    Current
                  </span>
                )}
                <button onClick={goToNextMonth} aria-label="Next month"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 transition hover:bg-white/25 active:scale-90"><ChevronRight size={17} /></button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {TILES.map((t) => {
                const on = statusFilter === t.key;
                return (
                  <button key={t.key} onClick={() => setStatusFilter(t.key)}
                    className={`min-w-0 rounded-2xl px-2 py-2.5 text-left transition sm:min-w-[6.5rem] sm:px-3 ${on ? "bg-white text-gray-900 shadow-lg" : "bg-white/15 ring-1 ring-white/20 hover:bg-white/25"}`}>
                    <p className={`flex min-w-0 items-center gap-1 text-[9px] font-bold uppercase tracking-normal sm:gap-1.5 sm:text-[10px] sm:tracking-wider ${on ? "text-gray-500" : "text-white/75"}`}>
                      <span className={`hidden h-1.5 w-1.5 shrink-0 rounded-full sm:block ${on ? (t.key === "Pending" ? "bg-amber-400" : t.key === "Approved" ? "bg-emerald-500" : t.key === "Rejected" ? "bg-red-500" : "bg-gray-400") : t.dot}`} /><span className="truncate">{t.label}</span>
                    </p>
                    <p className="text-xl font-extrabold tabular-nums sm:text-2xl">{loading ? "–" : t.value}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </motion.section>

        {/* LIST */}
        <div className={`${CARD} overflow-hidden`}>
          <div className="flex flex-col gap-3 border-b border-gray-100 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <p className="text-sm text-gray-500">
              {statusFilter === "All" ? "All requests" : `${statusFilter} requests`} in <b className="text-gray-900">{monthLabel(selectedMonth)}</b>
              {statusFilter !== "All" && <button onClick={() => setStatusFilter("All")} className="ml-2 text-xs font-bold text-red-600 hover:underline">Clear</button>}
            </p>
            <div className="relative w-full sm:w-80">
              <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or employee ID…"
                className="w-full rounded-2xl border-0 bg-gray-50 py-2.5 pl-10 pr-9 text-sm text-gray-900 ring-1 ring-gray-200 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-400" />
              {search && <button onClick={() => setSearch("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={15} /></button>}
            </div>
          </div>

          {loading ? (
            <div className="divide-y divide-gray-50">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-4 px-5 py-4">
                  <div className="h-10 w-10 rounded-2xl bg-gray-100" />
                  <div className="flex-1 space-y-2"><div className="h-4 w-1/4 rounded bg-gray-100" /><div className="h-3 w-1/6 rounded bg-gray-50" /></div>
                  <div className="hidden h-4 w-1/5 rounded bg-gray-100 md:block" />
                  <div className="h-8 w-20 rounded-xl bg-gray-100" />
                </div>
              ))}
            </div>
          ) : filteredLeaves.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500 ring-1 ring-red-100"><Inbox size={28} /></div>
              <p className="text-base font-bold text-gray-900">
                {q ? "No one matches your search" : statusFilter === "Pending" ? "All caught up!" : "No records match criteria"}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {q ? "Try a different name or ID." : statusFilter === "Pending" ? `No pending requests in ${monthLabel(selectedMonth)}.` : "Try another month or status."}
              </p>
              {(q || statusFilter !== "All") && (
                <button onClick={() => { setSearch(""); setStatusFilter("All"); }} className="mt-5 rounded-2xl bg-gray-100 px-5 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-200">Show all</button>
              )}
            </div>
          ) : (
            <>
              {/* MOBILE */}
              <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:hidden">
                {currentItems.map((leave) => (
                  <MobileLeaveCard key={leave._id} leave={leave} handleView={handleView} q={q} />
                ))}
              </div>

              {/* DESKTOP */}
              <div className="hidden lg:block">
                <table className="w-full table-auto border-collapse text-left">
                  <thead>
                    <tr className="bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      <th className="py-3 pl-6 pr-3">Employee</th>
                      <th className="px-3 py-3">Leave</th>
                      <th className="px-3 py-3">Dates</th>
                      <th className="px-3 py-3 text-center">Days</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="w-px whitespace-nowrap py-3 pl-3 pr-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {currentItems.map((leave, i) => {
                      const t = themeFor(leave.status);
                      const TIcon = typeIcon(leave.leaveType);
                      const w = whenLabel(leave);
                      const cal = calDays(leave.startDate, leave.endDate);
                      return (
                        <motion.tr key={leave._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                          onClick={() => handleView(leave._id)}
                          className="group cursor-pointer transition hover:bg-red-50/40">
                          <td className="relative max-w-0 py-3.5 pl-6 pr-3 xl:w-[26%]">
                            <span className={`absolute inset-y-2 left-0 w-1 rounded-r-full ${t.strip}`} />
                            <div className="flex min-w-0 items-center gap-3">
                              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${colorFor(leave.name)} text-sm font-bold text-white shadow-sm`}>{initials(leave.name)}</div>
                              <div className="min-w-0">
                                <p className="truncate font-bold text-gray-900 group-hover:text-red-700"><Highlight text={leave.name} q={q} /></p>
                                <p className="flex items-center gap-1.5 truncate text-xs text-gray-500">
                                  <span className="font-mono"><Highlight text={leave.employeeId} q={q} /></span>
                                  <span className="inline-flex items-center gap-0.5 text-gray-400"><Building2 size={10} />{leave.department}</span>
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="max-w-0 px-3 py-3.5 xl:w-[22%]">
                            <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-gray-900"><TIcon size={14} className="shrink-0 text-red-500" />{leave.leaveType}</p>
                            {leave.compOffFor
                              ? <p className="truncate text-xs font-semibold text-sky-600">Worked on {shortDate(leave.compOffFor)}</p>
                              : leave.reason && <p className="truncate text-xs text-gray-400" title={leave.reason}>“{leave.reason}”</p>}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3.5">
                            <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                              {shortDate(leave.startDate)} <ArrowRight size={12} className="text-gray-300" /> {formatDate(leave.endDate)}
                            </p>
                            {w && <p className={`text-xs font-semibold ${w.tone}`}>{w.text}</p>}
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            <p className="text-xl font-extrabold leading-none tabular-nums text-gray-900">{leave.days}</p>
                            {cal !== leave.days && <p className="mt-0.5 text-[10px] text-gray-400">of {cal}</p>}
                          </td>
                          <td className="px-3 py-3.5"><StatusChip status={leave.status} /></td>
                          <td className="w-px whitespace-nowrap py-3.5 pl-3 pr-6 text-right"><ActionButton leave={leave} onClick={handleView} /></td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION */}
              <div className="flex flex-col gap-3 border-t border-gray-100 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4 sm:px-6">
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-gray-500 sm:justify-start">
                  <span>Showing <b className="text-gray-900">{start + 1}–{Math.min(start + itemsPerPage, filteredLeaves.length)}</b> of <b className="text-gray-900">{filteredLeaves.length}</b></span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">Per page</span>
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <button key={size} onClick={() => handlePageSizeChange(size)}
                        className={`h-7 min-w-7 rounded-lg px-1.5 text-xs font-bold transition ${itemsPerPage === size ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "text-gray-500 hover:bg-gray-100"}`}>{size}</button>
                    ))}
                  </div>
                </div>
                {totalPages > 1 && (
                  <div className="flex flex-wrap items-center justify-center gap-1">
                    <button onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1} aria-label="Previous page"
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200 disabled:opacity-30"><ChevronLeft size={16} /></button>
                    {pageList(totalPages, currentPage).map((p, i) =>
                      p === "…" ? <span key={`g${i}`} className="w-6 text-center text-gray-400">…</span> : (
                        <button key={p} onClick={() => setCurrentPage(p)}
                          className={`relative h-9 min-w-9 rounded-xl px-2 text-sm font-bold transition ${p === currentPage ? "text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                          {p === currentPage && <motion.span layoutId="team-page" className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 shadow-md shadow-red-600/25" />}
                          <span className="relative">{p}</span>
                        </button>
                      )
                    )}
                    <button onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} aria-label="Next page"
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200 disabled:opacity-30"><ChevronRight size={16} /></button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamRequests;