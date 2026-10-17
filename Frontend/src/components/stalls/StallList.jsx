import axios from "axios";
import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { StallButtons } from "../../utils/StallHelper";
import {
  Search, Plus, Store, ChevronLeft, ChevronRight, ChevronDown, UserX, X,
  CalendarCheck2, Tag, Layers, LayoutGrid, List as ListIcon, ArrowUpDown,
  RefreshCw, Hash, ClipboardList,
} from "lucide-react";

const PAGE_BG =
  "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const CARD =
  "rounded-3xl bg-white/90 ring-1 ring-white/70 shadow-[0_10px_40px_-12px_rgba(127,29,29,0.18)] backdrop-blur";

/* ================= IMAGE HELPER ================= */
const getImageUrl = (imagePath) => {
  if (!imagePath) return "/default-avatar.png";
  if (imagePath.startsWith("http")) return imagePath;
  return `${import.meta.env.VITE_BACKEND_URL}/${imagePath}`;
};

const compact = (n) => {
  n = Number(n) || 0;
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
};
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fmtNum = (v) => (Number.isFinite(Number(v)) && v !== "" && v !== null ? Number(v).toLocaleString("en-IN") : v || "—");

const TONES = [
  "bg-red-50 text-red-700 ring-red-100",
  "bg-violet-50 text-violet-700 ring-violet-100",
  "bg-sky-50 text-sky-700 ring-sky-100",
  "bg-amber-50 text-amber-700 ring-amber-100",
  "bg-emerald-50 text-emerald-700 ring-emerald-100",
  "bg-teal-50 text-teal-700 ring-teal-100",
];
const toneFor = (v) => {
  if (!v) return "bg-gray-100 text-gray-500 ring-gray-200";
  let h = 0;
  for (let i = 0; i < v.length; i++) h = (h * 31 + v.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
};

const AVATAR_BG = ["from-red-500 to-rose-400", "from-violet-500 to-fuchsia-400", "from-sky-500 to-cyan-400", "from-amber-500 to-orange-400", "from-emerald-500 to-teal-400"];
const colorFor = (s = "") => AVATAR_BG[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_BG.length];
const initials = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

const SORTS = [
  ["sno", "Default order"],
  ["number", "Stall number"],
  ["name", "Name A–Z"],
  ["eventsDesc", "Events: most first"],
];
const PAGE_SIZE_OPTIONS = [5, 10, 15, 20];

/* Logo with initials fallback */
const StallLogo = ({ src, name, size = "h-11 w-11", rounded = "rounded-2xl" }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`${size} ${rounded} flex shrink-0 items-center justify-center bg-gradient-to-br ${colorFor(name)} text-sm font-bold text-white shadow-md`}>
        {initials(name)}
      </div>
    );
  }
  return <img src={src} alt="" onError={() => setFailed(true)} className={`${size} ${rounded} shrink-0 bg-white object-cover shadow-md ring-2 ring-white`} />;
};

const PlanChips = ({ plans }) => {
  const list = Array.isArray(plans) ? plans.filter(Boolean) : [];
  if (!list.length) return <span className="text-xs font-medium text-gray-300">No plan</span>;
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="inline-flex max-w-[10rem] items-center gap-1 truncate rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
        <ClipboardList size={12} className="shrink-0 text-gray-400" /> <span className="truncate">{String(list[0])}</span>
      </span>
      {list.length > 1 && (
        <span title={list.slice(1).join(", ")} className="rounded-full bg-red-50 px-2 py-1 text-[11px] font-bold text-red-600">+{list.length - 1}</span>
      )}
    </div>
  );
};

const NumberBadge = ({ number }) =>
  number !== undefined && number !== null && number !== "" ? (
    <span className="absolute -bottom-1.5 -right-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-gradient-to-br from-red-600 to-rose-500 px-1 text-[9px] font-bold text-white shadow ring-2 ring-white">
      {number}
    </span>
  ) : null;

const Highlight = ({ text = "", q }) => {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-red-100 px-0.5 text-red-700">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
};

