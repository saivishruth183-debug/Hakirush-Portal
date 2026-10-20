import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  BriefcaseBusiness, Building, Users, Activity, UserMinus, Calendar, AlertCircle, Download,
  Cake, Bell, X, Clock, RefreshCw, CheckCheck, ArrowUpRight, ClipboardCheck, CalendarClock,
  Inbox, Sun, Moon, Sunrise, PieChart as PieIcon, Store, Handshake, Gift,
  Lightbulb, TrendingUp, TrendingDown, Info, Receipt,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

/* ================= TOKENS ================= */
const C = {
  brand: "#dc2626",
  slate: "#475569",
  violet: "#8b5cf6",
  pink: "#ec4899",
  emerald: "#10b981",
  amber: "#f59e0b",
  sky: "#0ea5e9",
  rose: "#f43f5e",
  teal: "#14b8a6",
};
const CHART_COLORS = [C.brand, C.slate, C.emerald, C.amber, C.sky, C.violet, C.pink, C.teal];
const LEAVE_COLORS = { Approved: C.emerald, Pending: C.amber, Rejected: C.rose };

const API = import.meta.env.VITE_BACKEND_URL;
const authConfig = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });

const pct = (v, t) => (t ? Math.round(((v || 0) / t) * 100) : 0);
const timeAgo = (d) => {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (isNaN(s)) return "";
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
const daysUntil = (dob) => {
  if (!dob) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return Math.round((next - today) / 86400000);
};
const imageUrl = (p) => {
  if (!p) return "/default-avatar.png";
  if (p.startsWith("http")) return p;
  return `${API.replace(/\/$/, "")}/${p.replace(/^\//, "")}`;
};
const dayPart = () => {
  const h = new Date().getHours();
  if (h < 12) return { text: "Good morning", Icon: Sunrise };
  if (h < 17) return { text: "Good afternoon", Icon: Sun };
  return { text: "Good evening", Icon: Moon };
};

const tooltipStyle = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  color: "#111827",
  fontSize: 12,
  fontWeight: 600,
  boxShadow: "0 12px 32px -8px rgba(17,24,39,0.15)",
};

/* ================= ANIMATION ================= */
const rise = {
  hidden: { opacity: 0, y: 18 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] } }),
};

const Reveal = ({ i = 0, className = "", children }) => (
  <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: "-40px" }} custom={i} variants={rise} className={className}>
    {children}
  </motion.div>
);

const useCountUp = (target = 0, duration = 1100) => {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf;
    const from = 0;
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min((t - start) / duration, 1);
      setV(Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
};

const Num = ({ value = 0, suffix = "" }) => <>{useCountUp(Number(value) || 0)}{suffix}</>;

/* ================= BUILDING BLOCKS ================= */
const Card = ({ className = "", children, i = 0 }) => (
  <motion.div
    initial="hidden" whileInView="show" viewport={{ once: true, margin: "-40px" }} custom={i} variants={rise}
    className={`relative overflow-hidden rounded-3xl bg-white/85 backdrop-blur-sm shadow-[0_1px_3px_rgba(17,24,39,0.04),0_10px_30px_-12px_rgba(127,29,29,0.12)] ring-1 ring-white/70 ${className}`}
  >
    {children}
  </motion.div>
);

const Skeleton = ({ className = "" }) => <div className={`animate-pulse rounded-3xl bg-white/70 ${className}`} />;

const LoadingSkeleton = () => (
  <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)] px-4 pt-6 sm:px-8 sm:pt-8">
    <div className="mx-auto max-w-[1440px] space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2"><Skeleton className="h-4 w-48 rounded-full" /><Skeleton className="h-8 w-40 rounded-xl" /></div>
        <div className="flex gap-2"><Skeleton className="h-10 w-20 rounded-full" /><Skeleton className="h-10 w-10 rounded-full" /></div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Skeleton className="h-64 lg:col-span-8" />
        <Skeleton className="h-64 lg:col-span-4" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44" />)}
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}
      </div>
    </div>
  </div>
);

const CardHeader = ({ icon: Icon, title, sub, color = C.brand, right }) => (
  <div className="mb-5 flex items-center justify-between gap-3">
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: `${color}14`, color }}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-[15px] font-bold text-gray-900">{title}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
    {right}
  </div>
);

