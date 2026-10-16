import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, FileText, ChevronLeft, ChevronRight, Save, Loader2, CheckCircle2, AlertCircle,
  UserCog, RefreshCw, Search, Star, UserX, AlertTriangle, Users, X, Undo2, ArrowRight, Clock,
} from "lucide-react";
import { apiErrorCode, apiErrorMessage } from "../../utils/apiError";

const PAGE_BG = "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const NAME_MAX = 60;
const DESC_MAX = 500;

// managerEmployeeId may arrive as an id string or a populated document
const idOf = (value) => {
  if (!value) return "";
  if (typeof value === "object") return String(value._id || value.employeeRecordId || "");
  return String(value);
};

const managerLabel = (m) =>
  [m?.name || "Unnamed employee", m?.employeeCode, m?.designation].filter(Boolean).join(" · ");

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

const timeAgo = (d) => {
  if (!d) return "";
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (isNaN(s)) return "";
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 2592000) return `${Math.floor(s / 86400)} days ago`;
  return new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
};

/* ================= SUCCESS MODAL ================= */
const SuccessAlert = ({ name, onDone, onViewTeam }) => {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onDone();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center font-sans sm:items-center sm:p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        className="relative w-full max-w-sm overflow-hidden rounded-t-[2rem] bg-white shadow-[0_40px_90px_-20px_rgba(127,29,29,0.45)] ring-1 ring-red-100 sm:rounded-[2rem]"
      >
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />
        <div className="px-7 pb-2 pt-8 text-center">
          <motion.span
            initial={{ scale: 0.5, rotate: -15, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.08 }}
            className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center"
          >
            <span className="absolute inset-0 animate-ping rounded-3xl bg-emerald-400 opacity-20 [animation-duration:2s]" />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/35">
              <CheckCircle2 size={30} />
            </span>
          </motion.span>
          <h3 className="text-xl font-extrabold tracking-tight text-gray-900">Changes saved</h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            <b className="text-gray-900">{name}</b> is up to date.
          </p>
        </div>
        <div className="space-y-2.5 p-7 pt-5">
          <button
            onClick={onDone}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:-translate-y-0.5 active:scale-[0.98]"
          >
            Back to departments <ArrowRight size={16} />
          </button>
          <button
            onClick={onViewTeam}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-50 py-3.5 text-sm font-bold text-gray-600 ring-1 ring-gray-200 transition hover:bg-white hover:text-gray-900 active:scale-[0.98]"
          >
            <Users size={16} /> View team
          </button>
        </div>
      </motion.div>
    </div>
  );
};