/* ================= CARD (mobile + grid view) ================= */
const StallCard = ({ s, refresh, index, q, pos, maxEvents }) => (
  <motion.div
    layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
    transition={{ delay: Math.min(index, 8) * 0.04 }}
    className="group relative overflow-hidden rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-100 transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-18px_rgba(220,38,38,0.35)] hover:ring-red-100"
  >
    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-600 to-rose-400 opacity-0 transition group-hover:opacity-100" />
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <StallLogo src={s.logo ? getImageUrl(s.logo) : ""} name={s.name} size="h-14 w-14" />
        <NumberBadge number={s.number} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold text-gray-900"><Highlight text={s.name || ""} q={q} /></p>
        <p className="text-xs font-medium text-gray-400">Stall #<Highlight text={String(s.number ?? "—")} q={q} /></p>
        {s.type && (
          <span className={`mt-1 inline-flex max-w-full truncate rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${toneFor(s.type)}`}>
            {s.type}
          </span>
        )}
      </div>
      <span className="self-start text-xs font-semibold tabular-nums text-gray-300">#{String(pos).padStart(2, "0")}</span>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-2">
      <div className="rounded-2xl bg-gray-50 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Events</p>
        <p className="mt-0.5 text-sm font-bold text-gray-900">{fmtNum(s.eventCount)}</p>
        {num(s.eventCount) > 0 && (
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-gray-200">
            <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-rose-400" style={{ width: `${Math.max(6, (num(s.eventCount) / maxEvents) * 100)}%` }} />
          </div>
        )}
      </div>
      <div className="min-w-0 rounded-2xl bg-gray-50 p-3">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Plan</p>
        <PlanChips plans={s.plans} />
      </div>
    </div>
    <div className="mt-4 flex justify-end border-t border-gray-100 pt-4">
      <StallButtons id={s._id} refresh={refresh} />
    </div>
  </motion.div>
);