const Empty = ({ icon: Icon = Inbox, text }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50">
      <Icon size={20} className="text-gray-300" />
    </div>
    <p className="text-sm text-gray-400">{text}</p>
  </div>
);

const Kpi = ({ icon: Icon, label, value, total, color, bg, i = 0 }) => {
  const share = pct(value, total);
  return (
    <motion.div
      initial="hidden" animate="show" custom={i} variants={rise}
      whileHover={{ y: -4 }}
      className="group relative overflow-hidden rounded-3xl p-5 sm:p-6" style={{ background: bg }}
    >
      <div className="pointer-events-none absolute -right-6 -bottom-6 opacity-[0.12] transition-transform duration-500 group-hover:scale-110" style={{ color }}>
        <Icon size={110} strokeWidth={1.5} />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-sm" style={{ color }}>
          <Icon size={20} />
        </div>
        {total > 0 && (
          <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-bold tabular-nums shadow-sm" style={{ color }}>
            {share}%
          </span>
        )}
      </div>
      <p className="mt-6 text-4xl font-extrabold tracking-tight text-gray-900 tabular-nums"><Num value={value} /></p>
      <p className="mt-1 text-sm font-medium text-gray-600">{label}</p>
      {total > 0 && (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/70">
          <motion.div
            initial={{ width: 0 }} animate={{ width: `${share}%` }} transition={{ duration: 1, delay: 0.2 + i * 0.06, ease: "easeOut" }}
            className="h-full rounded-full" style={{ background: color }}
          />
        </div>
      )}
    </motion.div>
  );
};

