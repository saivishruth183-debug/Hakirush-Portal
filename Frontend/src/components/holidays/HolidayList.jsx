import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trash2, CalendarDays, Plus, Search, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight,
  X, Loader2, PartyPopper, CalendarCheck2, History, Sparkles, CalendarX2, Clock3,
} from "lucide-react";

const PAGE_BG =
  "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const CARD =
  "rounded-3xl bg-white/90 ring-1 ring-white/70 shadow-[0_10px_40px_-12px_rgba(127,29,29,0.18)] backdrop-blur";
const PAGE_SIZE_OPTIONS = [5, 8, 10, 15, 20];

/* ---------- helpers (UI only) ---------- */
const toLocalYMD = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
const daysFromToday = (d) => {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  return Math.round((x - t) / 86400000);
};
const relative = (n) => {
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  if (n > 0) return n < 60 ? `In ${n} days` : `In ${Math.round(n / 30)} months`;
  const a = -n;
  return a < 60 ? `${a} days ago` : `${Math.round(a / 30)} months ago`;
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
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-red-100 px-0.5 text-red-700">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
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

/* ================= DELETE CONFIRMATION ================= */
const ConfirmDeleteAlert = ({ holiday, busy, error, onConfirm, onCancel }) => (
  <Modal onClose={onCancel} dismissable={!busy}>
    <div className="h-1.5 bg-gradient-to-r from-red-600 to-rose-400" />
    <button onClick={onCancel} disabled={busy} aria-label="Close"
      className="absolute right-4 top-5 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-40"><X size={17} /></button>
    <div className="p-7 text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100">
        <AlertTriangle size={30} />
      </div>
      <h3 className="text-xl font-extrabold tracking-tight text-gray-900">Delete this holiday?</h3>
      {holiday && (
        <div className="mx-auto mt-4 flex items-center gap-3 rounded-2xl bg-gray-50 p-3 text-left ring-1 ring-gray-100">
          <DateBadge date={holiday.date} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-gray-900">{holiday.title}</p>
            <p className="text-xs text-gray-500">{holiday.displayDate}</p>
          </div>
        </div>
      )}
      <p className="mt-3 text-sm text-gray-500">It will be removed from the calendar and will count as a working day again. This can't be undone.</p>
      {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 ring-1 ring-red-100">{error}</p>}
    </div>
    <div className="grid grid-cols-2 gap-2 px-7 pb-7">
      <button onClick={onCancel} disabled={busy}
        className="rounded-2xl bg-gray-100 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-200 disabled:opacity-50">Cancel</button>
      <button onClick={onConfirm} disabled={busy}
        className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
        {busy ? "Deleting…" : error ? "Try again" : "Delete"}
      </button>
    </div>
  </Modal>
);

/* ================= SUCCESS TOAST ================= */
const DeleteSuccessAlert = ({ onClose }) =>
  createPortal(
    <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
      className="fixed inset-x-0 bottom-5 z-[110] flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-2xl bg-gray-900 py-3 pl-4 pr-2 text-sm font-semibold text-white shadow-2xl">
        <CheckCircle2 size={18} className="text-emerald-400" /> Holiday deleted
        <button onClick={onClose} aria-label="Dismiss" className="rounded-lg p-1 text-white/60 hover:bg-white/10 hover:text-white"><X size={15} /></button>
      </div>
    </motion.div>,
    document.body
  );

/* ================= PIECES ================= */
const DateBadge = ({ date, size = "md", past = false }) => {
  const d = new Date(date);
  const big = size === "md";
  return (
    <div className={`flex shrink-0 flex-col items-center justify-center overflow-hidden rounded-2xl bg-white leading-none shadow-sm ring-1 ${past ? "ring-gray-100" : "ring-red-100"} ${big ? "h-14 w-14" : "h-11 w-11"}`}>
      <span className={`w-full py-0.5 text-center text-[9px] font-bold uppercase tracking-wider text-white ${past ? "bg-gray-300" : "bg-gradient-to-r from-red-600 to-rose-500"}`}>
        {d.toLocaleDateString("en-IN", { month: "short" })}
      </span>
      <span className={`flex flex-1 items-center font-extrabold ${past ? "text-gray-400" : "text-gray-900"} ${big ? "text-xl" : "text-base"}`}>{d.getDate()}</span>
    </div>
  );
};

const StatusChip = ({ status }) =>
  status === "Past" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500"><History size={12} /> Past</span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100"><CalendarCheck2 size={12} /> Upcoming</span>
  );

const WhenChip = ({ date }) => {
  const n = daysFromToday(date);
  const tone = n === 0 ? "bg-red-600 text-white" : n > 0 && n <= 7 ? "bg-amber-50 text-amber-700 ring-1 ring-amber-100" : "bg-gray-50 text-gray-500 ring-1 ring-gray-100";
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}><Clock3 size={11} />{relative(n)}</span>;
};