const StallList = () => {
  const [stalls, setStalls] = useState([]);
  const [filteredStalls, setFilteredStalls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  // UI-only state
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("sno");
  const [view, setView] = useState("list");
  const [loadError, setLoadError] = useState(false);

  const fetchStalls = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/stalls`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      if (res.data.success) {
        const data = res.data.stalls.map((s, index) => ({
          _id: s._id,
          sno: index + 1,
          ...s,
        }));
        setStalls(data);
        setFilteredStalls(data);
      }
    } catch {
      console.error("Failed to load stalls");
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStalls(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    let result = stalls.filter((s) =>
      ((s.name || "").toLowerCase().includes(q) ||
        String(s.number ?? "").includes(search)) &&
      (typeFilter === "all" || (s.type || "") === typeFilter)
    );
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "name": return (a.name || "").localeCompare(b.name || "");
        case "number": return String(a.number ?? "").localeCompare(String(b.number ?? ""), undefined, { numeric: true });
        case "eventsDesc": return num(b.eventCount) - num(a.eventCount);
        default: return a.sno - b.sno;
      }
    });
    setFilteredStalls(result);
    setCurrentPage(1);
  }, [search, stalls, typeFilter, sortBy]);

  const totalPages = Math.ceil(filteredStalls.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedStalls = filteredStalls.slice(startIndex, startIndex + itemsPerPage);

  const handlePageSizeChange = (size) => {
    setItemsPerPage(size);
    setCurrentPage(1);
  };

  const totalEvents = useMemo(
    () => stalls.reduce((sum, s) => sum + (Number(s.eventCount) || 0), 0),
    [stalls]
  );

  /* ---- derived UI values ---- */
  const types = useMemo(() => {
    const m = new Map();
    stalls.forEach((s) => { if (s.type) m.set(s.type, (m.get(s.type) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [stalls]);
  const withPlan = stalls.filter((s) => Array.isArray(s.plans) && s.plans.length > 0).length;
  const maxEvents = Math.max(1, ...stalls.map((s) => num(s.eventCount)));

  const pageNumbers = useMemo(() => {
    const t = totalPages || 1;
    if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1);
    const set = new Set([1, t, currentPage - 1, currentPage, currentPage + 1]);
    const arr = [...set].filter((p) => p >= 1 && p <= t).sort((a, b) => a - b);
    const out = [];
    arr.forEach((p, i) => { if (i && p - arr[i - 1] > 1) out.push("…" + i); out.push(p); });
    return out;
  }, [totalPages, currentPage]);

  const hasFilters = search || typeFilter !== "all";
  const clearFilters = () => { setSearch(""); setTypeFilter("all"); };

  const STATS = [
    { label: "Stalls", value: stalls.length, icon: Store, tone: "from-red-600 to-rose-500" },
    { label: "Total events", value: compact(totalEvents), icon: CalendarCheck2, tone: "from-emerald-500 to-teal-400" },
    { label: "Stall types", value: types.length, icon: Layers, tone: "from-violet-500 to-fuchsia-400" },
    { label: "On a plan", value: `${withPlan}/${stalls.length}`, icon: ClipboardList, tone: "from-amber-500 to-orange-400" },
  ];

  return (
    <div className={`relative min-h-screen ${PAGE_BG} pb-20 text-gray-900`}>
      <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">

        {/* HEADER */}
        <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/30">
              <Store size={26} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-500">Partners</p>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                Stall <span className="bg-gradient-to-r from-red-600 to-rose-500 bg-clip-text text-transparent">Registry</span>
              </h1>
            </div>
          </div>
          <Link
            to="/admin-dashboard/add-stall"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:-translate-y-0.5 hover:brightness-110 active:scale-95"
          >
            <Plus size={17} /> Add stall
          </Link>
        </motion.header>

        {/* STATS */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}
              className={`${CARD} flex items-center gap-3 p-4`}>
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${s.tone} text-white shadow-md`}>
                <s.icon size={19} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{s.label}</p>
                {loading ? <div className="mt-1 h-5 w-16 animate-pulse rounded bg-gray-200" /> :
                  <p className="truncate text-lg font-extrabold tracking-tight text-gray-900">{s.value}</p>}
              </div>
            </motion.div>
          ))}
        </div>

        {/* MAIN CARD */}
        <div className={`${CARD} overflow-hidden`}>
          {/* Toolbar */}
          <div className="space-y-4 border-b border-gray-100 p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="group relative flex flex-1 items-center rounded-2xl bg-gray-50 px-4 ring-1 ring-gray-200 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-red-400">
                <Search size={17} className="text-gray-400 transition group-focus-within:text-red-500" />
                <input
                  type="text"
                  placeholder="Search by stall name or number…"
                  className="w-full bg-transparent py-3 pl-3 text-sm font-medium text-gray-900 outline-none placeholder:text-gray-400"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button onClick={() => setSearch("")} aria-label="Clear search" className="rounded-full p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1 lg:flex-none">
                  <ArrowUpDown size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                    className="w-full cursor-pointer appearance-none rounded-2xl bg-white py-3 pl-9 pr-9 text-sm font-semibold text-gray-700 outline-none ring-1 ring-gray-200 transition hover:ring-red-200 focus:ring-2 focus:ring-red-400">
                    {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
                <div className="hidden rounded-2xl bg-gray-100 p-1 md:flex">
                  {[["list", ListIcon], ["grid", LayoutGrid]].map(([v, Icon]) => (
                    <button key={v} onClick={() => setView(v)} aria-label={`${v} view`}
                      className={`relative rounded-xl px-3 py-2 transition ${view === v ? "text-red-600" : "text-gray-400 hover:text-gray-600"}`}>
                      {view === v && <motion.span layoutId="stall-view-pill" className="absolute inset-0 rounded-xl bg-white shadow-sm" />}
                      <Icon size={16} className="relative" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Type chips */}
            {types.length > 0 && (
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {[["all", stalls.length], ...types].map(([c, count]) => {
                  const active = typeFilter === c;
                  return (
                    <button key={c} onClick={() => setTypeFilter(c)}
                      className={`relative flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${active ? "text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:text-red-600 hover:ring-red-200"}`}>
                      {active && <motion.span layoutId="type-chip" className="absolute inset-0 rounded-full bg-gradient-to-r from-red-600 to-rose-500 shadow shadow-red-600/30" transition={{ type: "spring", stiffness: 420, damping: 32 }} />}
                      {c !== "all" && <Tag size={12} className="relative" />}
                      <span className="relative">{c === "all" ? "All types" : c}</span>
                      <span className={`relative rounded-full px-1.5 text-[10px] ${active ? "bg-white/25" : "bg-gray-100 text-gray-500"}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {hasFilters && !loading && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500"><b className="text-gray-900">{filteredStalls.length}</b> of {stalls.length} stalls</span>
                <button onClick={clearFilters} className="font-semibold text-red-600 hover:underline">Clear filters</button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-4 rounded-2xl p-3">
                  <div className="h-11 w-11 rounded-2xl bg-gray-200" />
                  <div className="flex-1 space-y-2"><div className="h-3 w-40 rounded bg-gray-200" /><div className="h-2.5 w-24 rounded bg-gray-100" /></div>
                  <div className="hidden h-6 w-24 rounded-full bg-gray-100 sm:block" />
                  <div className="h-8 w-28 rounded-xl bg-gray-100" />
                </div>
              ))}
            </div>
          ) : loadError && stalls.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500"><UserX size={22} /></div>
              <p className="text-sm font-bold text-gray-800">Couldn't load stalls</p>
              <p className="mt-1 text-xs text-gray-500">Check your connection and try again.</p>
              <button onClick={fetchStalls}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow shadow-red-600/30 hover:brightness-110">
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          ) : (
            <>
              {/* MOBILE + GRID */}
              <div className={`${view === "grid" ? "md:grid" : "md:hidden"} grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3`}>
                <AnimatePresence mode="popLayout">
                  {paginatedStalls.map((s, i) => (
                    <StallCard key={s._id} s={s} refresh={fetchStalls} index={i} q={search} pos={startIndex + i + 1} maxEvents={maxEvents} />
                  ))}
                </AnimatePresence>
                {paginatedStalls.length === 0 && <div className="col-span-full"><EmptyState onClear={hasFilters ? clearFilters : null} /></div>}
              </div>

              {/* DESKTOP TABLE */}
              {view === "list" && (
                <div className="hidden md:block">
                  <table className="w-full table-auto border-collapse text-left">
                    <thead>
                      <tr className="bg-gray-50/70 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        <th className="w-14 py-3 pl-5 pr-2 font-bold lg:pl-6">#</th>
                        <th className="px-3 py-3 font-bold">Stall</th>
                        <th className="px-3 py-3 font-bold">Type</th>
                        <th className="px-3 py-3 font-bold">Events</th>
                        <th className="px-3 py-3 font-bold">Plan</th>
                        <th className="w-px whitespace-nowrap py-3 pl-3 pr-5 text-right font-bold lg:pr-6">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <AnimatePresence initial={false}>
                        {paginatedStalls.map((s, i) => {
                          const ev = num(s.eventCount);
                          return (
                            <motion.tr
                              key={s._id}
                              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                              transition={{ delay: Math.min(i, 10) * 0.03 }}
                              className="group transition-colors hover:bg-red-50/40"
                            >
                              <td className="relative py-3.5 pl-5 pr-2 text-xs font-semibold tabular-nums text-gray-400 lg:pl-6">
                                <span className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-red-600 to-rose-400 opacity-0 transition group-hover:opacity-100" />
                                {String(startIndex + i + 1).padStart(2, "0")}
                              </td>
                              <td className="max-w-0 px-3 py-3.5">
                                <div className="flex items-center gap-3">
                                  <div className="relative shrink-0">
                                    <StallLogo src={s.logo ? getImageUrl(s.logo) : ""} name={s.name} />
                                    <NumberBadge number={s.number} />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-gray-900 transition group-hover:text-red-700">
                                      <Highlight text={s.name || ""} q={search} />
                                    </p>
                                    <p className="flex items-center gap-1 text-xs text-gray-400">
                                      <Hash size={11} /> Stall <Highlight text={String(s.number ?? "—")} q={search} />
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="max-w-[12rem] px-3 py-3.5">
                                {s.type ? (
                                  <span className={`inline-flex max-w-full items-center gap-1 truncate whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${toneFor(s.type)}`}>
                                    <Tag size={12} className="shrink-0" /> <span className="truncate">{s.type}</span>
                                  </span>
                                ) : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-3 py-3.5">
                                <p className="whitespace-nowrap text-sm font-bold tabular-nums text-gray-900">{fmtNum(s.eventCount)}</p>
                                {ev > 0 && (
                                  <div className="mt-1.5 h-1 w-20 overflow-hidden rounded-full bg-gray-100">
                                    <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-rose-400" style={{ width: `${Math.max(6, (ev / maxEvents) * 100)}%` }} />
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-3.5">
                                <PlanChips plans={s.plans} />
                              </td>
                              <td className="w-px whitespace-nowrap py-3.5 pl-3 pr-5 text-right lg:pr-6">
                                <div className="inline-flex justify-end">
                                  <StallButtons id={s._id} refresh={fetchStalls} />
                                </div>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </tbody>
                  </table>
                  {paginatedStalls.length === 0 && <EmptyState onClear={hasFilters ? clearFilters : null} />}
                </div>
              )}

              {/* PAGINATION */}
              {filteredStalls.length > 0 && (
                <div className="flex flex-col items-center gap-3 border-t border-gray-100 bg-gray-50/50 p-4 sm:flex-row sm:justify-between sm:px-6">
                  <p className="text-xs text-gray-500">
                    Showing <b className="text-gray-900">{startIndex + 1}–{Math.min(startIndex + itemsPerPage, filteredStalls.length)}</b> of <b className="text-gray-900">{filteredStalls.length}</b>
                  </p>

                  <div className="flex items-center gap-1">
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
                          {p === currentPage && <motion.span layoutId="stall-page" className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 shadow shadow-red-600/30" />}
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

/* ================= EMPTY STATE ================= */
const EmptyState = ({ onClear }) => (
  <div className="flex flex-col items-center py-16 text-center">
    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-300 ring-1 ring-gray-100">
      <UserX size={22} />
    </div>
    <p className="text-sm font-bold text-gray-700">No stalls found</p>
    <p className="mt-1 text-xs text-gray-400">Try a different name, number or type.</p>
    {onClear && (
      <button onClick={onClear} className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100">
        Clear filters
      </button>
    )}
  </div>
);

export default StallList;
