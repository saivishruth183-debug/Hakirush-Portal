import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Plus, ChevronLeft, ChevronRight, ChevronDown, Building2, Users, UserCheck,
  UserX, AlertTriangle, X, ArrowUpDown, RefreshCw, LayoutGrid, List,
} from "lucide-react";
import { DepartmentButtons } from "../../utils/DepartmentHelper";
import { apiErrorMessage } from "../../utils/apiError";

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20];
const PAGE_BG = "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "assigned", label: "Has manager" },
  { key: "unassigned", label: "No manager" },
  { key: "reassign", label: "Needs reassign" },
];

const SORTS = [
  { key: "sno", label: "Default order" },
  { key: "name-asc", label: "Name A–Z" },
  { key: "name-desc", label: "Name Z–A" },
  { key: "members-desc", label: "Most members" },
  { key: "members-asc", label: "Fewest members" },
];

const tileColors = [
  "from-red-500 to-rose-600",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-violet-500 to-purple-600",
  "from-slate-600 to-slate-800",
];
const colorFor = (s = "") => tileColors[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % tileColors.length];
const initials = (s = "") => s.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";

const rise = {
  hidden: { opacity: 0, y: 14 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] } }),
};

/* ================= SMALL PIECES ================= */
const StatCard = ({ icon: Icon, label, value, tone, i, active, onClick }) => (
  <motion.button
    type="button"
    initial="hidden" animate="show" custom={i} variants={rise}
    whileHover={{ y: -3 }}
    onClick={onClick}
    className={`group relative overflow-hidden rounded-3xl p-5 text-left transition ${
      active ? "bg-white shadow-lg ring-2 ring-red-300" : "bg-white/85 shadow-[0_10px_30px_-14px_rgba(127,29,29,0.18)] ring-1 ring-white/70 backdrop-blur-sm hover:bg-white"
    }`}
  >
    <div className={`pointer-events-none absolute -bottom-6 -right-6 opacity-[0.08] transition-transform duration-500 group-hover:scale-110 ${tone.text}`}>
      <Icon size={96} strokeWidth={1.5} />
    </div>
    <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tone.bg} ${tone.text}`}>
      <Icon size={18} />
    </div>
    <p className="mt-4 text-3xl font-extrabold tabular-nums tracking-tight text-gray-900">{value}</p>
    <p className="mt-0.5 text-xs font-medium text-gray-500">{label}</p>
  </motion.button>
);

const ManagerCell = ({ dep, compact }) => {
  if (!dep.managerName) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-500">
        <UserX size={12} /> Not assigned
      </span>
    );
  }
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${colorFor(dep.managerName)} text-[11px] font-bold text-white`}>
        {initials(dep.managerName)}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-gray-900">{dep.managerName}</p>
        {dep.managerInvalid ? (
          <p className="flex items-center gap-1 truncate text-[11px] font-semibold text-amber-600">
            <AlertTriangle size={11} /> No longer eligible — reassign
          </p>
        ) : (
          dep.managerDesignation && !compact && <p className="truncate text-[11px] text-gray-400">{dep.managerDesignation}</p>
        )}
      </div>
    </div>
  );
};

const MembersPill = ({ count }) =>
  typeof count === "number" ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold tabular-nums text-red-700">
      <Users size={12} /> {count} {count === 1 ? "member" : "members"}
    </span>
  ) : null;

const Skeleton = ({ className = "" }) => <div className={`animate-pulse rounded-2xl bg-gray-100 ${className}`} />;

