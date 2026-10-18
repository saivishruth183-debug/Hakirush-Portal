import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, ChevronDown, Users, Mail, Briefcase, Star, Search, X, Copy, Check,
  UserCheck, UserX, AlertTriangle, RefreshCw, ArrowUpDown, Download, Pencil, Crown, IdCard,
} from "lucide-react";
import { apiErrorMessage } from "../../utils/apiError";

const PAGE_BG = "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const PAGE_SIZE_OPTIONS = [5, 10, 15, 20];

const idOf = (value) => {
  if (!value) return "";
  if (typeof value === "object") return String(value._id || value.employeeRecordId || "");
  return String(value);
};

const isInactive = (emp) => emp.isActive === false || emp.userId?.isActive === false;
const nameOf = (emp) => emp.userId?.name || "Unnamed";
const empIdOf = (emp) => emp.employeeId || emp.userId?.employeeId || "";

const avatarColors = [
  "from-red-500 to-rose-600",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-violet-500 to-purple-600",
  "from-slate-600 to-slate-800",
];
const colorFor = (s = "") => avatarColors[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % avatarColors.length];
const initials = (s = "") => s.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";

const imageUrl = (p) => {
  if (!p) return null;
  if (p.startsWith("http")) return p;
  const base = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "");
  return `${base}/${p.replace(/^\//, "")}`;
};

const FILTERS = [
  { key: "all", label: "Everyone" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
];
const SORTS = [
  { key: "default", label: "Manager first" },
  { key: "name-asc", label: "Name A–Z" },
  { key: "name-desc", label: "Name Z–A" },
  { key: "role", label: "Designation" },
  { key: "id", label: "Employee ID" },
];

/* ================= SMALL PIECES ================= */
const Avatar = ({ emp, size = "h-10 w-10", text = "text-sm", ring = "" }) => {
  const [broken, setBroken] = useState(false);
  const src = imageUrl(emp.userId?.profileImage || emp.profileImage);
  return src && !broken ? (
    <img src={src} alt="" onError={() => setBroken(true)} className={`${size} shrink-0 rounded-2xl object-cover ${ring} ${isInactive(emp) ? "grayscale" : ""}`} />
  ) : (
    <div className={`${size} ${text} flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br font-bold text-white shadow-md ${ring} ${isInactive(emp) ? "from-gray-300 to-gray-400" : colorFor(nameOf(emp))}`}>
      {initials(nameOf(emp))}
    </div>
  );
};

const ManagerBadge = () => (
  <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm shadow-amber-500/30">
    <Star size={10} fill="currentColor" /> Manager
  </span>
);

const StatusPill = ({ inactive }) =>
  inactive ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-500">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" /> Inactive
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
    </span>
  );

const CopyEmail = ({ email }) => {
  const [copied, setCopied] = useState(false);
  if (!email) return <span className="text-sm text-gray-300">—</span>;
  return (
    <div className="group/mail flex min-w-0 items-center gap-1.5">
      <a href={`mailto:${email}`} className="truncate text-sm text-gray-600 transition hover:text-red-600">
        {email}
      </a>
      <button
        type="button"
        onClick={() => { navigator.clipboard?.writeText(email); setCopied(true); setTimeout(() => setCopied(false), 1400); }}
        aria-label="Copy email"
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${
          copied ? "bg-emerald-50 text-emerald-600" : "text-gray-300 hover:bg-red-50 hover:text-red-600 md:opacity-0 md:group-hover/mail:opacity-100"
        }`}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, tone, i, active, onClick }) => (
  <motion.button
    type="button"
    initial={{ opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.4 } }}
    whileHover={onClick ? { y: -3 } : undefined}
    onClick={onClick}
    disabled={!onClick}
    className={`group relative overflow-hidden rounded-3xl p-5 text-left transition disabled:cursor-default ${
      active ? "bg-white shadow-lg ring-2 ring-red-300" : "bg-white/85 shadow-[0_10px_30px_-14px_rgba(127,29,29,0.18)] ring-1 ring-white/70 backdrop-blur-sm hover:bg-white"
    }`}
  >
    <div className={`pointer-events-none absolute -bottom-6 -right-6 opacity-[0.08] ${tone.text}`}>
      <Icon size={96} strokeWidth={1.5} />
    </div>
    <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tone.bg} ${tone.text}`}>
      <Icon size={18} />
    </div>
    <p className="mt-4 truncate text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">{value}</p>
    <p className="mt-0.5 text-xs font-medium text-gray-500">{label}</p>
  </motion.button>
);

