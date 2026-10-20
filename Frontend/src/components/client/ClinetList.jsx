import axios from "axios";
import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ClientButtons } from "../../utils/ClientHelper";
import {
  Search, UserPlus, Building2, ChevronLeft, ChevronRight, ChevronDown, UserX,
  X, Wallet, TrendingUp, Layers, LayoutGrid, List as ListIcon, ArrowUpDown, Images,
  CalendarDays, RefreshCw,
} from "lucide-react";

const PAGE_BG =
  "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const CARD =
  "rounded-3xl bg-white/90 ring-1 ring-white/70 shadow-[0_10px_40px_-12px_rgba(127,29,29,0.18)] backdrop-blur";

const formatBudget = (n) => {
  if (!n && n !== 0) return "0";
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
};
const fullBudget = (b) => (Number.isFinite(Number(b)) && b !== "N/A" ? `₹${Number(b).toLocaleString("en-IN")}` : "—");

const PLAN_TONES = [
  "bg-red-50 text-red-700 ring-red-100",
  "bg-violet-50 text-violet-700 ring-violet-100",
  "bg-sky-50 text-sky-700 ring-sky-100",
  "bg-amber-50 text-amber-700 ring-amber-100",
  "bg-emerald-50 text-emerald-700 ring-emerald-100",
  "bg-teal-50 text-teal-700 ring-teal-100",
];
const planTone = (plan) => {
  if (!plan || plan === "No Plan") return "bg-gray-100 text-gray-500 ring-gray-200";
  let h = 0;
  for (let i = 0; i < plan.length; i++) h = (h * 31 + plan.charCodeAt(i)) >>> 0;
  return PLAN_TONES[h % PLAN_TONES.length];
};

const AVATAR_BG = ["from-red-500 to-rose-400", "from-violet-500 to-fuchsia-400", "from-sky-500 to-cyan-400", "from-amber-500 to-orange-400", "from-emerald-500 to-teal-400"];
const colorFor = (s = "") => AVATAR_BG[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_BG.length];
const initials = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

const SORTS = [
  ["sno", "Default order"],
  ["name", "Name A–Z"],
  ["budgetDesc", "Budget: high → low"],
  ["budgetAsc", "Budget: low → high"],
  ["newest", "Newest joined"],
];

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20];

/* Logo with initials fallback (avoids broken-image flashes) */
const ClientLogo = ({ src, name, size = "h-11 w-11", rounded = "rounded-2xl" }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`${size} ${rounded} flex shrink-0 items-center justify-center bg-gradient-to-br ${colorFor(name)} text-sm font-bold text-white shadow-md`}>
        {initials(name)}
      </div>
    );
  }
  return <img src={src} alt="" onError={() => setFailed(true)} className={`${size} ${rounded} shrink-0 object-cover shadow-md ring-2 ring-white`} />;
};