/* ================= PAGE ================= */
const DepartmentList = () => {
  const [departments, setDepartments] = useState([]);
  const [depLoading, setDepLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("sno");
  const [view, setView] = useState("list");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [loadError, setLoadError] = useState("");

  const fetchDepartments = async () => {
    setDepLoading(true);
    try {
      const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/department`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      if (res.data.success) {
        let sno = 1;
        const data = res.data.departments.map((dep) => ({
          _id: dep._id,
          sno: sno++,
          dep_name: dep.dep_name,
          managerName: dep.manager?.name || null,
          // "invalid" = assigned manager is inactive or moved to another department
          managerInvalid: dep.managerStatus === "invalid",
          managerDesignation: dep.manager?.designation || "",
          memberCount: typeof dep.memberCount === "number" ? dep.memberCount : null,
        }));
        setDepartments(data);
        setLoadError("");
      }
    } catch (err) {
      console.error("Failed to load departments");
      setLoadError(apiErrorMessage(err, "Failed to load departments."));
    } finally {
      setDepLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  /* ---------- stats ---------- */
  const stats = useMemo(() => {
    const assigned = departments.filter((d) => d.managerName && !d.managerInvalid).length;
    const reassign = departments.filter((d) => d.managerInvalid).length;
    const unassigned = departments.filter((d) => !d.managerName).length;
    const hasCounts = departments.some((d) => typeof d.memberCount === "number");
    const members = departments.reduce((s, d) => s + (d.memberCount || 0), 0);
    return { total: departments.length, assigned, reassign, unassigned, members, hasCounts };
  }, [departments]);

  /* ---------- search + filter + sort ---------- */
  const filteredDepartments = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = departments.filter((d) => {
      if (filter === "assigned" && !(d.managerName && !d.managerInvalid)) return false;
      if (filter === "unassigned" && d.managerName) return false;
      if (filter === "reassign" && !d.managerInvalid) return false;
      if (!q) return true;
      return [d.dep_name, d.managerName, d.managerDesignation].some((v) => (v || "").toLowerCase().includes(q));
    });
    const by = {
      "name-asc": (a, b) => a.dep_name.localeCompare(b.dep_name),
      "name-desc": (a, b) => b.dep_name.localeCompare(a.dep_name),
      "members-desc": (a, b) => (b.memberCount ?? -1) - (a.memberCount ?? -1),
      "members-asc": (a, b) => (a.memberCount ?? Infinity) - (b.memberCount ?? Infinity),
    }[sort];
    return by ? [...list].sort(by) : list;
  }, [departments, search, filter, sort]);

  useEffect(() => setCurrentPage(1), [search, filter, sort, itemsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredDepartments.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const paginatedDepartments = filteredDepartments.slice(startIndex, startIndex + itemsPerPage);
  const showingFrom = filteredDepartments.length ? startIndex + 1 : 0;
  const showingTo = Math.min(startIndex + itemsPerPage, filteredDepartments.length);
  const maxMembers = Math.max(1, ...departments.map((d) => d.memberCount || 0));

  const pageNumbers = useMemo(() => {
    const pages = [];
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || Math.abs(p - safePage) <= 1) pages.push(p);
      else if (pages[pages.length - 1] !== "…") pages.push("…");
    }
    return pages;
  }, [totalPages, safePage]);

  const emptyText = loadError
    ? loadError
    : search || filter !== "all"
    ? "No departments match your search or filter."
    : "No departments yet — add the first one.";

  const clearAll = () => { setSearch(""); setFilter("all"); };

  return (
    <div className={`min-h-screen pb-20 font-sans text-gray-700 ${PAGE_BG}`}>
      <div className="mx-auto max-w-[1200px] space-y-6 p-4 sm:p-8">
        {/* ================= HEADER ================= */}
        <motion.header
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
          className="flex flex-col gap-5 pt-2 sm:flex-row sm:items-end sm:justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/30">
              <Building2 size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">Organisation</p>
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
                Department <span className="text-red-600">Directory</span>
              </h1>
              <p className="mt-0.5 text-sm text-gray-500">Manage departments and the managers who lead them.</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={fetchDepartments}
              disabled={depLoading}
              aria-label="Refresh"
              title="Refresh"
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-gray-500 shadow-sm ring-1 ring-red-100 transition hover:text-red-600 disabled:opacity-60"
            >
              <RefreshCw size={17} className={depLoading ? "animate-spin" : ""} />
            </button>
            <Link
              to="/admin-dashboard/add-department"
              className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98]"
            >
              <Plus size={17} className="transition-transform group-hover:rotate-90" />
              Add department
            </Link>
          </div>
        </motion.header>

        {/* ================= STATS ================= */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard i={0} icon={Building2} label="Total departments" value={depLoading ? "–" : stats.total}
            tone={{ bg: "bg-red-50", text: "text-red-600" }} active={filter === "all"} onClick={() => setFilter("all")} />
          <StatCard i={1} icon={UserCheck} label="With a manager" value={depLoading ? "–" : stats.assigned}
            tone={{ bg: "bg-emerald-50", text: "text-emerald-600" }} active={filter === "assigned"} onClick={() => setFilter("assigned")} />
          <StatCard i={2} icon={UserX} label="Without a manager" value={depLoading ? "–" : stats.unassigned}
            tone={{ bg: "bg-slate-100", text: "text-slate-600" }} active={filter === "unassigned"} onClick={() => setFilter("unassigned")} />
          {stats.reassign > 0 ? (
            <StatCard i={3} icon={AlertTriangle} label="Need reassigning" value={stats.reassign}
              tone={{ bg: "bg-amber-50", text: "text-amber-600" }} active={filter === "reassign"} onClick={() => setFilter("reassign")} />
          ) : (
            <StatCard i={3} icon={Users} label="Total members" value={depLoading ? "–" : stats.hasCounts ? stats.members : "—"}
              tone={{ bg: "bg-sky-50", text: "text-sky-600" }} active={false} onClick={() => {}} />
          )}
        </div>

        {/* ================= BOARD ================= */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.45 }}
          className="overflow-hidden rounded-3xl bg-white/90 shadow-[0_20px_50px_-20px_rgba(127,29,29,0.22)] ring-1 ring-white/70 backdrop-blur-sm"
        >
          {/* toolbar */}
          <div className="space-y-3 border-b border-red-50 p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <label className="relative flex-1">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by department, manager or designation…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-2xl bg-gray-50 py-3 pl-11 pr-10 text-sm font-medium text-gray-900 ring-1 ring-gray-200 transition placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-300"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-red-100 hover:text-red-600"
                  >
                    <X size={13} />
                  </button>
                )}
              </label>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <ArrowUpDown size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    className="cursor-pointer appearance-none rounded-2xl bg-gray-50 py-3 pl-9 pr-9 text-sm font-semibold text-gray-700 ring-1 ring-gray-200 focus:outline-none focus:ring-2 focus:ring-red-300"
                  >
                    {SORTS.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>

                <div className="hidden rounded-2xl bg-gray-50 p-1 ring-1 ring-gray-200 md:flex">
                  {[["list", List], ["grid", LayoutGrid]].map(([v, Icon]) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      aria-label={`${v} view`}
                      className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                        view === v ? "bg-white text-red-600 shadow-sm" : "text-gray-400 hover:text-gray-700"
                      }`}
                    >
                      <Icon size={16} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* filter chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
              {FILTERS.filter((f) => f.key !== "reassign" || stats.reassign > 0).map((f) => {
                const count = f.key === "all" ? stats.total : f.key === "assigned" ? stats.assigned : f.key === "unassigned" ? stats.unassigned : stats.reassign;
                const on = filter === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                      on ? "text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:text-red-600 hover:ring-red-200"
                    }`}
                  >
                    {on && (
                      <motion.span layoutId="dep-filter" className="absolute inset-0 rounded-full bg-gradient-to-r from-red-600 to-rose-500 shadow-md shadow-red-600/25"
                        transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                    )}
                    <span className="relative">{f.label}</span>
                    <span className={`relative rounded-full px-1.5 text-[10px] ${on ? "bg-white/25" : "bg-gray-100 text-gray-400"}`}>{count}</span>
                  </button>
                );
              })}
              {(search || filter !== "all") && (
                <button onClick={clearAll} className="ml-auto shrink-0 text-xs font-semibold text-red-600 hover:underline">
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* body */}
          {depLoading ? (
            <div className="space-y-3 p-4 sm:p-5">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4 rounded-2xl p-3 ring-1 ring-gray-100">
                  <Skeleton className="h-11 w-11" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/5" />
                  </div>
                  <Skeleton className="hidden h-8 w-40 md:block" />
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          ) : paginatedDepartments.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <div className={`flex h-16 w-16 items-center justify-center rounded-3xl ${loadError ? "bg-amber-50 text-amber-500" : "bg-red-50 text-red-400"}`}>
                {loadError ? <AlertTriangle size={26} /> : <Building2 size={26} />}
              </div>
              <p className="font-bold text-gray-800">{loadError ? "Couldn't load departments" : "Nothing to show"}</p>
              <p className="max-w-sm text-sm text-gray-500">{emptyText}</p>
              {loadError ? (
                <button onClick={fetchDepartments} className="mt-1 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50">
                  <RefreshCw size={14} /> Try again
                </button>
              ) : search || filter !== "all" ? (
                <button onClick={clearAll} className="mt-1 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50">
                  Clear search & filters
                </button>
              ) : (
                <Link to="/admin-dashboard/add-department" className="mt-1 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-red-600/25">
                  <Plus size={15} /> Add department
                </Link>
              )}
            </div>
          ) : view === "grid" ? (
            /* ---------- GRID VIEW (desktop) + cards on mobile ---------- */
            <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {paginatedDepartments.map((dep, i) => (
                  <DepartmentCard key={dep._id} dep={dep} i={i} fetchDepartments={fetchDepartments} maxMembers={maxMembers} />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <>
              {/* ---------- MOBILE CARDS ---------- */}
              <div className="grid grid-cols-1 gap-3 p-4 md:hidden">
                {paginatedDepartments.map((dep, i) => (
                  <DepartmentCard key={dep._id} dep={dep} i={i} fetchDepartments={fetchDepartments} maxMembers={maxMembers} />
                ))}
              </div>

              {/* ---------- DESKTOP TABLE ---------- */}
              <div className="hidden md:block">
                <div className="grid grid-cols-[72px_minmax(0,1.3fr)_minmax(0,1fr)_150px_170px] items-center gap-3 bg-gray-50/70 px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  <span>#</span>
                  <span>Department</span>
                  <span>Manager</span>
                  <span>Team size</span>
                  <span className="text-right">Actions</span>
                </div>
                <div className="divide-y divide-gray-100">
                  <AnimatePresence initial={false}>
                    {paginatedDepartments.map((dep, i) => (
                      <motion.div
                        key={dep._id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0, transition: { delay: i * 0.03 } }}
                        exit={{ opacity: 0 }}
                        className={`group grid grid-cols-[72px_minmax(0,1.3fr)_minmax(0,1fr)_150px_170px] items-center gap-3 px-6 py-3.5 transition-colors hover:bg-red-50/40 ${
                          dep.managerInvalid ? "bg-amber-50/40" : ""
                        }`}
                      >
                        <span className="font-mono text-xs font-bold text-gray-400">{String(dep.sno).padStart(2, "0")}</span>

                        <div className="flex min-w-0 items-center gap-3">
                          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${colorFor(dep.dep_name)} text-sm font-bold text-white shadow-md`}>
                            {initials(dep.dep_name)}
                          </div>
                          <p className="truncate text-[15px] font-bold text-gray-900 transition-colors group-hover:text-red-600">{dep.dep_name}</p>
                        </div>

                        <ManagerCell dep={dep} />

                        <div className="min-w-0">
                          {typeof dep.memberCount === "number" ? (
                            <div>
                              <p className="text-sm font-bold tabular-nums text-gray-900">
                                {dep.memberCount} <span className="text-xs font-medium text-gray-400">{dep.memberCount === 1 ? "member" : "members"}</span>
                              </p>
                              <div className="mt-1.5 h-1.5 w-24 overflow-hidden rounded-full bg-gray-100">
                                <motion.div
                                  initial={{ width: 0 }} animate={{ width: `${(dep.memberCount / maxMembers) * 100}%` }} transition={{ duration: 0.7, delay: 0.1 + i * 0.03 }}
                                  className="h-full rounded-full bg-gradient-to-r from-red-500 to-rose-400"
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </div>

                        <div className="flex justify-end">
                          <DepartmentButtons id={dep._id} onDepartmentDelete={fetchDepartments} />
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </>
          )}

          {/* ================= PAGINATION ================= */}
          {!depLoading && filteredDepartments.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-red-50 bg-gray-50/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-center text-xs text-gray-500 sm:text-left">
                Showing <b className="text-gray-900">{showingFrom}–{showingTo}</b> of <b className="text-gray-900">{filteredDepartments.length}</b>
              </p>

              <div className="flex items-center justify-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={safePage === 1}
                  aria-label="Previous page"
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-gray-500 ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                </button>
                {pageNumbers.map((p, idx) =>
                  p === "…" ? (
                    <span key={`gap-${idx}`} className="px-1 text-sm text-gray-400">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`h-9 min-w-[36px] rounded-xl px-2 text-sm font-bold tabular-nums transition ${
                        p === safePage
                          ? "bg-gradient-to-r from-red-600 to-rose-500 text-white shadow-md shadow-red-600/25"
                          : "bg-white text-gray-600 ring-1 ring-gray-200 hover:text-red-600 hover:ring-red-200"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                  disabled={safePage === totalPages}
                  aria-label="Next page"
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-gray-500 ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="relative self-center sm:self-auto">
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="cursor-pointer appearance-none rounded-xl bg-white py-2 pl-3 pr-8 text-xs font-semibold text-gray-600 ring-1 ring-gray-200 focus:outline-none focus:ring-2 focus:ring-red-300"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>{size} per page</option>
                  ))}
                </select>
                <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

/* ================= CARD (mobile + grid view) ================= */
const DepartmentCard = ({ dep, i, fetchDepartments, maxMembers }) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }}
    exit={{ opacity: 0, scale: 0.97 }}
    whileHover={{ y: -3 }}
    className={`group overflow-hidden rounded-3xl bg-white ring-1 transition-shadow hover:shadow-xl hover:shadow-red-900/5 ${
      dep.managerInvalid ? "ring-amber-200" : "ring-gray-100 hover:ring-red-100"
    }`}
  >
    <div className={`h-1.5 bg-gradient-to-r ${colorFor(dep.dep_name)}`} />
    <div className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${colorFor(dep.dep_name)} text-sm font-bold text-white shadow-md`}>
            {initials(dep.dep_name)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-gray-900 transition-colors group-hover:text-red-600">{dep.dep_name}</p>
            <p className="font-mono text-[11px] text-gray-400">#{String(dep.sno).padStart(2, "0")}</p>
          </div>
        </div>
        <MembersPill count={dep.memberCount} />
      </div>

      <div className="mt-4 rounded-2xl bg-gray-50/80 p-3">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Manager</p>
        <ManagerCell dep={dep} compact />
      </div>

      {typeof dep.memberCount === "number" && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-rose-400 transition-all duration-700" style={{ width: `${(dep.memberCount / maxMembers) * 100}%` }} />
        </div>
      )}

      <div className="mt-4 flex justify-end border-t border-gray-100 pt-3">
        <DepartmentButtons id={dep._id} onDepartmentDelete={fetchDepartments} />
      </div>
    </div>
  </motion.div>
);

export default DepartmentList;