/* ================= FIELD SHELL ================= */
const Field = ({ label, hint, count, max, error, changed, children }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between gap-3">
      <label className="flex items-center gap-2 text-sm font-bold text-gray-900">
        {label}
        {changed && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">Edited</span>}
      </label>
      {hint && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-600">{hint}</span>}
    </div>
    {children}
    <div className="flex min-h-[16px] items-center justify-between gap-3 text-[11px]">
      {error ? (
        <span className="flex items-center gap-1 font-semibold text-red-600"><AlertCircle size={12} /> {error}</span>
      ) : <span />}
      {typeof count === "number" && (
        <span className={`ml-auto tabular-nums font-medium ${count > max * 0.9 ? "text-amber-600" : "text-gray-400"}`}>{count}/{max}</span>
      )}
    </div>
  </div>
);

/* ================= MANAGER OPTION ================= */
const ManagerOption = ({ selected, onClick, title, subtitle, badge, tone = "default", avatarText, icon: Icon }) => (
  <button
    type="button"
    onClick={onClick}
    role="radio"
    aria-checked={selected}
    className={`group flex w-full min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors ${
      selected
        ? "border-red-300 bg-red-50"
        : tone === "warning"
        ? "border-amber-200 bg-amber-50/60 hover:border-amber-300"
        : "border-gray-200 bg-white hover:border-red-200 hover:bg-red-50/40"
    }`}
  >
    {Icon ? (
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone === "warning" ? "bg-amber-100 text-amber-600" : "bg-gray-100 text-gray-400"}`}>
        <Icon size={15} />
      </span>
    ) : (
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-[11px] font-bold text-white ${colorFor(avatarText)}`}>
        {initials(avatarText)}
      </span>
    )}
    <span className="min-w-0 flex-1">
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-[13px] font-semibold text-gray-900">{title}</span>
        {badge}
      </span>
      {subtitle && <span className="block truncate text-[11px] text-gray-500">{subtitle}</span>}
    </span>
    <span
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
        selected ? "border-red-500 bg-red-500" : "border-gray-300 bg-white group-hover:border-red-300"
      }`}
    >
      {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
    </span>
  </button>
);

const Skeleton = ({ className = "" }) => <div className={`animate-pulse rounded-2xl bg-gray-100 ${className}`} />;

/* ================= EDIT DEPARTMENT COMPONENT ================= */
const EditDepartment = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [department, setDepartment] = useState({ dep_name: "", description: "" });
  const [original, setOriginal] = useState({ dep_name: "", description: "" });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [touched, setTouched] = useState({ dep_name: false, description: false });
  const [mgrSearch, setMgrSearch] = useState("");

  // Manager assignment (admin only - this route lives under /admin-dashboard)
  const [originalManagerId, setOriginalManagerId] = useState("");
  const [managerId, setManagerId] = useState("");
  const [currentManager, setCurrentManager] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [eligible, setEligible] = useState([]);
  const [eligibleState, setEligibleState] = useState({ loading: true, error: "" });

  const fetchDepartment = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };
      const [depRes, eligibleRes] = await Promise.allSettled([
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/department/${id}`, { headers }),
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/department/${id}/eligible-managers`, { headers }),
      ]);

      if (depRes.status === "fulfilled" && depRes.value.data?.success) {
        const dep = depRes.value.data.department || {};
        const mgrId = idOf(dep.managerEmployeeId) || idOf(dep.manager?.employeeRecordId);
        const values = { dep_name: dep.dep_name || "", description: dep.description || "" };
        setDepartment(values);
        setOriginal(values);
        setOriginalManagerId(mgrId);
        setManagerId(mgrId);
        setCurrentManager(dep.manager || null);
        setUpdatedAt(dep.updatedAt || null);
        setError("");
      } else {
        setError(
          depRes.status === "rejected"
            ? apiErrorMessage(depRes.reason, "Failed to load department data")
            : "Failed to load department data"
        );
      }

      if (eligibleRes.status === "fulfilled") {
        const list = eligibleRes.value.data?.employees;
        setEligible(Array.isArray(list) ? list : []);
        setEligibleState({ loading: false, error: "" });
      } else {
        setEligible([]);
        setEligibleState({ loading: false, error: apiErrorMessage(eligibleRes.reason, "Couldn't load eligible managers") });
      }
    } finally {
      setFetching(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDepartment();
  }, [fetchDepartment]);

  const reload = () => {
    setStale(false);
    setError("");
    setFetching(true);
    setTouched({ dep_name: false, description: false });
    setEligibleState({ loading: true, error: "" });
    fetchDepartment();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const max = name === "dep_name" ? NAME_MAX : DESC_MAX;
    setDepartment((prev) => ({ ...prev, [name]: value.slice(0, Math.max(max, original[name]?.length || 0)) }));
  };

  const handleBlur = (e) => setTouched((t) => ({ ...t, [e.target.name]: true }));

  /* ---------- derived ---------- */
  const name = department.dep_name.trim();
  const desc = department.description.trim();
  const nameChanged = department.dep_name !== original.dep_name;
  const descChanged = department.description !== original.description;
  const managerChanged = managerId !== originalManagerId;
  const changeCount = [nameChanged, descChanged, managerChanged].filter(Boolean).length;
  const isDirty = changeCount > 0;
  const nameError = touched.dep_name && !name ? "Please enter a department name." : "";
  const descError = touched.description && !desc ? "Please add a short description." : "";
  const isValid = !!name && !!desc;

  const currentInEligible = eligible.some((m) => String(m.employeeRecordId) === originalManagerId);
  const filteredEligible = useMemo(() => {
    const q = mgrSearch.trim().toLowerCase();
    if (!q) return eligible;
    return eligible.filter((m) => [m.name, m.employeeCode, m.designation].some((v) => (v || "").toLowerCase().includes(q)));
  }, [eligible, mgrSearch]);

  const findManager = (mid) =>
    !mid ? null : eligible.find((m) => String(m.employeeRecordId) === mid) || (mid === originalManagerId ? currentManager : null);
  const selectedManager = findManager(managerId);
  const previousManager = findManager(originalManagerId);

  /* ---------- submit ---------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ dep_name: true, description: true });
    if (loading || !isValid) return;
    setLoading(true);
    setError("");
    setStale(false);
    try {
      const payload = { dep_name: department.dep_name.trim(), description: department.description };
      // Only send the manager when the admin changed it ("" -> null clears it).
      if (managerId !== originalManagerId) payload.managerEmployeeId = managerId || null;
      if (updatedAt) payload.expectedUpdatedAt = updatedAt;

      const response = await axios.put(`${import.meta.env.VITE_BACKEND_URL}/api/department/${id}`, payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (response.data.success) setShowAlert(true);
    } catch (err) {
      const code = apiErrorCode(err);
      if (code === "STALE_UPDATE") {
        setStale(true);
        setError(
          apiErrorMessage(err, "This department was changed by someone else.") +
            " Reload to see the latest version before saving again."
        );
      } else {
        const details = err.response?.data?.details;
        const detailText =
          details && typeof details === "object" && !Array.isArray(details)
            ? Object.values(details).filter((v) => typeof v === "string").join(" ")
            : "";
        setError([apiErrorMessage(err, "Update failed"), detailText].filter(Boolean).join(" "));
      }
      console.error("Update Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const resetChanges = () => {
    setDepartment(original);
    setManagerId(originalManagerId);
    setTouched({ dep_name: false, description: false });
  };

  const goBack = () => {
    if (isDirty && !showAlert && !window.confirm("You have unsaved changes. Leave without saving?")) return;
    navigate(-1);
  };

  const inputShell = (hasError) =>
    `group flex rounded-2xl bg-gray-50 ring-1 transition focus-within:bg-white focus-within:ring-2 ${
      hasError ? "ring-red-300 focus-within:ring-red-400" : "ring-gray-200 focus-within:ring-red-300"
    }`;

  return (
    <>
      <AnimatePresence>
        {showAlert && (
          <SuccessAlert
            name={name}
            onDone={() => navigate("/admin-dashboard/departments")}
            onViewTeam={() => navigate(`/admin-dashboard/department/${id}/employees`)}
          />
        )}
      </AnimatePresence>

      <div className={`min-h-screen px-4 pb-16 pt-6 font-sans text-gray-700 sm:px-8 ${PAGE_BG}`}>
        <div className="mx-auto max-w-5xl">
          {/* ================= TOP ROW ================= */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-6 flex items-center justify-between gap-3">
            <button
              onClick={goBack}
              className="group inline-flex items-center gap-2 rounded-2xl bg-white/80 px-3.5 py-2.5 text-sm font-semibold text-gray-600 shadow-sm ring-1 ring-red-100 transition hover:text-red-600 hover:ring-red-200"
            >
              <ChevronLeft size={17} className="transition-transform group-hover:-translate-x-0.5" />
              Back
            </button>
            <span className="hidden items-center gap-1.5 text-xs font-medium text-gray-400 sm:flex">
              Departments <ChevronRight size={12} />
              <span className="max-w-[160px] truncate">{original.dep_name || "Department"}</span>
              <ChevronRight size={12} /> <span className="font-semibold text-red-600">Edit</span>
            </span>
          </motion.div>

          {/* ================= HEADER ================= */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }} className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg shadow-red-600/25 ${name ? colorFor(name) : "from-red-600 to-rose-500"}`}>
                {name ? <span className="text-lg font-extrabold">{initials(name)}</span> : <Building2 size={24} />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">Edit department</p>
                <h1 className="truncate text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
                  {fetching ? <span className="text-gray-300">Loading…</span> : original.dep_name || "Untitled"}
                </h1>
                {updatedAt && !fetching && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-400">
                    <Clock size={12} /> Last updated {timeAgo(updatedAt)}
                  </p>
                )}
              </div>
            </div>
            {!fetching && (
              <button
                onClick={() => navigate(`/admin-dashboard/department/${id}/employees`)}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-sm ring-1 ring-red-100 transition hover:text-red-600 hover:ring-red-200"
              >
                <Users size={16} /> View team
              </button>
            )}
          </motion.div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* ================= FORM ================= */}
            <motion.form
              onSubmit={handleSubmit}
              noValidate
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="overflow-hidden rounded-3xl bg-white/90 shadow-[0_20px_50px_-20px_rgba(127,29,29,0.22)] ring-1 ring-white/70 backdrop-blur-sm lg:col-span-3"
            >
              <div className="h-1.5 bg-gradient-to-r from-red-600 via-rose-500 to-orange-400" />

              {fetching ? (
                <div className="space-y-6 p-6 sm:p-8">
                  <div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-12 w-full" /></div>
                  <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-32 w-full" /></div>
                  <div className="space-y-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
                </div>
              ) : (
                <>
                  <div className="space-y-5 p-6 sm:p-8">
                    {/* error banner */}
                    <AnimatePresence>
                      {error && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <div className={`flex items-start gap-3 rounded-2xl p-4 ring-1 ${stale ? "bg-amber-50 ring-amber-200" : "bg-red-50 ring-red-100"}`}>
                            {stale ? <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" /> : <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" />}
                            <div className="flex-1">
                              {stale && <p className="mb-0.5 text-sm font-bold text-amber-900">Someone else edited this department</p>}
                              <p className={`text-sm ${stale ? "text-amber-800" : "font-medium text-red-700"}`}>{error}</p>
                            </div>
                            {stale ? (
                              <button
                                type="button"
                                onClick={reload}
                                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-amber-700 shadow-sm ring-1 ring-amber-200 transition hover:bg-amber-100"
                              >
                                <RefreshCw size={13} /> Reload
                              </button>
                            ) : (
                              <button type="button" onClick={() => setError("")} aria-label="Dismiss" className="text-red-400 hover:text-red-700">
                                <X size={16} />
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* name */}
                    <Field label="Department name" hint="Required" count={department.dep_name.length} max={NAME_MAX} error={nameError} changed={nameChanged}>
                      <div className={`${inputShell(!!nameError)} items-center gap-3 px-4`}>
                        <Building2 size={17} className="shrink-0 text-gray-400 transition group-focus-within:text-red-500" />
                        <input
                          name="dep_name"
                          value={department.dep_name}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          placeholder="e.g. Strategic Growth"
                          autoComplete="off"
                          aria-invalid={!!nameError}
                          className="w-full bg-transparent py-3.5 text-[15px] font-semibold text-gray-900 placeholder:font-normal placeholder:text-gray-400 focus:outline-none"
                        />
                      </div>
                    </Field>

                    {/* description */}
                    <Field label="Description" hint="Required" count={department.description.length} max={DESC_MAX} error={descError} changed={descChanged}>
                      <div className={`${inputShell(!!descError)} items-start gap-3 px-4 py-3.5`}>
                        <FileText size={17} className="mt-0.5 shrink-0 text-gray-400 transition group-focus-within:text-red-500" />
                        <textarea
                          rows={4}
                          name="description"
                          value={department.description}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          placeholder="Briefly describe what this department is responsible for…"
                          aria-invalid={!!descError}
                          className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-gray-900 placeholder:text-gray-400 focus:outline-none"
                        />
                      </div>
                    </Field>

                    {/* manager picker */}
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-sm font-bold text-gray-900">
                          <UserCog size={16} className="text-red-500" /> Department manager
                          {managerChanged && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">Edited</span>}
                        </label>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">Active members only</span>
                      </div>

                      {eligibleState.loading ? (
                        <div className="space-y-1.5 rounded-2xl bg-gray-50/70 p-1.5"><Skeleton className="h-12 w-full rounded-xl" /><Skeleton className="h-12 w-full rounded-xl" /></div>
                      ) : (
                        <>
                          {eligibleState.error && (
                            <div className="flex items-center gap-2 rounded-2xl bg-red-50 p-3 text-xs font-semibold text-red-700 ring-1 ring-red-100">
                              <AlertCircle size={14} /> {eligibleState.error}
                            </div>
                          )}

                          {eligible.length > 5 && (
                            <label className="relative block">
                              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                              <input
                                value={mgrSearch}
                                onChange={(e) => setMgrSearch(e.target.value)}
                                placeholder={`Search ${eligible.length} eligible members…`}
                                className="w-full rounded-2xl bg-gray-50 py-2.5 pl-10 pr-4 text-sm ring-1 ring-gray-200 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-300"
                              />
                            </label>
                          )}

                          <div role="radiogroup" aria-label="Department manager" className="max-h-[260px] space-y-1.5 overflow-y-auto overflow-x-hidden rounded-2xl bg-gray-50/70 p-1.5 ring-1 ring-gray-100">
                            <ManagerOption
                              selected={managerId === ""}
                              onClick={() => setManagerId("")}
                              title="No manager"
                              subtitle="Leave this department without a manager"
                              icon={UserX}
                            />

                            {originalManagerId && !currentInEligible && (
                              <ManagerOption
                                selected={managerId === originalManagerId}
                                onClick={() => setManagerId(originalManagerId)}
                                title={currentManager?.name || "Current manager"}
                                subtitle={currentManager ? managerLabel(currentManager) : "No longer eligible"}
                                tone="warning"
                                icon={AlertTriangle}
                                badge={<span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-px text-[9px] font-bold text-amber-700">Not eligible</span>}
                              />
                            )}

                            {filteredEligible.map((m) => {
                              const mid = String(m.employeeRecordId);
                              return (
                                <ManagerOption
                                  key={mid}
                                  selected={managerId === mid}
                                  onClick={() => setManagerId(mid)}
                                  title={m.name || "Unnamed employee"}
                                  subtitle={[m.employeeCode, m.designation].filter(Boolean).join(" · ")}
                                  avatarText={m.name || "?"}
                                  badge={
                                    mid === originalManagerId ? (
                                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-px text-[9px] font-bold text-amber-700">
                                        <Star size={8} fill="currentColor" /> Current
                                      </span>
                                    ) : null
                                  }
                                />
                              );
                            })}

                            {mgrSearch && filteredEligible.length === 0 && (
                              <p className="py-4 text-center text-xs text-gray-400">No members match “{mgrSearch}”.</p>
                            )}
                          </div>

                          {!eligibleState.error && eligible.length === 0 && (
                            <div className="flex items-start gap-3 rounded-2xl bg-sky-50/80 p-4 ring-1 ring-sky-100">
                              <Users size={17} className="mt-0.5 shrink-0 text-sky-600" />
                              <p className="text-xs leading-relaxed text-sky-900">
                                No active employees in this department yet. Add employees to the department first, then assign a manager.
                              </p>
                            </div>
                          )}
                        </>
                      )}

                      <AnimatePresence>
                        {managerChanged && (
                          <motion.p
                            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="flex items-center gap-1.5 text-xs font-semibold text-amber-700"
                          >
                            <AlertCircle size={13} />
                            {managerId ? "Manager will change when you save." : "The manager assignment will be cleared when you save."}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* actions */}
                  <div className="flex flex-col-reverse gap-3 border-t border-red-50 bg-gray-50/60 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                    <div className="flex items-center justify-center gap-2 sm:justify-start">
                      {isDirty ? (
                        <>
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                            {changeCount} unsaved {changeCount === 1 ? "change" : "changes"}
                          </span>
                          <button type="button" onClick={resetChanges} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-gray-500 transition hover:bg-white hover:text-gray-900">
                            <Undo2 size={13} /> Reset
                          </button>
                        </>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                          <CheckCircle2 size={13} className="text-emerald-500" /> No changes yet
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row">
                      <button type="button" onClick={goBack} className="rounded-2xl px-5 py-3.5 text-sm font-bold text-gray-500 transition hover:bg-white hover:text-gray-900">
                        Cancel
                      </button>
                      <motion.button
                        type="submit"
                        disabled={loading}
                        whileTap={{ scale: 0.98 }}
                        className={`flex items-center justify-center gap-2.5 rounded-2xl px-6 py-3.5 text-sm font-bold text-white transition ${
                          isDirty && isValid
                            ? "bg-gradient-to-r from-red-600 to-rose-500 shadow-lg shadow-red-600/30 hover:-translate-y-0.5 hover:shadow-xl"
                            : "bg-gray-300"
                        } disabled:cursor-not-allowed disabled:opacity-80`}
                      >
                        {loading ? (
                          <><Loader2 size={17} className="animate-spin" /> Saving changes…</>
                        ) : (
                          <><Save size={17} /> Save changes</>
                        )}
                      </motion.button>
                    </div>
                  </div>
                </>
              )}
            </motion.form>

            {/* ================= SIDE: SUMMARY ================= */}
            <motion.aside
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.18 }}
              className="space-y-6 lg:col-span-2"
            >
              {/* current manager card */}
              <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 p-5 text-white shadow-[0_20px_50px_-15px_rgba(220,38,38,0.45)]">
                <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/15 blur-2xl" />
                <p className="relative mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
                  {managerChanged ? "Manager after saving" : "Current manager"}
                </p>
                {fetching ? (
                  <div className="h-14 animate-pulse rounded-2xl bg-white/20" />
                ) : selectedManager ? (
                  <div className="relative flex items-center gap-3">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-base font-extrabold text-red-600 shadow-md">
                      {initials(selectedManager.name || "?")}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-lg font-extrabold leading-tight">{selectedManager.name || "Unnamed employee"}</p>
                      <p className="truncate text-sm text-white/85">
                        {[selectedManager.employeeCode, selectedManager.designation].filter(Boolean).join(" · ") || "Manager"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="relative flex items-center gap-3">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
                      <UserX size={22} />
                    </span>
                    <div>
                      <p className="text-lg font-extrabold">No manager</p>
                      <p className="text-sm text-white/80">Choose one from the list.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* pending changes */}
              <div className="rounded-3xl bg-white/85 p-5 shadow-[0_10px_30px_-14px_rgba(127,29,29,0.18)] ring-1 ring-white/70 backdrop-blur-sm">
                <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-gray-400">Pending changes</p>
                {!isDirty ? (
                  <div className="flex flex-col items-center gap-2 py-4 text-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500"><CheckCircle2 size={20} /></span>
                    <p className="text-sm text-gray-400">Everything matches what's saved.</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {nameChanged && (
                      <ChangeRow label="Name" from={original.dep_name || "—"} to={department.dep_name.trim() || "—"} />
                    )}
                    {descChanged && <ChangeRow label="Description" from="Previous text" to="Updated text" />}
                    {managerChanged && (
                      <ChangeRow
                        label="Manager"
                        from={previousManager?.name || (originalManagerId ? "Current manager" : "No manager")}
                        to={selectedManager?.name || "No manager"}
                      />
                    )}
                  </ul>
                )}
              </div>

              {/* tip */}
              <div className="flex items-start gap-3 rounded-3xl bg-sky-50/80 p-4 ring-1 ring-sky-100">
                <UserCog size={18} className="mt-0.5 shrink-0 text-sky-600" />
                <p className="text-xs leading-relaxed text-sky-900">
                  Only <b>active members of this department</b> can be its manager. If someone moves teams or is
                  deactivated, they'll show as <b>no longer eligible</b> here.
                </p>
              </div>
            </motion.aside>
          </div>
        </div>
      </div>
    </>
  );
};

const ChangeRow = ({ label, from, to }) => (
  <li className="rounded-2xl bg-amber-50/60 p-3 ring-1 ring-amber-100">
    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">{label}</p>
    <div className="flex items-center gap-2 text-sm">
      <span className="min-w-0 flex-1 truncate text-gray-400 line-through">{from}</span>
      <ArrowRight size={14} className="shrink-0 text-amber-500" />
      <span className="min-w-0 flex-1 truncate font-semibold text-gray-900">{to}</span>
    </div>
  </li>
);

export default EditDepartment;
