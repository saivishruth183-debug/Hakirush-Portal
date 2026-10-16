import axios from "axios";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { EmployeeButtons } from "../../utils/EmployeeHelper";
import {
  Search, UserPlus, Users, ChevronLeft, ChevronRight, ChevronDown, Building2, UserX, UserCheck,
  X, ArrowUpDown, RefreshCw, LayoutGrid, List as ListIcon, Download, AlertTriangle, Briefcase,
} from "lucide-react";

const PAGE_BG = "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const PAGE_SIZE_OPTIONS = [5, 10, 15, 20];

const SORTS = [
  { key: "id", label: "Employee ID" },
  { key: "name-asc", label: "Name A–Z" },
  { key: "name-desc", label: "Name Z–A" },
  { key: "dept", label: "Department" },
  { key: "role", label: "Designation" },
];

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

const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith("http")) return imagePath;
  return `${import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "")}/${imagePath.replace(/^\//, "")}`;
};

/* ================= SMALL PIECES ================= */
const Avatar = ({ emp, size = "h-11 w-11", text = "text-sm" }) => {
  const [broken, setBroken] = useState(false);
  const src = getImageUrl(emp.profileImage);
  const inactive = emp.isActive === false;
  return (
    <span className="relative shrink-0">
      {src && !broken ? (
        <img src={src} alt="" onError={() => setBroken(true)} className={`${size} rounded-2xl object-cover shadow-sm ${inactive ? "grayscale" : ""}`} />
      ) : (
        <span className={`${size} ${text} flex items-center justify-center rounded-2xl bg-gradient-to-br font-bold text-white shadow-md ${inactive ? "from-gray-300 to-gray-400" : colorFor(emp.name)}`}>
          {initials(emp.name)}
        </span>
      )}
      {typeof emp.isActive === "boolean" && (
        <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-white ${inactive ? "bg-gray-400" : "bg-emerald-500"}`} />
      )}
    </span>
  );
};

const StatusPill = ({ isActive }) => {
  if (typeof isActive !== "boolean") return null;
  return isActive ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-500">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" /> Inactive
    </span>
  );
};

const DeptPill = ({ name }) =>
  name && name !== "N/A" ? (
    <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">
      <Building2 size={11} className="shrink-0" /> <span className="truncate">{name}</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-400">No department</span>
  );

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

const Skeleton = ({ className = "" }) => <div className={`animate-pulse rounded-2xl bg-gray-100 ${className}`} />;

/* ================= PAGE ================= */
const List = () => {
  const [employees, setEmployees] = useState([]);
  const [empLoading, setEmpLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "active" | "inactive"
  const [deptFilter, setDeptFilter] = useState("all");
  const [sort, setSort] = useState("id");
  const [view, setView] = useState("list");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  const fetchEmployees = useCallback(async () => {
    setEmpLoading(true);
    try {
      const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/employee`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      if (response.data.success) {
        const sortedEmployees = [...response.data.employees].sort((a, b) => {
          const idA = a.employeeId ?? "";
          const idB = b.employeeId ?? "";
          return !isNaN(idA) && !isNaN(idB) ? Number(idA) - Number(idB) : String(idA).localeCompare(String(idB));
        });

        let sno = 1;
        const data = sortedEmployees.map((emp) => {
          // isActive may be on the employee (admin list) or on the populated user
          const rawActive = emp.isActive ?? emp.userId?.isActive;
          return {
            _id: emp._id,
            sno: sno++,
            employeeId: emp.employeeId || "N/A",
            dep_name: emp.department?.dep_name || "N/A",
            designation: emp.designation || "N/A",
            name: emp.userId?.name || "Unknown",
            dob: emp.dob ? new Date(emp.dob).toDateString() : "N/A",
            profileImage: emp.userId?.profileImage || "",
            isActive: typeof rawActive === "boolean" ? rawActive : undefined,
          };
        });

        setEmployees(data);
        setLoadError("");
      } else {
        setLoadError("Failed to load employees.");
      }
    } catch (err) {
      console.error("Failed to load employees");
      setLoadError(err?.response?.data?.error || err?.response?.data?.message || "Failed to load employees. Check your connection and try again.");
    } finally {
      setEmpLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  /* ---------- derived ---------- */
  const departments = useMemo(() => {
    const counts = {};
    employees.forEach((e) => {
      if (e.dep_name && e.dep_name !== "N/A") counts[e.dep_name] = (counts[e.dep_name] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
  }, [employees]);
  const unassignedCount = useMemo(() => employees.filter((e) => e.dep_name === "N/A").length, [employees]);

  const statusCounts = useMemo(
    () => ({
      all: employees.length,
      active: employees.filter((e) => e.isActive !== false).length,
      inactive: employees.filter((e) => e.isActive === false).length,
    }),
    [employees]
  );

  // Only show status UI if the API actually returns isActive
  const hasStatusData = useMemo(() => employees.some((e) => typeof e.isActive === "boolean"), [employees]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = employees.filter((emp) => {
      const matchesSearch =
        !q || [emp.name, emp.employeeId, emp.designation, emp.dep_name].some((v) => (v || "").toLowerCase().includes(q));
      const matchesStatus =
        statusFilter === "all" || (statusFilter === "active" ? emp.isActive !== false : emp.isActive === false);
      const matchesDept =
        deptFilter === "all" || (deptFilter === "__none" ? emp.dep_name === "N/A" : emp.dep_name === deptFilter);
      return matchesSearch && matchesStatus && matchesDept;
    });
    const by = {
      "name-asc": (a, b) => a.name.localeCompare(b.name),
      "name-desc": (a, b) => b.name.localeCompare(a.name),
      dept: (a, b) => (a.dep_name === "N/A" ? "~" : a.dep_name).localeCompare(b.dep_name === "N/A" ? "~" : b.dep_name),
      role: (a, b) => (a.designation === "N/A" ? "~" : a.designation).localeCompare(b.designation === "N/A" ? "~" : b.designation),
    }[sort];
    return by ? [...list].sort(by) : list; // "id" keeps the API order sorted by employee ID
  }, [employees, search, statusFilter, deptFilter, sort]);

  useEffect(() => setCurrentPage(1), [search, statusFilter, deptFilter, sort, itemsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const paginatedEmployees = filteredEmployees.slice(startIndex, startIndex + itemsPerPage);
  const showingFrom = filteredEmployees.length ? startIndex + 1 : 0;
  const showingTo = Math.min(startIndex + itemsPerPage, filteredEmployees.length);

  const pageNumbers = useMemo(() => {
    const pages = [];
    for (let p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || Math.abs(p - safePage) <= 1) pages.push(p);
      else if (pages[pages.length - 1] !== "…") pages.push("…");
    }
    return pages;
  }, [totalPages, safePage]);

  const isFiltered = !!search || statusFilter !== "all" || deptFilter !== "all";
  const clearAll = () => { setSearch(""); setStatusFilter("all"); setDeptFilter("all"); };

  const exportCSV = () => {
    const rows = [
      ["#", "Employee ID", "Name", "Designation", "Department", "Status"],
      ...filteredEmployees.map((e, i) => [
        i + 1, e.employeeId, e.name, e.designation, e.dep_name,
        typeof e.isActive === "boolean" ? (e.isActive ? "Active" : "Inactive") : "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `Employees_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const selectCls =
    "w-full cursor-pointer appearance-none rounded-2xl bg-gray-50 py-3 pl-9 pr-9 text-sm font-semibold text-gray-700 ring-1 ring-gray-200 focus:outline-none focus:ring-2 focus:ring-red-300";

  return (
    <div className={`min-h-screen pb-20 font-sans text-gray-700 ${PAGE_BG}`}>
      <div className="mx-auto max-w-[1300px] space-y-6 p-4 sm:p-8">
        {/* ================= HEADER ================= */}
        <motion.header
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
          className="flex flex-col gap-5 pt-2 sm:flex-row sm:items-end sm:justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/30">
              <Users size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">People</p>
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
                Employee <span className="text-red-600">Directory</span>
              </h1>
              <p className="mt-0.5 text-sm text-gray-500">Everyone in the organisation, searchable by name, ID or team.</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={fetchEmployees}
              disabled={empLoading}
              aria-label="Refresh"
              title="Refresh"
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-gray-500 shadow-sm ring-1 ring-red-100 transition hover:text-red-600 disabled:opacity-60"
            >
              <RefreshCw size={17} className={empLoading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={exportCSV}
              disabled={empLoading || !filteredEmployees.length}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-gray-700 shadow-sm ring-1 ring-red-100 transition hover:text-red-600 hover:ring-red-200 disabled:opacity-50"
            >
              <Download size={16} /> <span className="hidden sm:inline">Export</span>
            </button>
            <Link
              to="/admin-dashboard/add-employee"
              className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98]"
            >
              <UserPlus size={17} /> Add employee
            </Link>
          </div>
        </motion.header>

        {/* ================= STATS ================= */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard i={0} icon={Users} label="Total employees" value={empLoading ? "–" : statusCounts.all}
            tone={{ bg: "bg-red-50", text: "text-red-600" }} active={statusFilter === "all" && deptFilter === "all"}
            onClick={() => { setStatusFilter("all"); setDeptFilter("all"); }} />
          {hasStatusData ? (
            <>
              <StatCard i={1} icon={UserCheck} label="Active" value={empLoading ? "–" : statusCounts.active}
                tone={{ bg: "bg-emerald-50", text: "text-emerald-600" }} active={statusFilter === "active"} onClick={() => setStatusFilter("active")} />
              <StatCard i={2} icon={UserX} label="Inactive" value={empLoading ? "–" : statusCounts.inactive}
                tone={{ bg: "bg-slate-100", text: "text-slate-600" }} active={statusFilter === "inactive"} onClick={() => setStatusFilter("inactive")} />
            </>
          ) : (
            <>
              <StatCard i={1} icon={Briefcase} label="Designations"
                value={empLoading ? "–" : new Set(employees.map((e) => e.designation).filter((d) => d && d !== "N/A")).size}
                tone={{ bg: "bg-emerald-50", text: "text-emerald-600" }} />
              <StatCard i={2} icon={UserX} label="Without a department" value={empLoading ? "–" : unassignedCount}
                tone={{ bg: "bg-slate-100", text: "text-slate-600" }} active={deptFilter === "__none"}
                onClick={unassignedCount ? () => setDeptFilter("__none") : undefined} />
            </>
          )}
          <StatCard i={3} icon={Building2} label="Departments" value={empLoading ? "–" : departments.length}
            tone={{ bg: "bg-sky-50", text: "text-sky-600" }} />
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
                  placeholder="Search by name, employee ID, designation or department…"
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

              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                {/* department */}
                <div className="relative sm:w-48">
                  <Building2 size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} aria-label="Filter by department" className={selectCls}>
                    <option value="all">All departments</option>
                    {departments.map(([d, n]) => <option key={d} value={d}>{d} ({n})</option>)}
                    {unassignedCount > 0 && <option value="__none">No department ({unassignedCount})</option>}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>

                {/* sort */}
                <div className="relative sm:w-44">
                  <ArrowUpDown size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort" className={selectCls}>
                    {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>

                {/* view toggle */}
                <div className="hidden rounded-2xl bg-gray-50 p-1 ring-1 ring-gray-200 md:flex">
                  {[["list", ListIcon], ["grid", LayoutGrid]].map(([v, Icon]) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      aria-label={`${v} view`}
                      className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${view === v ? "bg-white text-red-600 shadow-sm" : "text-gray-400 hover:text-gray-700"}`}
                    >
                      <Icon size={16} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* status chips */}
            {(hasStatusData || isFiltered) && (
              <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                {hasStatusData &&
                  [["all", "Everyone"], ["active", "Active"], ["inactive", "Inactive"]].map(([key, label]) => {
                    const on = statusFilter === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setStatusFilter(key)}
                        className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                          on ? "text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:text-red-600 hover:ring-red-200"
                        }`}
                      >
                        {on && (
                          <motion.span layoutId="emp-status" className="absolute inset-0 rounded-full bg-gradient-to-r from-red-600 to-rose-500 shadow-md shadow-red-600/25"
                            transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                        )}
                        <span className="relative">{label}</span>
                        <span className={`relative rounded-full px-1.5 text-[10px] ${on ? "bg-white/25" : "bg-gray-100 text-gray-400"}`}>{statusCounts[key]}</span>
                      </button>
                    );
                  })}
                {isFiltered && (
                  <>
                    <span className="ml-auto shrink-0 text-xs text-gray-400">{filteredEmployees.length} found</span>
                    <button onClick={clearAll} className="shrink-0 text-xs font-semibold text-red-600 hover:underline">Clear</button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* body */}
          {empLoading ? (
            <div className="space-y-3 p-4 sm:p-5">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-4 rounded-2xl p-3 ring-1 ring-gray-100">
                  <Skeleton className="h-11 w-11" />
                  <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-1/5" /></div>
                  <Skeleton className="hidden h-7 w-36 md:block" />
                  <Skeleton className="h-8 w-28" />
                </div>
              ))}
            </div>
          ) : loadError && !employees.length ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-50 text-amber-500"><AlertTriangle size={26} /></div>
              <p className="font-bold text-gray-800">Couldn't load employees</p>
              <p className="max-w-sm text-sm text-gray-500">{loadError}</p>
              <button onClick={fetchEmployees} className="mt-1 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50">
                <RefreshCw size={14} /> Try again
              </button>
            </div>
          ) : paginatedEmployees.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-red-50 text-red-400"><UserX size={26} /></div>
              <p className="font-bold text-gray-800">{employees.length ? "No one matches" : "No employees yet"}</p>
              <p className="max-w-sm text-sm text-gray-500">
                {employees.length ? "Try a different name, ID, department or status." : "Add your first team member to get started."}
              </p>
              {employees.length ? (
                <button onClick={clearAll} className="mt-1 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-red-600 ring-1 ring-red-200 hover:bg-red-50">
                  Clear search & filters
                </button>
              ) : (
                <Link to="/admin-dashboard/add-employee" className="mt-1 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-red-600/25">
                  <UserPlus size={15} /> Add employee
                </Link>
              )}
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {paginatedEmployees.map((emp, i) => (
                  <EmployeeCard key={emp._id} emp={emp} i={i} refresh={fetchEmployees} />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <>
              {/* ---------- MOBILE CARDS ---------- */}
              <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 md:hidden">
                {paginatedEmployees.map((emp, i) => (
                  <EmployeeCard key={emp._id} emp={emp} i={i} refresh={fetchEmployees} />
                ))}
              </div>

              {/* ---------- DESKTOP TABLE ----------
                  A real <table>: every column keeps one width for the header and all rows. */}
              <div className="hidden md:block">
                <table className="w-full table-auto border-collapse text-left">
                  <thead>
                    <tr className="bg-gray-50/70 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      <th className="w-12 py-3 pl-4 pr-2 font-bold lg:pl-6">#</th>
                      <th className="px-3 py-3 font-bold">Employee</th>
                      <th className="px-3 py-3 font-bold">Department</th>
                      <th className="w-28 px-3 py-3 font-bold">Status</th>
                      <th className="w-px whitespace-nowrap py-3 pl-3 pr-4 text-right font-bold lg:pr-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    <AnimatePresence initial={false}>
                      {paginatedEmployees.map((emp, i) => (
                        <motion.tr
                          key={emp._id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1, transition: { delay: i * 0.03 } }}
                          exit={{ opacity: 0 }}
                          className={`group align-middle transition-colors hover:bg-red-50/40 ${emp.isActive === false ? "bg-gray-50/50" : ""}`}
                        >
                          <td className="py-3.5 pl-4 pr-2 font-mono text-xs font-bold text-gray-400 lg:pl-6">
                            {String(startIndex + i + 1).padStart(2, "0")}
                          </td>

                          <td className="max-w-0 px-3 py-3.5">
                            <div className="flex min-w-0 items-center gap-3">
                              <Avatar emp={emp} />
                              <div className="min-w-0">
                                <p className={`truncate text-[15px] font-bold transition-colors group-hover:text-red-600 ${emp.isActive === false ? "text-gray-500" : "text-gray-900"}`}>
                                  {emp.name}
                                </p>
                                <p className="flex min-w-0 items-center gap-1.5 text-xs text-gray-500">
                                  <span className="shrink-0 rounded-md bg-gray-100 px-1.5 py-px font-mono text-[10px] font-semibold text-gray-600">{emp.employeeId}</span>
                                  <span className="truncate">{emp.designation !== "N/A" ? emp.designation : "No designation"}</span>
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="max-w-0 px-3 py-3.5">
                            <DeptPill name={emp.dep_name} />
                          </td>

                          <td className="px-3 py-3.5">
                            {typeof emp.isActive === "boolean" ? <StatusPill isActive={emp.isActive} /> : <span className="text-xs text-gray-300">—</span>}
                          </td>

                          <td className="w-px whitespace-nowrap py-3.5 pl-3 pr-4 lg:pr-6">
                            <div className="flex justify-end">
                              <EmployeeButtons id={emp._id} isActive={emp.isActive} refresh={fetchEmployees} />
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ================= PAGINATION ================= */}
          {!empLoading && filteredEmployees.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-red-50 bg-gray-50/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-center text-xs text-gray-500 sm:text-left">
                Showing <b className="text-gray-900">{showingFrom}–{showingTo}</b> of <b className="text-gray-900">{filteredEmployees.length}</b>
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

/* ================= CARD (mobile + grid view) ================= */
const EmployeeCard = ({ emp, i, refresh }) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }}
    exit={{ opacity: 0, scale: 0.97 }}
    whileHover={{ y: -3 }}
    className={`group overflow-hidden rounded-3xl bg-white ring-1 ring-gray-100 transition-shadow hover:shadow-xl hover:shadow-red-900/5 hover:ring-red-100 ${
      emp.isActive === false ? "opacity-80" : ""
    }`}
  >
    <div className={`h-1.5 bg-gradient-to-r ${emp.isActive === false ? "from-gray-200 to-gray-300" : colorFor(emp.name)}`} />
    <div className="p-5">
      <div className="flex items-start gap-3">
        <Avatar emp={emp} size="h-14 w-14" text="text-base" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-gray-900 transition-colors group-hover:text-red-600">{emp.name}</p>
          <p className="truncate text-xs text-gray-500">{emp.designation !== "N/A" ? emp.designation : "No designation"}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-gray-600">{emp.employeeId}</span>
            <StatusPill isActive={emp.isActive} />
          </div>
        </div>
      </div>
      <div className="mt-4 min-w-0"><DeptPill name={emp.dep_name} /></div>
      <div className="mt-4 flex justify-end border-t border-gray-100 pt-3">
        <EmployeeButtons id={emp._id} isActive={emp.isActive} refresh={refresh} />
      </div>
    </div>
  </motion.div>
);

export default List;