const Skeleton = ({ className = "" }) => <div className={`animate-pulse rounded-2xl bg-gray-100 ${className}`} />;

/* ================= PAGE ================= */
const DepartmentEmployees = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [departmentName, setDepartmentName] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("default");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id || id === ":id") {
      setError("Invalid department ID");
      setLoading(false);
      return;
    }

    const fetchEmployees = async () => {
      try {
        setLoading(true);
        setError("");
        const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };
        const [res, depRes] = await Promise.all([
          axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/employee/department/${id}/employees`, { headers }),
          // Department carries managerEmployeeId; failure here only hides the badge.
          axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/department/${id}`, { headers }).catch(() => null),
        ]);

        if (res.data?.success) {
          const dep = depRes?.data?.department || null;
          const managerId = idOf(dep?.managerEmployeeId) || idOf(dep?.manager?.employeeRecordId);
          setDepartmentName(dep?.dep_name || "");
          const list = (res.data.employees || []).map((emp) => ({
            ...emp,
            isManager: Boolean(emp.isManager) || (managerId !== "" && String(emp._id) === managerId),
          }));
          // Manager first, then the rest in their original order
          list.sort((a, b) => Number(b.isManager) - Number(a.isManager));
          setEmployees(list);
        } else {
          setError("Failed to load employees");
        }
      } catch (err) {
        setError(apiErrorMessage(err, "Connection error occurred"));
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, [id, reloadKey]);

  /* ---------- derived ---------- */
  const manager = employees.find((e) => e.isManager) || null;
  const stats = useMemo(() => {
    const inactive = employees.filter(isInactive).length;
    const roles = new Set(employees.map((e) => (e.designation || "").trim()).filter(Boolean));
    return { total: employees.length, active: employees.length - inactive, inactive, roles: roles.size };
  }, [employees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = employees.filter((e) => {
      if (filter === "active" && isInactive(e)) return false;
      if (filter === "inactive" && !isInactive(e)) return false;
      if (!q) return true;
      return [nameOf(e), e.userId?.email, e.designation, empIdOf(e)].some((v) => (v || "").toLowerCase().includes(q));
    });
    const by = {
      "name-asc": (a, b) => nameOf(a).localeCompare(nameOf(b)),
      "name-desc": (a, b) => nameOf(b).localeCompare(nameOf(a)),
      role: (a, b) => (a.designation || "~").localeCompare(b.designation || "~"),
      id: (a, b) => empIdOf(a).localeCompare(empIdOf(b), undefined, { numeric: true }),
    }[sort];
    return by ? [...list].sort(by) : list;
  }, [employees, search, filter, sort]);

  useEffect(() => setCurrentPage(1), [employees, search, filter, sort, itemsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const paginated = filtered.slice(startIndex, startIndex + itemsPerPage);
  const showingFrom = filtered.length ? startIndex + 1 : 0;
  const showingTo = Math.min(startIndex + itemsPerPage, filtered.length);

  const pageNumbers = useMemo(() => {
    const pages = [];
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || Math.abs(p - safePage) <= 1) pages.push(p);
      else if (pages[pages.length - 1] !== "…") pages.push("…");
    }
    return pages;
  }, [totalPages, safePage]);

  const clearAll = () => { setSearch(""); setFilter("all"); };

  const exportCSV = () => {
    const rows = [
      ["#", "Employee ID", "Name", "Email", "Designation", "Role", "Status"],
      ...filtered.map((e, i) => [i + 1, empIdOf(e), nameOf(e), e.userId?.email || "", e.designation || "", e.isManager ? "Manager" : "Member", isInactive(e) ? "Inactive" : "Active"]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(departmentName || "department").replace(/\s+/g, "_")}_team.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const editDepartment = () => navigate(`/admin-dashboard/department/${id}`);

  return (
    <div className={`min-h-screen pb-20 font-sans text-gray-700 ${PAGE_BG}`}>
      <div className="mx-auto max-w-[1200px] space-y-6 p-4 sm:p-8">
        {/* ================= TOP ROW ================= */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex items-center justify-between gap-3 pt-2">
          <button
            onClick={() => navigate(-1)}
            className="group inline-flex items-center gap-2 rounded-2xl bg-white/80 px-3.5 py-2.5 text-sm font-semibold text-gray-600 shadow-sm ring-1 ring-red-100 transition hover:text-red-600 hover:ring-red-200"
          >
            <ChevronLeft size={17} className="transition-transform group-hover:-translate-x-0.5" />
            Back to departments
          </button>
          <span className="hidden items-center gap-1.5 text-xs font-medium text-gray-400 sm:flex">
            Departments <ChevronRight size={12} />
            <span className="max-w-[200px] truncate font-semibold text-red-600">{departmentName || "Team"}</span>
          </span>
        </motion.div>

        {/* ================= HEADER ================= */}
        <motion.header
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }}
          className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"
        >
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/30">
              <Users size={24} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">Team roster</p>
              <h1 className="truncate text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
                {departmentName || "Department"} <span className="text-red-600">team</span>
              </h1>
              <p className="mt-0.5 text-sm text-gray-500">Everyone currently assigned to this department.</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              disabled={loading}
              aria-label="Refresh"
              title="Refresh"
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-gray-500 shadow-sm ring-1 ring-red-100 transition hover:text-red-600 disabled:opacity-60"
            >
              <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={exportCSV}
              disabled={loading || !filtered.length}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-gray-700 shadow-sm ring-1 ring-red-100 transition hover:text-red-600 hover:ring-red-200 disabled:opacity-50"
            >
              <Download size={16} /> <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={editDepartment}
              className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98]"
            >
              <Pencil size={16} /> <span className="hidden sm:inline">Edit department</span>
            </button>
          </div>
        </motion.header>

        {/* ================= MANAGER + STATS ================= */}
        {!loading && !error && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* manager spotlight */}
            <motion.div
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.08 }}
              className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 p-5 text-white shadow-[0_20px_50px_-15px_rgba(220,38,38,0.45)] lg:col-span-5"
            >
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-14 left-10 h-36 w-36 rounded-full bg-orange-300/25 blur-2xl" />
              <p className="relative mb-4 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
                <Crown size={13} /> Department manager
              </p>
              {manager ? (
                <div className="relative flex items-center gap-4">
                  <span className="rounded-[1.1rem] bg-white/30 p-[3px]">
                    <Avatar emp={manager} size="h-16 w-16" text="text-xl" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xl font-extrabold leading-tight">{nameOf(manager)}</p>
                    <p className="truncate text-sm text-white/85">{manager.designation || "Manager"}</p>
                    {manager.userId?.email && (
                      <a href={`mailto:${manager.userId.email}`} className="mt-1.5 inline-flex max-w-full items-center gap-1.5 truncate rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold backdrop-blur transition hover:bg-white/30">
                        <Mail size={11} /> <span className="truncate">{manager.userId.email}</span>
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="relative flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
                      <UserX size={24} />
                    </span>
                    <div>
                      <p className="text-lg font-extrabold">No manager yet</p>
                      <p className="text-sm text-white/80">
                        {employees.length ? "Pick one of this team's members." : "Add employees first, then choose one."}
                      </p>
                    </div>
                  </div>
                  {employees.length > 0 && (
                    <button onClick={editDepartment} className="shrink-0 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-red-600 shadow-md transition hover:-translate-y-0.5">
                      Assign
                    </button>
                  )}
                </div>
              )}
            </motion.div>

            {/* stats */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 lg:col-span-7">
              <StatCard i={0} icon={Users} label="Team members" value={stats.total} tone={{ bg: "bg-red-50", text: "text-red-600" }}
                active={filter === "all"} onClick={() => setFilter("all")} />
              <StatCard i={1} icon={UserCheck} label="Active" value={stats.active} tone={{ bg: "bg-emerald-50", text: "text-emerald-600" }}
                active={filter === "active"} onClick={() => setFilter("active")} />
              <StatCard i={2} icon={UserX} label="Inactive" value={stats.inactive} tone={{ bg: "bg-slate-100", text: "text-slate-600" }}
                active={filter === "inactive"} onClick={() => setFilter("inactive")} />
            </div>
          </div>
        )}

        {/* ================= BOARD ================= */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.45 }}
          className="overflow-hidden rounded-3xl bg-white/90 shadow-[0_20px_50px_-20px_rgba(127,29,29,0.22)] ring-1 ring-white/70 backdrop-blur-sm"
        >
          {/* toolbar */}
          {!error && (
            <div className="space-y-3 border-b border-red-50 p-4 sm:p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <label className="relative flex-1">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name, email, designation or ID…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-2xl bg-gray-50 py-3 pl-11 pr-10 text-sm font-medium text-gray-900 ring-1 ring-gray-200 transition placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-300"
                  />
                  {search && (
                    <button onClick={() => setSearch("")} aria-label="Clear search"
                      className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-red-100 hover:text-red-600">
                      <X size={13} />
                    </button>
                  )}
                </label>
                <div className="relative">
                  <ArrowUpDown size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    className="w-full cursor-pointer appearance-none rounded-2xl bg-gray-50 py-3 pl-9 pr-9 text-sm font-semibold text-gray-700 ring-1 ring-gray-200 focus:outline-none focus:ring-2 focus:ring-red-300 md:w-auto"
                  >
                    {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                {FILTERS.map((f) => {
                  const count = f.key === "all" ? stats.total : f.key === "active" ? stats.active : stats.inactive;
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
                        <motion.span layoutId="roster-filter" className="absolute inset-0 rounded-full bg-gradient-to-r from-red-600 to-rose-500 shadow-md shadow-red-600/25"
                          transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                      )}
                      <span className="relative">{f.label}</span>
                      <span className={`relative rounded-full px-1.5 text-[10px] ${on ? "bg-white/25" : "bg-gray-100 text-gray-400"}`}>{count}</span>
                    </button>
                  );
                })}
                {(search || filter !== "all") && (
                  <button onClick={clearAll} className="ml-auto shrink-0 text-xs font-semibold text-red-600 hover:underline">Clear</button>
                )}
              </div>
            </div>
          )}

          {/* body */}
          {loading ? (
            <div className="space-y-3 p-4 sm:p-5">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4 rounded-2xl p-3 ring-1 ring-gray-100">
                  <Skeleton className="h-11 w-11" />
                  <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-1/4" /></div>
                  <Skeleton className="hidden h-7 w-48 md:block" />
                  <Skeleton className="h-7 w-24" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-50 text-amber-500"><AlertTriangle size={26} /></div>
              <p className="font-bold text-gray-800">Couldn't load this team</p>
              <p className="max-w-sm text-sm text-gray-500">{error}</p>
              <div className="mt-1 flex gap-2">
                <button onClick={() => navigate(-1)} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50">Go back</button>
                <button onClick={() => setReloadKey((k) => k + 1)} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50">
                  <RefreshCw size={14} /> Try again
                </button>
              </div>
            </div>
          ) : paginated.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-red-50 text-red-400"><Users size={26} /></div>
              <p className="font-bold text-gray-800">{employees.length ? "No one matches" : "No team members yet"}</p>
              <p className="max-w-sm text-sm text-gray-500">
                {employees.length ? "Try a different search or filter." : "Assign employees to this department from the Employees page."}
              </p>
              {employees.length > 0 && (
                <button onClick={clearAll} className="mt-1 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50">
                  Clear search & filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* ---------- MOBILE CARDS ---------- */}
              <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 md:hidden">
                {paginated.map((emp, i) => (
                  <motion.div
                    key={emp._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }}
                    className={`overflow-hidden rounded-3xl bg-white ring-1 ${emp.isManager ? "ring-amber-200" : "ring-gray-100"} ${isInactive(emp) ? "opacity-75" : ""}`}
                  >
                    <div className={`h-1.5 bg-gradient-to-r ${emp.isManager ? "from-amber-400 to-orange-400" : isInactive(emp) ? "from-gray-200 to-gray-300" : colorFor(nameOf(emp))}`} />
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <Avatar emp={emp} size="h-12 w-12" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-bold text-gray-900">{nameOf(emp)}</p>
                          <p className="truncate text-xs text-gray-500">{emp.designation || "Staff"}</p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {emp.isManager && <ManagerBadge />}
                            <StatusPill inactive={isInactive(emp)} />
                          </div>
                        </div>
                        <span className="font-mono text-[11px] font-bold text-gray-300">#{String(startIndex + i + 1).padStart(2, "0")}</span>
                      </div>
                      <div className="mt-3 space-y-2 rounded-2xl bg-gray-50/80 p-3">
                        <div className="flex items-center gap-2">
                          <Mail size={13} className="shrink-0 text-red-500" />
                          <CopyEmail email={emp.userId?.email} />
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <IdCard size={13} className="shrink-0 text-red-500" />
                          <span className="font-mono text-xs">{empIdOf(emp) || "No ID"}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* ---------- DESKTOP TABLE ---------- */}
              <div className="hidden md:block">
                <div className="grid grid-cols-[56px_minmax(0,1.4fr)_120px_minmax(0,1.4fr)_minmax(0,1fr)_110px] items-center gap-3 bg-gray-50/70 px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  <span>#</span>
                  <span>Employee</span>
                  <span>Emp ID</span>
                  <span>Email</span>
                  <span>Designation</span>
                  <span className="text-right">Status</span>
                </div>
                <div className="divide-y divide-gray-100">
                  <AnimatePresence initial={false}>
                    {paginated.map((emp, i) => (
                      <motion.div
                        key={emp._id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0, transition: { delay: i * 0.03 } }}
                        exit={{ opacity: 0 }}
                        className={`group grid grid-cols-[56px_minmax(0,1.4fr)_120px_minmax(0,1.4fr)_minmax(0,1fr)_110px] items-center gap-3 px-6 py-3.5 transition-colors hover:bg-red-50/40 ${
                          emp.isManager ? "bg-amber-50/40" : ""
                        } ${isInactive(emp) ? "text-gray-400" : ""}`}
                      >
                        <span className="font-mono text-xs font-bold text-gray-400">{String(startIndex + i + 1).padStart(2, "0")}</span>

                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar emp={emp} ring={emp.isManager ? "ring-2 ring-amber-300 ring-offset-2" : ""} />
                          <div className="min-w-0">
                            <p className={`truncate text-[15px] font-bold transition-colors group-hover:text-red-600 ${isInactive(emp) ? "text-gray-500" : "text-gray-900"}`}>
                              {nameOf(emp)}
                            </p>
                            {emp.isManager && <div className="mt-0.5"><ManagerBadge /></div>}
                          </div>
                        </div>

                        <span className="w-fit rounded-lg bg-gray-100 px-2 py-1 font-mono text-[11px] font-semibold text-gray-600">
                          {empIdOf(emp) || "N/A"}
                        </span>

                        <CopyEmail email={emp.userId?.email} />

                        <span className="inline-flex w-fit max-w-full items-center gap-1.5 truncate rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                          <Briefcase size={11} className="shrink-0" /> <span className="truncate">{emp.designation || "—"}</span>
                        </span>

                        <div className="flex justify-end">
                          <StatusPill inactive={isInactive(emp)} />
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </>
          )}

          {/* ================= PAGINATION ================= */}
          {!loading && !error && filtered.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-red-50 bg-gray-50/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-center text-xs text-gray-500 sm:text-left">
                Showing <b className="text-gray-900">{showingFrom}–{showingTo}</b> of <b className="text-gray-900">{filtered.length}</b>
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
                  {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size} per page</option>)}
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

export default DepartmentEmployees;