/* ================= MAIN ================= */
const AdminSummary = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [att, setAtt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [synced, setSynced] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [notifTab, setNotifTab] = useState("all");
  const [exporting, setExporting] = useState(false);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(new Date());

  const unseen = notifications.filter((n) => !n.seen).length;

  // show the unread count in the browser tab, e.g. "(3) Admin Dashboard"
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\)\s*/, "");
    document.title = unseen > 0 ? `(${unseen > 99 ? "99+" : unseen}) ${base}` : base;
    return () => { document.title = document.title.replace(/^\(\d+\+?\)\s*/, ""); };
  }, [unseen]);

  const fetchAll = useCallback(async () => {
    try {
      const [d, a] = await Promise.all([
        axios.get(`${API}/api/dashboard/summary`, authConfig()),
        axios.get(`${API}/api/attendance/admin/summary`, authConfig()),
      ]);
      setSummary(d.data);
      setAtt(a.data);
      setSynced(new Date());
    } catch (e) {
      console.error("Dashboard Sync Error:", e);
    }
  }, []);

  useEffect(() => {
    setReady(true);
    let mounted = true;
    fetchAll().finally(() => mounted && setLoading(false));
    const refreshOnFocus = () => fetchAll();
    window.addEventListener("focus", refreshOnFocus);
    const attTimer = setInterval(async () => {
      try {
        const r = await axios.get(`${API}/api/attendance/admin/summary`, authConfig());
        if (mounted && r?.data) { setAtt(r.data); setSynced(new Date()); }
      } catch {}
    }, 10000);
    const summaryTimer = setInterval(async () => {
      try {
        const r = await axios.get(`${API}/api/dashboard/summary`, authConfig());
        if (mounted && r?.data) setSummary(r.data);
      } catch (e) {
        console.error("Dashboard Summary Refresh Error:", e);
      }
    }, 30000);
    const clock = setInterval(() => setNow(new Date()), 30000);
    return () => {
      mounted = false;
      window.removeEventListener("focus", refreshOnFocus);
      clearInterval(attTimer);
      clearInterval(summaryTimer);
      clearInterval(clock);
    };
  }, [fetchAll]);

  useEffect(() => {
    const load = async () => {
      if (!user || user.role !== "admin") return;
      try {
        const r = await axios.get(`${API}/api/notifications`, authConfig());
        if (r.data?.success) setNotifications(r.data.notifications);
      } catch {}
    };
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [user]);

  useEffect(() => {
    if (!showNotif) return;
    const onKey = (e) => e.key === "Escape" && setShowNotif(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showNotif]);

  const markSeen = (id) => axios.patch(`${API}/api/notifications/${id}/seen`, {}, authConfig());

  const openNotif = async (n) => {
    try {
      if (!n.seen) {
        await markSeen(n._id);
        setNotifications((l) => l.map((x) => (x._id === n._id ? { ...x, seen: true } : x)));
      }
      const path = n?.type === "expense-claim" ? "/admin-dashboard/expenses"
        : n?.data?.link || n?.link ||
          (n?.type === "leave-request" ? "/admin-dashboard/leaves"
            : n?.type === "attendance-request" ? "/admin-dashboard/attendance-requests" : null);
      if (path) { setShowNotif(false); navigate(path); }
    } catch {}
  };

  const markAll = async () => {
    const list = notifications.filter((n) => !n.seen);
    setNotifications((l) => l.map((n) => ({ ...n, seen: true })));
    await Promise.allSettled(list.map((n) => markSeen(n._id)));
  };

  const data = useMemo(() => ({
    plans: [
      { name: "Annual", value: summary?.totalAnnual || 0 },
      { name: "Quarterly", value: summary?.totalQuarterly || 0 },
    ],
    leaves: [
      { name: "Pending", value: summary?.leaveSummary?.pending || 0 },
      { name: "Approved", value: summary?.leaveSummary?.approved || 0 },
      { name: "Rejected", value: summary?.leaveSummary?.rejected || 0 },
    ],
    depts: (summary?.departmentSummary || [])
      .map((d) => ({ name: d.department, value: d.employees }))
      .sort((a, b) => b.value - a.value),
    sponsors: Object.entries(summary?.sponsorSummary?.collaborationSummary || {}).map(([name, value]) => ({ name, value })),
    stalls: Object.entries(summary?.stallSummary?.typeSummary || {}).map(([name, value]) => ({ name, value })),
  }), [summary]);

  const exportCSV = () => {
    if (!summary) return;
    setExporting(true);
    const a = att || {};
    const rows = [
      ["OPERATIONAL SUMMARY REPORT"], ["Generated on", new Date().toLocaleString()], [],
      ["WORKFORCE"], ["Total Employees", summary.totalEmployees ?? 0], ["Total Departments", summary.totalDepartments ?? 0], ["Total Clients", summary.totalClients ?? 0], [],
      ["TODAY'S ATTENDANCE"], ["Present", a.presentToday ?? a.activeToday ?? 0], ["Half Day", a.halfDayToday ?? 0], ["On Leave", a.onLeaveToday ?? 0], ["Absent", a.absentToday ?? 0], [],
      ["LEAVES"], ...data.leaves.map((x) => [x.name, x.value]), [],
      ["CLIENT PLANS"], ...data.plans.map((x) => [x.name, x.value]), [],
      ["DEPARTMENTS", "Employees"], ...data.depts.map((x) => [x.name, x.value]), [],
      ["SPONSORS"], ...data.sponsors.map((x) => [x.name, x.value]), [],
      ["STALLS"], ...data.stalls.map((x) => [x.name, x.value]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `Report_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setTimeout(() => setExporting(false), 900);
  };

  if (loading) return <LoadingSkeleton />;

  const total = summary?.totalEmployees || 0;
  const present = att?.presentToday ?? att?.activeToday ?? 0;
  const half = att?.halfDayToday ?? 0;
  const leave = att?.onLeaveToday ?? 0;
  const absent = att?.absentToday ?? 0;
  const base = total || present + half + leave + absent;
  const rate = pct(present + half, base);
  const unmarked = Math.max(base - (present + half + leave + absent), 0);
  const pendingLeaves = summary?.leaveSummary?.pending || 0;
  const pendingAtt = notifications.filter((n) => !n.seen && n.type === "attendance-request").length;
  const todayBdays = summary?.birthdaySummary?.today || [];
  const upcoming = [...(summary?.birthdaySummary?.upcoming || [])].sort((a, b) => (daysUntil(a.dob) ?? 999) - (daysUntil(b.dob) ?? 999));
  const leaveTotal = data.leaves.reduce((s, l) => s + l.value, 0);
  const firstName = (user?.name || "Admin").split(" ")[0];
  const { text: hello, Icon: DayIcon } = dayPart();
  const shownNotifs = notifTab === "unread" ? notifications.filter((n) => !n.seen) : notifications;

  /* ---------- Auto-generated insights from the data we already have ---------- */
  const insights = [];
  if (base > 0) {
    if (rate >= 90) insights.push({ tone: "good", text: `Great turnout — ${rate}% of the team is at work today.` });
    else if (rate < 70) insights.push({ tone: "warn", text: `Attendance is low today at ${rate}%. ${absent} people are absent.` });
    else insights.push({ tone: "info", text: `${rate}% of the team is at work today.` });
  }
  if (unmarked > 0) insights.push({ tone: "warn", text: `${unmarked} employee${unmarked > 1 ? "s haven't" : " hasn't"} been marked yet today.` });
  if (leaveTotal > 0) {
    const approved = data.leaves.find((l) => l.name === "Approved")?.value || 0;
    insights.push({ tone: "info", text: `${pct(approved, leaveTotal)}% of all leave requests have been approved.` });
  }
  if (pendingLeaves > 0) insights.push({ tone: "warn", text: `${pendingLeaves} leave request${pendingLeaves > 1 ? "s are" : " is"} still waiting for a decision.` });
  if (data.depts.length > 1 && total > 0) {
    insights.push({ tone: "info", text: `${data.depts[0].name} is your largest department with ${pct(data.depts[0].value, total)}% of staff.` });
  }
  if (todayBdays.length > 0) insights.push({ tone: "good", text: `It's ${todayBdays.length === 1 ? (todayBdays[0].userId?.name || todayBdays[0].name) + "'s" : `${todayBdays.length} people's`} birthday today 🎉` });
  if (insights.length === 0) insights.push({ tone: "good", text: "Everything looks calm today. Nothing needs your attention." });

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)] pb-16 font-sans text-gray-700 selection:bg-red-200/60">
      <div className="mx-auto max-w-[1440px] space-y-6 px-4 pt-6 sm:px-8 sm:pt-8">
        {/* ================= TOP ROW ================= */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-400">
              {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">Admin <span className="text-red-600">Dashboard</span></h1>
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold ${
              att?.isHoliday ? "bg-amber-50 text-amber-700 ring-1 ring-amber-100" : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
            }`}>
              <span className="relative flex h-2 w-2">
                {!att?.isHoliday && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
                <span className={`relative inline-flex h-2 w-2 rounded-full ${att?.isHoliday ? "bg-amber-500" : "bg-emerald-500"}`} />
              </span>
              {att?.isHoliday ? att.holidayName || "Holiday" : "Live"}
            </span>

            <button
              onClick={async () => { setRefreshing(true); await fetchAll(); setTimeout(() => setRefreshing(false), 400); }}
              title={synced ? `Synced ${timeAgo(synced)}` : "Refresh"}
              className="flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-gray-500 shadow-sm ring-1 ring-gray-100 transition hover:text-red-600"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              <span className="hidden sm:inline">{synced ? timeAgo(synced) : "Refresh"}</span>
            </button>

            {/* Notifications */}
            <div className="relative">
              <motion.button
                layout
                aria-label={unseen > 0 ? `Notifications, ${unseen} unread` : "Notifications"}
                title={unseen > 0 ? `${unseen} unread notification${unseen > 1 ? "s" : ""}` : "Notifications"}
                onClick={() => setShowNotif((v) => !v)}
                className={`relative flex h-10 items-center justify-center gap-1.5 rounded-full shadow-sm ring-1 transition-colors ${
                  unseen > 0
                    ? "bg-gradient-to-r from-red-600 to-rose-500 pl-3 pr-1.5 text-white shadow-red-600/30 ring-red-500 hover:brightness-110"
                    : `w-10 bg-white ${showNotif ? "text-red-600 ring-red-200" : "text-gray-500 ring-gray-100 hover:text-red-600"}`
                }`}
              >
                {unseen > 0 && (
                  <span className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-red-500 opacity-20 [animation-duration:2.5s]" />
                )}
                <motion.span
                  key={`bell-${unseen}`}
                  initial={unseen > 0 ? { rotate: -18 } : false}
                  animate={{ rotate: [-18, 14, -8, 4, 0] }}
                  transition={{ duration: 0.6 }}
                  className="relative flex"
                >
                  <Bell size={17} />
                </motion.span>
                <AnimatePresence mode="popLayout" initial={false}>
                  {unseen > 0 && (
                    <motion.span
                      key={unseen}
                      initial={{ scale: 0.4, opacity: 0, y: -6 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.4, opacity: 0, y: 6 }}
                      transition={{ type: "spring", stiffness: 500, damping: 22 }}
                      className="relative flex h-7 min-w-[28px] items-center justify-center rounded-full bg-white px-2 text-xs font-extrabold tabular-nums text-red-600 shadow-sm"
                    >
                      {unseen > 99 ? "99+" : unseen}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>

              <AnimatePresence>
              {showNotif && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotif(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    className="fixed left-4 right-4 top-20 z-50 origin-top-right overflow-hidden rounded-3xl bg-white shadow-[0_24px_60px_-12px_rgba(17,24,39,0.25)] ring-1 ring-gray-100 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-3 sm:w-[380px]"
                  >
                    <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                      <div>
                        <p className="font-bold text-gray-900">Notifications</p>
                        <p className="flex items-center gap-1.5 text-xs text-gray-400">
                          {unseen ? (
                            <><span className="rounded-full bg-red-600 px-1.5 py-px text-[10px] font-bold tabular-nums text-white">{unseen}</span> unread of {notifications.length}</>
                          ) : "You're all caught up"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {unseen > 0 && (
                          <button onClick={markAll} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">
                            <CheckCheck size={14} /> Mark all read
                          </button>
                        )}
                        <button aria-label="Close" onClick={() => setShowNotif(false)} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700">
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-1 border-b border-gray-100 px-4 py-2">
                      {[["all", "All", notifications.length], ["unread", "Unread", unseen]].map(([key, label, n]) => (
                        <button
                          key={key}
                          onClick={() => setNotifTab(key)}
                          className={`relative rounded-full px-3 py-1.5 text-xs font-semibold transition ${notifTab === key ? "text-red-700" : "text-gray-500 hover:text-gray-800"}`}
                        >
                          {notifTab === key && (
                            <motion.span layoutId="notif-tab" className="absolute inset-0 rounded-full bg-red-50" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
                          )}
                          <span className="relative flex items-center gap-1.5">{label}
                            <span className={`rounded-full px-1.5 text-[10px] font-bold tabular-nums ${key === "unread" && n > 0 ? "bg-red-600 text-white" : "bg-gray-100 text-gray-500"}`}>{n}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="max-h-[60vh] overflow-y-auto p-2 sm:max-h-[400px]">
                      {shownNotifs.length === 0 ? (
                        <Empty icon={Bell} text={notifTab === "unread" ? "No unread notifications" : "No notifications yet"} />
                      ) : (
                        shownNotifs.map((n) => {
                          const isLeave = n.type === "leave-request";
                          const isAtt = n.type === "attendance-request";
                          const isExpense = n.type === "expense-claim";
                          const Icon = isLeave ? CalendarClock : isAtt ? ClipboardCheck : isExpense ? Receipt : Bell;
                          const color = isLeave ? C.amber : isAtt ? C.emerald : C.brand;
                          return (
                            <button
                              key={n._id}
                              onClick={() => openNotif(n)}
                              className={`flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-gray-50 ${!n.seen ? "bg-red-50/50" : ""}`}
                            >
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${color}14`, color }}>
                                <Icon size={17} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className={`text-[13px] leading-snug ${n.seen ? "text-gray-500" : "font-semibold text-gray-900"}`}>{n.message}</p>
                                <p className="mt-1 text-[11px] text-gray-400">{timeAgo(n.createdAt)}</p>
                              </div>
                              {!n.seen && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-red-500" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                </>
              )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ================= WELCOME BANNER + ACTIONS ================= */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 p-6 text-white shadow-[0_20px_50px_-15px_rgba(220,38,38,0.45)] sm:p-8 lg:col-span-8"
          >
            <motion.div
              className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full bg-white/15 blur-2xl"
              animate={{ x: [0, -20, 0], y: [0, 15, 0] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="pointer-events-none absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-orange-300/25 blur-3xl" />
            <div className="pointer-events-none absolute right-8 bottom-6 hidden h-24 w-24 rounded-full border-[14px] border-white/10 md:block" />

            <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
              <div className="space-y-4">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
                  <DayIcon size={14} /> {hello}
                </span>
                <h2 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                  Welcome back, {firstName}! 👋
                </h2>
                <p className="max-w-md text-sm text-white/85">
                  {present + half} of {base} people are in today
                  {unmarked > 0 ? `, and ${unmarked} haven't been marked yet` : ""}.
                  {pendingLeaves > 0 ? ` ${pendingLeaves} leave request${pendingLeaves > 1 ? "s are" : " is"} waiting for you.` : " No leave requests are waiting."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => navigate("/admin-dashboard/leaves")}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-red-600 shadow-lg shadow-red-900/20 transition hover:-translate-y-0.5"
                  >
                    Review leaves <ArrowUpRight size={15} />
                  </button>
                  <button
                    onClick={exportCSV}
                    disabled={exporting}
                    className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/30 backdrop-blur transition hover:bg-white/25 disabled:opacity-70"
                  >
                    {exporting ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
                    {exporting ? "Preparing…" : "Export report"}
                  </button>
                </div>
              </div>

              {/* Attendance gauge */}
              <div className="mx-auto flex shrink-0 flex-col items-center rounded-3xl bg-white/15 p-5 ring-1 ring-white/25 backdrop-blur md:mx-0">
                <div className="relative h-32 w-32">
                  <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="11" />
                    <circle
                      cx="60" cy="60" r="50" fill="none" stroke="#fff" strokeWidth="11" strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 50} strokeDashoffset={2 * Math.PI * 50 * (1 - rate / 100)}
                      style={{ transition: "stroke-dashoffset 1.2s ease" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-extrabold tabular-nums"><Num value={rate} suffix="%" /></span>
                  </div>
                </div>
                <p className="mt-2 text-xs font-semibold text-white/85">Attendance today</p>
                <div className="mt-3 flex h-1.5 w-32 overflow-hidden rounded-full bg-white/25">
                  {[[present, "#ffffff"], [half, "#fde68a"], [leave, "#bae6fd"], [absent, "#fecdd3"]].map(([v, c], idx) =>
                    v ? <div key={idx} className="h-full" style={{ width: `${pct(v, base)}%`, background: c }} /> : null
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* To-do list */}
          <Card i={1} className="flex flex-col p-6 lg:col-span-4">
            <CardHeader icon={AlertCircle} title="To do" sub="Waiting for your action" color={C.amber} />
            <div className="flex-1 space-y-3">
              <TodoRow icon={CalendarClock} label="Leave requests" count={pendingLeaves} color={C.amber} onClick={() => navigate("/admin-dashboard/leaves")} />
              <TodoRow icon={ClipboardCheck} label="Attendance requests" count={pendingAtt} color={C.emerald} onClick={() => navigate("/admin-dashboard/attendance-requests")} />
              <TodoRow icon={Bell} label="Unread notifications" count={unseen} color={C.brand} onClick={() => setShowNotif(true)} />
            </div>
          </Card>
        </div>

        {/* ================= PASTEL KPIs ================= */}
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          <Kpi i={0} icon={Activity} label="Present today" value={present} total={base} color={C.emerald} bg="linear-gradient(135deg,#ecfdf5,#d1fae5)" />
          <Kpi i={1} icon={Clock} label="Half day" value={half} total={base} color={C.amber} bg="linear-gradient(135deg,#fffbeb,#fef3c7)" />
          <Kpi i={2} icon={UserMinus} label="On leave" value={leave} total={base} color={C.sky} bg="linear-gradient(135deg,#f0f9ff,#e0f2fe)" />
          <Kpi i={3} icon={AlertCircle} label="Absent" value={absent} total={base} color={C.rose} bg="linear-gradient(135deg,#fff1f2,#ffe4e6)" />
        </div>

        {/* ================= INSIGHTS ================= */}
        <Card className="p-6">
          <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-amber-100/60 blur-2xl" />
          <CardHeader icon={Lightbulb} title="Today's insights" sub="Worked out automatically from your data" color={C.amber} />
          <div className="relative grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {insights.map((ins, idx) => {
              const style =
                ins.tone === "good" ? { Icon: TrendingUp, color: C.emerald, bg: "#ecfdf5" }
                : ins.tone === "warn" ? { Icon: TrendingDown, color: C.amber, bg: "#fffbeb" }
                : { Icon: Info, color: C.slate, bg: "#f1f5f9" };
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                  transition={{ delay: idx * 0.07 }}
                  className="flex items-start gap-3 rounded-2xl p-4"
                  style={{ background: style.bg }}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm" style={{ color: style.color }}>
                    <style.Icon size={15} />
                  </div>
                  <p className="text-sm leading-snug text-gray-700">{ins.text}</p>
                </motion.div>
              );
            })}
          </div>
        </Card>

        {/* ================= ORG NUMBERS ================= */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
          {[
            [Users, "Total workforce", summary?.totalEmployees, C.brand, "Active employees"],
            [Building, "Departments", summary?.totalDepartments, C.slate, data.depts[0] ? `Largest: ${data.depts[0].name}` : "—"],
            [BriefcaseBusiness, "Clients", summary?.totalClients, C.amber, `${summary?.totalAnnual || 0} annual · ${summary?.totalQuarterly || 0} quarterly`],
          ].map(([Icon, label, val, color, hint], idx) => (
            <Card key={label} i={idx} className="group flex items-center gap-5 p-6 transition-transform duration-300 hover:-translate-y-1">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)`, boxShadow: `0 10px 24px -8px ${color}80` }}>
                <Icon size={24} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-500">{label}</p>
                <p className="text-3xl font-extrabold tracking-tight text-gray-900 tabular-nums"><Num value={val} /></p>
                <p className="truncate text-xs text-gray-400">{hint}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* ================= CHARTS ================= */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Card className="p-6 lg:col-span-7">
            <CardHeader icon={Building} title="Team size by department" sub={`${data.depts.length} departments`} color={C.brand} />
            {data.depts.length === 0 ? (
              <Empty text="No department data yet" />
            ) : (
              <div style={{ height: Math.max(240, data.depts.length * 40) }}>
                {ready && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.depts} layout="vertical" margin={{ left: 4, right: 20 }}>
                      <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                      <XAxis type="number" allowDecimals={false} tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={110} tick={{ fill: "#374151", fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={tooltipStyle} />
                      <Bar dataKey="value" name="Employees" radius={[0, 10, 10, 0]} barSize={20}>
                        {data.depts.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </Card>

          <Card className="p-6 lg:col-span-5">
            <CardHeader icon={CalendarClock} title="Leave requests" sub={`${leaveTotal} in total`} color={C.amber} />
            {leaveTotal === 0 ? (
              <Empty text="No leave requests yet" />
            ) : (
              <div className="space-y-4">
                {data.leaves.map((l) => (
                  <div key={l.name} className="rounded-2xl bg-gray-50/70 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: LEAVE_COLORS[l.name] }} />
                        {l.name}
                      </span>
                      <span className="text-sm tabular-nums">
                        <b className="text-gray-900">{l.value}</b>
                        <span className="ml-1.5 text-gray-400">{pct(l.value, leaveTotal)}%</span>
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-white">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct(l.value, leaveTotal)}%`, background: LEAVE_COLORS[l.name] }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Donut icon={PieIcon} title="Client plans" data={data.plans} ready={ready} offset={0} color={C.brand} />
          <Donut icon={Handshake} title="Sponsors" data={data.sponsors} ready={ready} offset={2} color={C.emerald} />
          <Donut icon={Store} title="Stalls" data={data.stalls} ready={ready} offset={4} color={C.sky} />
        </div>

        {/* ================= BIRTHDAYS ================= */}
        <Card className="p-6 sm:p-8">
          <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-pink-100/60 blur-2xl" />
          <CardHeader icon={Cake} title="Birthdays" sub={`${todayBdays.length} today · ${upcoming.length} coming up`} color={C.pink} />
          {todayBdays.length === 0 && upcoming.length === 0 ? (
            <Empty icon={Gift} text="No birthdays coming up" />
          ) : (
            <div className="relative space-y-5">
              {todayBdays.length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {todayBdays.map((e) => (
                    <div key={e._id} className="relative flex items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-pink-500 to-rose-500 p-4 text-white shadow-lg shadow-pink-500/30">
                      <Gift size={70} strokeWidth={1.25} className="pointer-events-none absolute -right-3 -bottom-3 opacity-15" />
                      <img src={imageUrl(e.userId?.profileImage || e.profileImage)} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-4 ring-white/30" />
                      <div className="min-w-0">
                        <p className="truncate text-lg font-bold">{e.userId?.name || e.name}</p>
                        <p className="text-xs font-medium text-white/85">🎂 Happy birthday today!</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {upcoming.length > 0 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {upcoming.map((e) => {
                    const d = daysUntil(e.dob);
                    return (
                      <div key={e._id} className="flex items-center gap-3 rounded-2xl bg-gray-50/80 p-3 ring-1 ring-gray-100 transition hover:bg-white hover:shadow-md">
                        <img src={imageUrl(e.userId?.profileImage || e.profileImage)} alt="" className="h-12 w-12 shrink-0 rounded-2xl object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-900">{e.userId?.name || e.name}</p>
                          <p className="text-xs text-gray-400">
                            {e.dob ? new Date(e.dob).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                          </p>
                        </div>
                        {d !== null && (
                          <span className="shrink-0 rounded-full bg-pink-50 px-2.5 py-1 text-[11px] font-bold tabular-nums text-pink-600">
                            {d === 1 ? "Tomorrow" : `${d} days`}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </Card>

        <p className="text-center text-xs text-gray-400">
          {synced ? `Last updated ${timeAgo(synced)} · attendance refreshes automatically` : ""}
        </p>
      </div>
    </div>
  );
};

/* ================= PIECES ================= */
const TodoRow = ({ icon: Icon, label, count, color, onClick }) => (
  <button
    onClick={onClick}
    className="group flex w-full items-center gap-3 rounded-2xl bg-gray-50/80 p-3.5 text-left ring-1 ring-transparent transition hover:bg-white hover:shadow-md hover:ring-gray-100"
  >
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${color}14`, color }}>
      <Icon size={18} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-gray-900">{label}</p>
      <p className="text-xs text-gray-400">{count > 0 ? `${count} pending` : "All done"}</p>
    </div>
    {count > 0 ? (
      <span className="flex h-7 min-w-[28px] items-center justify-center rounded-full px-2 text-xs font-bold text-white" style={{ background: color }}>
        {count}
      </span>
    ) : (
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
        <CheckCheck size={14} />
      </span>
    )}
  </button>
);

const Donut = ({ icon, title, data, ready, offset, color }) => {
  const total = data.reduce((s, d) => s + (d.value || 0), 0);
  const [active, setActive] = useState(null);
  const shown = active !== null ? data[active] : null;
  const colorAt = (i) => CHART_COLORS[(i + offset) % CHART_COLORS.length];

  return (
    <Card className="p-6">
      <CardHeader icon={icon} title={title} sub={`${data.length} categories`} color={color} />
      {total === 0 ? (
        <Empty text="No data yet" />
      ) : (
        <>
          <div className="relative h-[180px]">
            {ready && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data} dataKey="value" innerRadius="64%" outerRadius="90%" cornerRadius={6}
                    paddingAngle={data.length > 1 ? 4 : 0} stroke="none"
                    onMouseEnter={(_, i) => setActive(i)} onMouseLeave={() => setActive(null)}
                  >
                    {data.map((_, i) => (
                      <Cell key={i} fill={colorAt(i)} opacity={active === null || active === i ? 1 : 0.3} style={{ outline: "none", transition: "opacity .2s" }} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold tabular-nums text-gray-900">{shown ? shown.value : total}</span>
              <span className="max-w-[100px] truncate text-xs font-medium text-gray-400">{shown ? shown.name : "Total"}</span>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.map((d, i) => (
              <span
                key={d.name}
                onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
                className={`inline-flex cursor-default items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${active === i ? "bg-gray-100" : "bg-gray-50"}`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: colorAt(i) }} />
                <span className="text-gray-600">{d.name}</span>
                <b className="tabular-nums text-gray-900">{d.value}</b>
              </span>
            ))}
          </div>
        </>
      )}
    </Card>
  );
};

export default AdminSummary;