const Highlight = ({ text, q }) => {
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
const ClientCard = ({ client, getImageUrl, index, q, refresh }) => (
  <motion.div
    layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
    transition={{ delay: Math.min(index, 8) * 0.04 }}
    className="group relative overflow-hidden rounded-3xl bg-white p-5 ring-1 ring-gray-100 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-18px_rgba(220,38,38,0.35)] hover:ring-red-100"
  >
    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-600 to-rose-400 opacity-0 transition group-hover:opacity-100" />
    <div className="flex items-center gap-4">
      <ClientLogo src={client.logo ? getImageUrl(client.logo) : ""} name={client.name} size="h-14 w-14" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold text-gray-900"><Highlight text={client.name} q={q} /></p>
        <span className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${planTone(client.planType)}`}>
          <Highlight text={client.planType} q={q} />
        </span>
        <p className="mt-1 truncate font-mono text-[10px] text-gray-400" title={client.clientId}>ID: {client.clientId}</p>
      </div>
      <span className="self-start text-xs font-semibold tabular-nums text-gray-300">#{String(client.sno).padStart(2, "0")}</span>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-2">
      <div className="rounded-2xl bg-gray-50 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Budget</p>
        <p className="mt-0.5 text-sm font-bold text-gray-900">{fullBudget(client.budget)}</p>
      </div>
      <div className="rounded-2xl bg-gray-50 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Joined</p>
        <p className="mt-0.5 truncate text-sm font-bold text-gray-900">{client.doj === "N/A" ? "—" : client.doj}</p>
      </div>
    </div>
    <div className="mt-4 flex justify-end border-t border-gray-100 pt-4">
      <ClientButtons id={client._id} refresh={refresh} />
    </div>
  </motion.div>
);

const ClientList = () => {
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  // UI-only state
  const [planFilter, setPlanFilter] = useState("all");
  const [sortBy, setSortBy] = useState("sno");
  const [view, setView] = useState("list");
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const refreshClients = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    const fetchClients = async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/api/client`,
          { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
        );
        if (res.data.success) {
          let sno = 1;
          const data = res.data.clients.map((c) => ({
            _id: c._id,
            clientId: String(c.clientId || c._id),
            sno: sno++,
            name: c.userId?.name || "Unknown",
            budget: c.budget || "N/A",
            doj: c.dateOfJoining ? new Date(c.dateOfJoining).toDateString() : "N/A",
            logo: c.companyLogo || "",
            planType: c.planType || "No Plan",
          }));
          setClients(data);
          setFilteredClients(data);
        }
      } catch (err) {
        console.error("Failed to load clients:", err);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchClients();
  }, [reloadKey]);

  useEffect(() => {
    const q = search.toLowerCase();
    let result = clients.filter((c) =>
      (c.name.toLowerCase().includes(q) || c.planType.toLowerCase().includes(q) || c.clientId.toLowerCase().includes(q)) &&
      (planFilter === "all" || c.planType === planFilter)
    );
    const num = (b) => (Number.isFinite(Number(b)) ? Number(b) : -1);
    const time = (d) => (d === "N/A" ? 0 : new Date(d).getTime() || 0);
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "name": return a.name.localeCompare(b.name);
        case "budgetDesc": return num(b.budget) - num(a.budget);
        case "budgetAsc": return num(a.budget) - num(b.budget);
        case "newest": return time(b.doj) - time(a.doj);
        default: return a.sno - b.sno;
      }
    });
    setFilteredClients(result);
    setCurrentPage(1);
  }, [search, clients, planFilter, sortBy]);

  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedClients = filteredClients.slice(startIndex, startIndex + itemsPerPage);

  const handlePageSizeChange = (size) => {
    setItemsPerPage(size);
    setCurrentPage(1);
  };

  const totalBudget = useMemo(
    () => clients.reduce((sum, c) => sum + (Number(c.budget) || 0), 0),
    [clients]
  );

  const getImageUrl = (img) => {
    if (!img) return "/default-avatar.png";
    if (img.startsWith("http")) return img;
    return `${import.meta.env.VITE_BACKEND_URL}/${img}`;
  };

  /* ---- derived UI values ---- */
  const plans = useMemo(() => {
    const m = new Map();
    clients.forEach((c) => m.set(c.planType, (m.get(c.planType) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [clients]);
  const budgeted = clients.filter((c) => Number(c.budget) > 0);
  const avgBudget = budgeted.length ? totalBudget / budgeted.length : 0;
  const topPlan = plans.find(([p]) => p !== "No Plan")?.[0] || "—";
  const maxBudget = Math.max(1, ...clients.map((c) => Number(c.budget) || 0));

  const pageNumbers = useMemo(() => {
    const t = totalPages || 1;
    if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1);
    const set = new Set([1, t, currentPage - 1, currentPage, currentPage + 1]);
    const arr = [...set].filter((p) => p >= 1 && p <= t).sort((a, b) => a - b);
    const out = [];
    arr.forEach((p, i) => { if (i && p - arr[i - 1] > 1) out.push("…" + i); out.push(p); });
    return out;
  }, [totalPages, currentPage]);

  const hasFilters = search || planFilter !== "all";
  const clearFilters = () => { setSearch(""); setPlanFilter("all"); };

  const STATS = [
    { label: "Total clients", value: clients.length, icon: Building2, tone: "from-red-600 to-rose-500" },
    { label: "Total budget", value: `₹${formatBudget(totalBudget)}`, icon: Wallet, tone: "from-emerald-500 to-teal-400" },
    { label: "Avg. budget", value: `₹${formatBudget(avgBudget)}`, icon: TrendingUp, tone: "from-violet-500 to-fuchsia-400" },
    { label: "Top plan", value: topPlan, icon: Layers, tone: "from-amber-500 to-orange-400" },
  ];

  return (
    <div className={`relative min-h-screen ${PAGE_BG} pb-20 text-gray-900`}>
      <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">

        {/* HEADER */}
        <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/30">
              <Building2 size={26} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-500">Accounts</p>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                Client <span className="bg-gradient-to-r from-red-600 to-rose-500 bg-clip-text text-transparent">Directory</span>
              </h1>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              to="/admin-dashboard/clients/content"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:text-violet-700 hover:ring-violet-200 active:scale-95"
            >
              <Images size={17} /> Gallery & Standings
            </Link>
            <Link
              to="/admin-dashboard/add-client"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:-translate-y-0.5 hover:brightness-110 active:scale-95"
            >
              <UserPlus size={17} /> Onboard client
            </Link>
          </div>
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
                  placeholder="Search by client name, ID or plan…"
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
                      {view === v && <motion.span layoutId="client-view-pill" className="absolute inset-0 rounded-xl bg-white shadow-sm" />}
                      <Icon size={16} className="relative" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Plan chips */}
            {plans.length > 0 && (
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {[["all", clients.length], ...plans].map(([p, count]) => {
                  const active = planFilter === p;
                  return (
                    <button key={p} onClick={() => setPlanFilter(p)}
                      className={`relative flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${active ? "text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-red-200 hover:text-red-600"}`}>
                      {active && <motion.span layoutId="plan-chip" className="absolute inset-0 rounded-full bg-gradient-to-r from-red-600 to-rose-500 shadow shadow-red-600/30" transition={{ type: "spring", stiffness: 420, damping: 32 }} />}
                      <span className="relative">{p === "all" ? "All plans" : p}</span>
                      <span className={`relative rounded-full px-1.5 text-[10px] ${active ? "bg-white/25" : "bg-gray-100 text-gray-500"}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {hasFilters && !loading && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500"><b className="text-gray-900">{filteredClients.length}</b> of {clients.length} clients</span>
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
                  <div className="hidden h-6 w-20 rounded-full bg-gray-100 sm:block" />
                  <div className="h-8 w-28 rounded-xl bg-gray-100" />
                </div>
              ))}
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500"><UserX size={22} /></div>
              <p className="text-sm font-bold text-gray-800">Couldn't load clients</p>
              <p className="mt-1 text-xs text-gray-500">Check your connection and try again.</p>
              <button onClick={() => setReloadKey((k) => k + 1)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow shadow-red-600/30 hover:brightness-110">
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          ) : (
            <>
              {/* MOBILE + GRID */}
              <div className={`${view === "grid" ? "md:grid" : "md:hidden"} grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3`}>
                <AnimatePresence mode="popLayout">
                  {paginatedClients.map((client, i) => (
                    <ClientCard key={client._id} client={client} getImageUrl={getImageUrl} index={i} q={search} refresh={refreshClients} />
                  ))}
                </AnimatePresence>
                {paginatedClients.length === 0 && <div className="col-span-full"><EmptyState onClear={hasFilters ? clearFilters : null} /></div>}
              </div>

              {/* DESKTOP TABLE */}
              {view === "list" && (
                <div className="hidden md:block">
                  <table className="w-full table-auto border-collapse text-left">
                    <thead>
                      <tr className="bg-gray-50/70 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        <th className="w-14 py-3 pl-5 pr-2 font-bold lg:pl-6">#</th>
                        <th className="px-3 py-3 font-bold">Client</th>
                        <th className="px-3 py-3 font-bold">Plan</th>
                        <th className="px-3 py-3 font-bold">Budget</th>
                        <th className="hidden px-3 py-3 font-bold lg:table-cell">Joined</th>
                        <th className="w-px whitespace-nowrap py-3 pl-3 pr-5 text-right font-bold lg:pr-6">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <AnimatePresence initial={false}>
                        {paginatedClients.map((client, i) => {
                          const b = Number(client.budget) || 0;
                          return (
                            <motion.tr
                              key={client._id}
                              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                              transition={{ delay: Math.min(i, 10) * 0.03 }}
                              className="group transition-colors hover:bg-red-50/40"
                            >
                              <td className="relative py-3.5 pl-5 pr-2 text-xs font-semibold tabular-nums text-gray-400 lg:pl-6">
                                <span className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-red-600 to-rose-400 opacity-0 transition group-hover:opacity-100" />
                                {String(client.sno).padStart(2, "0")}
                              </td>
                              <td className="max-w-0 px-3 py-3.5">
                                <div className="flex items-center gap-3">
                                  <ClientLogo src={client.logo ? getImageUrl(client.logo) : ""} name={client.name} />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-gray-900 transition group-hover:text-red-700">
                                    <Highlight text={client.name} q={search} />
                                  </p>
                                  <p className="truncate font-mono text-[10px] text-gray-400" title={client.clientId}>
                                    ID: <Highlight text={client.clientId} q={search} />
                                  </p>
                                </div>
                                </div>
                              </td>
                              <td className="px-3 py-3.5">
                                <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${planTone(client.planType)}`}>
                                  <Highlight text={client.planType} q={search} />
                                </span>
                              </td>
                              <td className="px-3 py-3.5">
                                <p className="whitespace-nowrap text-sm font-bold text-gray-900">{fullBudget(client.budget)}</p>
                                {b > 0 && (
                                  <div className="mt-1.5 h-1 w-24 overflow-hidden rounded-full bg-gray-100">
                                    <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-rose-400" style={{ width: `${Math.max(6, (b / maxBudget) * 100)}%` }} />
                                  </div>
                                )}
                              </td>
                              <td className="hidden whitespace-nowrap px-3 py-3.5 text-sm text-gray-500 lg:table-cell">
                                {client.doj === "N/A" ? <span className="text-gray-300">—</span> : (
                                  <span className="inline-flex items-center gap-1.5"><CalendarDays size={13} className="text-gray-400" />{client.doj}</span>
                                )}
                              </td>
                              <td className="w-px whitespace-nowrap py-3.5 pl-3 pr-5 text-right lg:pr-6">
                                <div className="inline-flex justify-end">
                                  <ClientButtons id={client._id} refresh={refreshClients} />
                                </div>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    </tbody>
                  </table>
                  {paginatedClients.length === 0 && <EmptyState onClear={hasFilters ? clearFilters : null} />}
                </div>
              )}

              {/* PAGINATION */}
              {filteredClients.length > 0 && (
                <div className="flex flex-col items-center gap-3 border-t border-gray-100 bg-gray-50/50 p-4 sm:flex-row sm:justify-between sm:px-6">
                  <p className="text-xs text-gray-500">
                    Showing <b className="text-gray-900">{startIndex + 1}–{Math.min(startIndex + itemsPerPage, filteredClients.length)}</b> of <b className="text-gray-900">{filteredClients.length}</b>
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
                          {p === currentPage && <motion.span layoutId="client-page" className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 shadow shadow-red-600/30" />}
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
    <p className="text-sm font-bold text-gray-700">No clients found</p>
    <p className="mt-1 text-xs text-gray-400">Try a different name or plan type.</p>
    {onClear && (
      <button onClick={onClear} className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100">
        Clear filters
      </button>
    )}
  </div>
);

export default ClientList;