const DeleteBtn = ({ onClick }) => (
  <button onClick={onClick} aria-label="Delete holiday" title="Delete holiday"
    className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-gray-400 ring-1 ring-gray-200 transition hover:bg-red-600 hover:text-white hover:ring-red-600 active:scale-90">
    <Trash2 size={15} />
  </button>
);

/* ================= MAIN ================= */
const HolidayList = () => {
  const [holidays, setHolidays] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);

  /* PAGINATION STATE */
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(8);

  /* UI-only state */
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all"); // all | Upcoming | Past
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/holiday/upcoming`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (res.data.success) {
        const today = toLocalYMD(new Date());
        const formatted = res.data.holidays.map((h) => ({
          ...h,
          displayDate: new Date(h.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
          status: toLocalYMD(h.date) < today ? "Past" : "Upcoming",
        }));
        setHolidays(formatted);
        setFiltered(formatted);
      }
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchHolidays(); }, []);

  // Search by title or by date text (e.g. "dec", "25 dec", "2026", weekday)
  const applyFilter = (q, list = holidays) => {
    const v = q.trim().toLowerCase();
    setFiltered(
      !v
        ? list
        : list.filter((h) => {
            const weekday = new Date(h.date).toLocaleDateString("en-IN", { weekday: "long" }).toLowerCase();
            return (h.title || "").toLowerCase().includes(v) || h.displayDate.toLowerCase().includes(v) || weekday.includes(v);
          })
    );
    setCurrentPage(1);
  };

  const handleSearch = (e) => {
    setQuery(e.target.value);
    applyFilter(e.target.value);
  };

  useEffect(() => { applyFilter(query, holidays); /* keep search after refetch */ }, [holidays]); // eslint-disable-line

  const confirmDelete = async () => {
    try {
      setDeleting(true);
      setDeleteError("");
      await axios.delete(`${import.meta.env.VITE_BACKEND_URL}/api/holiday/${deleteId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setDeleteId(null);
      setShowSuccess(true);
      setTimeout(() => { setShowSuccess(false); fetchHolidays(); }, 1500);
    } catch (err) {
      console.error(err);
      setDeleteError(err?.response?.data?.error || err?.response?.data?.message || "Couldn't delete this holiday. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  /* derived (UI) */
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => {
      // upcoming first (soonest first), then past (most recent first)
      if (a.status !== b.status) return a.status === "Upcoming" ? -1 : 1;
      return a.status === "Upcoming" ? new Date(a.date) - new Date(b.date) : new Date(b.date) - new Date(a.date);
    }),
    [filtered]
  );
  const visible = tab === "all" ? sorted : sorted.filter((h) => h.status === tab);
  const counts = {
    all: filtered.length,
    Upcoming: filtered.filter((h) => h.status === "Upcoming").length,
    Past: filtered.filter((h) => h.status === "Past").length,
  };
  const upcomingAll = holidays.filter((h) => h.status === "Upcoming").sort((a, b) => new Date(a.date) - new Date(b.date));
  const next = upcomingAll[0];
  const thisMonth = holidays.filter((h) => {
    const d = new Date(h.date), t = new Date();
    return d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
  }).length;
  const weekdayHolidays = upcomingAll.filter((h) => ![0, 6].includes(new Date(h.date).getDay())).length;
  const deleteTarget = holidays.find((h) => h._id === deleteId);

  /* PAGINATION LOGIC */
  const totalPages = Math.max(1, Math.ceil(visible.length / itemsPerPage));
  const page = Math.min(currentPage, totalPages);
  const indexOfLastItem = page * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = visible.slice(indexOfFirstItem, indexOfLastItem);

  const TABS = [
    { key: "all", label: "All" },
    { key: "Upcoming", label: "Upcoming" },
    { key: "Past", label: "Past" },
  ];

  return (
    <div className={`min-h-screen ${PAGE_BG} pb-12`}>
      <AnimatePresence>
        {deleteId && (
          <ConfirmDeleteAlert key="confirm" holiday={deleteTarget} busy={deleting} error={deleteError}
            onConfirm={confirmDelete} onCancel={() => { if (!deleting) { setDeleteId(null); setDeleteError(""); } }} />
        )}
        {showSuccess && <DeleteSuccessAlert key="ok" onClose={() => setShowSuccess(false)} />}
      </AnimatePresence>

      <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">

        {/* HEADER */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/30">
              <CalendarDays size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">Holidays</h1>
              <p className="text-sm text-gray-500">Company days off · excluded from leave counts</p>
            </div>
          </div>
          <Link
            to="/admin-dashboard/add-holiday"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98]"
          >
            <Plus size={17} strokeWidth={2.5} /> Add holiday
          </Link>
        </header>

        {/* SPOTLIGHT + STATS */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 p-5 text-white shadow-xl shadow-red-600/25 sm:p-6 lg:col-span-1">
            <div className="absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/15 blur-2xl" />
            <div className="absolute -bottom-10 left-10 h-32 w-32 rounded-full bg-orange-300/25 blur-2xl" />
            <p className="relative flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/80"><PartyPopper size={13} /> Next holiday</p>
            {loading ? (
              <div className="relative mt-3 space-y-2"><div className="h-7 w-40 animate-pulse rounded bg-white/25" /><div className="h-4 w-28 animate-pulse rounded bg-white/20" /></div>
            ) : next ? (
              <div className="relative mt-3 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-2xl font-extrabold leading-tight">{next.title}</p>
                  <p className="mt-1 text-sm text-white/85">
                    {new Date(next.date).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                </div>
                <div className="shrink-0 rounded-2xl bg-white/15 px-3 py-2 text-center ring-1 ring-white/25">
                  {daysFromToday(next.date) === 0 ? (
                    <p className="text-lg font-extrabold">Today</p>
                  ) : (
                    <>
                      <p className="text-3xl font-extrabold leading-none tabular-nums">{daysFromToday(next.date)}</p>
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/80">day{daysFromToday(next.date) === 1 ? "" : "s"} to go</p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <p className="relative mt-3 text-lg font-bold">Nothing scheduled yet</p>
            )}
          </motion.div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:col-span-2 lg:grid-cols-4">
            {[
              { label: "Total", value: holidays.length, Icon: CalendarDays, tone: "bg-red-50 text-red-600" },
              { label: "Upcoming", value: upcomingAll.length, Icon: CalendarCheck2, tone: "bg-emerald-50 text-emerald-600" },
              { label: "This month", value: thisMonth, Icon: Sparkles, tone: "bg-violet-50 text-violet-600" },
              { label: "On weekdays", value: weekdayHolidays, Icon: Clock3, tone: "bg-amber-50 text-amber-600", hint: "upcoming, Mon–Fri" },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * (i + 1) }}
                className={`${CARD} flex flex-col justify-between p-4`}>
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.tone}`}><s.Icon size={17} /></div>
                <div className="mt-3">
                  <p className="text-2xl font-extrabold tabular-nums text-gray-900">{loading ? "–" : s.value}</p>
                  <p className="text-xs font-semibold text-gray-500">{s.label}{s.hint && <span className="font-normal text-gray-400"> · {s.hint}</span>}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* LIST CARD */}
        <div className={`${CARD} overflow-hidden`}>
          {/* toolbar */}
          <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-1 rounded-2xl bg-gray-100/80 p-1">
              {TABS.map((t) => (
                <button key={t.key} onClick={() => { setTab(t.key); setCurrentPage(1); }}
                  className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition lg:flex-none ${tab === t.key ? "text-white" : "text-gray-500 hover:text-gray-800"}`}>
                  {tab === t.key && (
                    <motion.span layoutId="holiday-tab" className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 shadow-md shadow-red-600/25"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }} />
                  )}
                  <span className="relative">{t.label}</span>
                  <span className={`relative rounded-full px-1.5 text-[11px] font-bold ${tab === t.key ? "bg-white/25" : "bg-white text-gray-500"}`}>{counts[t.key]}</span>
                </button>
              ))}
            </div>
            <div className="relative w-full lg:w-80">
              <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={handleSearch}
                placeholder="Search by name, month or day…"
                className="w-full rounded-2xl border-0 bg-gray-50 py-2.5 pl-10 pr-9 text-sm text-gray-900 ring-1 ring-gray-200 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              {query && (
                <button onClick={() => handleSearch({ target: { value: "" } })} aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X size={15} /></button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="divide-y divide-gray-50">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-4 px-5 py-4">
                  <div className="h-14 w-14 rounded-2xl bg-gray-100" />
                  <div className="flex-1 space-y-2"><div className="h-4 w-1/3 rounded bg-gray-100" /><div className="h-3 w-1/5 rounded bg-gray-50" /></div>
                  <div className="hidden h-6 w-20 rounded-full bg-gray-100 sm:block" />
                </div>
              ))}
            </div>
          ) : currentItems.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500 ring-1 ring-red-100"><CalendarX2 size={28} /></div>
              <p className="text-base font-bold text-gray-900">{query ? "No holidays match your search" : holidays.length ? `No ${tab.toLowerCase()} holidays` : "No holidays yet"}</p>
              <p className="mt-1 text-sm text-gray-500">{query ? "Try a different name or month." : "Add the company's days off so leave counts skip them."}</p>
              {query ? (
                <button onClick={() => handleSearch({ target: { value: "" } })} className="mt-5 rounded-2xl bg-gray-100 px-5 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-200">Clear search</button>
              ) : !holidays.length && (
                <Link to="/admin-dashboard/add-holiday" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-600/30"><Plus size={16} /> Add holiday</Link>
              )}
            </div>
          ) : (
            <>
              {/* MOBILE */}
              <div className="space-y-3 p-4 md:hidden">
                <AnimatePresence initial={false}>
                  {currentItems.map((h, i) => {
                    const past = h.status === "Past";
                    return (
                      <motion.div key={h._id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                        className={`relative flex items-center gap-3 overflow-hidden rounded-2xl bg-white p-3 ring-1 ring-gray-100 ${past ? "opacity-75" : ""}`}>
                        <span className={`absolute inset-y-0 left-0 w-1 ${past ? "bg-gray-200" : "bg-gradient-to-b from-red-500 to-rose-400"}`} />
                        <DateBadge date={h.date} past={past} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-gray-900"><Highlight text={h.title} q={query.trim()} /></p>
                          <p className="text-xs text-gray-500">{new Date(h.date).toLocaleDateString("en-IN", { weekday: "long" })}</p>
                          <div className="mt-1.5"><WhenChip date={h.date} /></div>
                        </div>
                        {!past && <DeleteBtn onClick={() => setDeleteId(h._id)} />}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* DESKTOP TABLE */}
              <div className="hidden md:block">
                <table className="w-full table-auto border-collapse text-left">
                  <thead>
                    <tr className="bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      <th className="w-px whitespace-nowrap py-3 pl-6 pr-3">#</th>
                      <th className="px-3 py-3">Holiday</th>
                      <th className="px-3 py-3">Date</th>
                      <th className="px-3 py-3">When</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="w-px whitespace-nowrap py-3 pl-3 pr-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {currentItems.map((h, i) => {
                      const past = h.status === "Past";
                      const d = new Date(h.date);
                      const weekend = [0, 6].includes(d.getDay());
                      return (
                        <motion.tr key={h._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                          className={`group relative transition hover:bg-red-50/40 ${past ? "text-gray-400" : ""}`}>
                          <td className="relative w-px whitespace-nowrap py-3.5 pl-6 pr-3 text-xs font-semibold tabular-nums text-gray-400">
                            <span className={`absolute inset-y-2 left-0 w-1 rounded-r-full ${past ? "bg-gray-200" : "bg-gradient-to-b from-red-500 to-rose-400"}`} />
                            {indexOfFirstItem + i + 1}
                          </td>
                          <td className="max-w-0 px-3 py-3.5">
                            <div className="flex min-w-0 items-center gap-3">
                              <DateBadge date={h.date} size="sm" past={past} />
                              <p className={`truncate font-bold ${past ? "text-gray-500" : "text-gray-900 group-hover:text-red-700"}`} title={h.title}>
                                <Highlight text={h.title} q={query.trim()} />
                              </p>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3.5">
                            <p className={`text-sm font-semibold ${past ? "text-gray-500" : "text-gray-800"}`}>{h.displayDate}</p>
                            <p className="flex items-center gap-1.5 text-xs text-gray-400">
                              {d.toLocaleDateString("en-IN", { weekday: "long" })}
                              {weekend && <span className="rounded bg-gray-100 px-1.5 py-px text-[10px] font-semibold text-gray-500">Weekend</span>}
                            </p>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3.5"><WhenChip date={h.date} /></td>
                          <td className="whitespace-nowrap px-3 py-3.5"><StatusChip status={h.status} /></td>
                          <td className="w-px whitespace-nowrap py-3.5 pl-3 pr-6 text-right">
                            {!past ? <DeleteBtn onClick={() => setDeleteId(h._id)} /> : <span className="text-xs text-gray-300">—</span>}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION */}
              <div className="flex flex-col gap-3 border-t border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                  <span>Showing <b className="text-gray-900">{indexOfFirstItem + 1}–{Math.min(indexOfLastItem, visible.length)}</b> of <b className="text-gray-900">{visible.length}</b></span>
                  <span className="hidden h-4 w-px bg-gray-200 sm:block" />
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">Per page</span>
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <button key={n} onClick={() => { setItemsPerPage(n); setCurrentPage(1); }}
                        className={`h-7 min-w-7 rounded-lg px-1.5 text-xs font-bold transition ${itemsPerPage === n ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "text-gray-500 hover:bg-gray-100"}`}>{n}</button>
                    ))}
                  </div>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => setCurrentPage(Math.max(page - 1, 1))} disabled={page === 1} aria-label="Previous page"
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200 disabled:opacity-30"><ChevronLeft size={16} /></button>
                    {pageList(totalPages, page).map((p, i) =>
                      p === "…" ? (
                        <span key={`g${i}`} className="w-6 text-center text-gray-400">…</span>
                      ) : (
                        <button key={p} onClick={() => setCurrentPage(p)}
                          className={`relative h-9 min-w-9 rounded-xl px-2 text-sm font-bold transition ${p === page ? "text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                          {p === page && <motion.span layoutId="holiday-page" className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 shadow-md shadow-red-600/25" />}
                          <span className="relative">{p}</span>
                        </button>
                      )
                    )}
                    <button onClick={() => setCurrentPage(Math.min(page + 1, totalPages))} disabled={page === totalPages} aria-label="Next page"
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

export default HolidayList;
