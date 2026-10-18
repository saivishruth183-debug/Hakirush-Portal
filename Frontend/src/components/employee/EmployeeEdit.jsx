import axios from "axios";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { fetchDepartments } from "../../utils/EmployeeHelper";
import { apiErrorCode, apiErrorMessage } from "../../utils/apiError";
import {
  User, Briefcase, Heart, IndianRupee, Fingerprint, Camera, CheckCircle2, X, ChevronLeft,
  ChevronRight, ChevronDown, Building2, Save, Loader2, AlertCircle, AlertTriangle, Undo2,
  ArrowRight, Eye, Crown, RefreshCw, Lock, Trash2,
} from "lucide-react";

const PAGE_BG = "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // matches server limit (5MB)
const MARITAL = ["Single", "Married", "Divorced", "Widowed"];

const avatarColors = [
  "from-red-500 to-rose-600",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-violet-500 to-purple-600",
  "from-slate-600 to-slate-800",
];
const colorFor = (s = "") => avatarColors[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % avatarColors.length];
const initials = (s = "") => s.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

const imageUrl = (p) => {
  if (!p) return null;
  if (p.startsWith("http")) return p;
  return `${import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "")}/${p.replace(/^\/+/, "")}`;
};

const EMPTY = { employeeId: "", name: "", maritalStatus: "", designation: "", salary: "", department: "" };

/* ================= MODAL SHELL ================= */
const Modal = ({ children, onClose }) => {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center font-sans sm:items-center sm:p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        className="relative w-full max-w-sm overflow-hidden rounded-t-[2rem] bg-white shadow-[0_40px_90px_-20px_rgba(127,29,29,0.45)] ring-1 ring-red-100 sm:rounded-[2rem]"
      >
        {children}
      </motion.div>
    </div>
  );
};

const ModalIcon = ({ icon: Icon, tone }) => {
  const g = tone === "success" ? "from-emerald-500 to-teal-500 shadow-emerald-500/35" : "from-amber-500 to-orange-500 shadow-amber-500/35";
  return (
    <motion.span
      initial={{ scale: 0.5, rotate: -15, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.08 }}
      className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center"
    >
      <span className={`absolute inset-0 animate-ping rounded-3xl bg-gradient-to-br opacity-20 [animation-duration:2s] ${g}`} />
      <span className={`relative flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br text-white shadow-lg ${g}`}>
        <Icon size={28} />
      </span>
    </motion.span>
  );
};

/* ================= FIELD PIECES ================= */
const shell = (err, changed) =>
  `group flex items-center gap-3 rounded-2xl px-4 ring-1 transition focus-within:bg-white focus-within:ring-2 ${
    err ? "bg-gray-50 ring-red-300 focus-within:ring-red-400"
    : changed ? "bg-amber-50/50 ring-amber-200 focus-within:ring-red-300"
    : "bg-gray-50 ring-gray-200 focus-within:ring-red-300"
  }`;

const FieldWrap = ({ label, required, error, hint, changed, children, id }) => (
  <div className="min-w-0 space-y-1.5">
    <label htmlFor={id} className="flex items-center gap-1.5 text-[13px] font-bold text-gray-800">
      {label}
      {required && <span className="text-red-500">*</span>}
      {changed && <span className="rounded-full bg-amber-100 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-amber-700">Edited</span>}
    </label>
    {children}
    {error ? (
      <p className="flex items-center gap-1 text-[11px] font-semibold text-red-600"><AlertCircle size={12} className="shrink-0" /> {error}</p>
    ) : hint ? (
      <p className="text-[11px] text-gray-400">{hint}</p>
    ) : null}
  </div>
);

/* ================= PAGE ================= */
const EmployeeEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState(EMPTY);
  const [original, setOriginal] = useState(EMPTY);
  const [departments, setDepartments] = useState([]);
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [originalPreview, setOriginalPreview] = useState(null);
  const [photoError, setPhotoError] = useState("");
  const [imgBroken, setImgBroken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [showAlert, setShowAlert] = useState(false);
  const [managerPrompt, setManagerPrompt] = useState(null); // message string when backend asks to clear manager
  const [touched, setTouched] = useState({});
  const [reloadKey, setReloadKey] = useState(0);
  const fileRef = useRef(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const deptData = await fetchDepartments();
        setDepartments(deptData || []);

        const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/employee/${id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });

        const emp = res.data.employee;
        const values = {
          employeeId: emp?.employeeId || "",
          name: emp?.userId?.name || "",
          maritalStatus: emp?.maritalStatus || "",
          designation: emp?.designation || "",
          salary: emp?.salary ?? "",
          department: emp?.department?._id || "",
        };
        setEmployee(values);
        setOriginal(values);

        const src = imageUrl(emp?.userId?.profileImage);
        setPreview(src);
        setOriginalPreview(src);
        setImgBroken(false);
      } catch (err) {
        console.error("Failed to load employee data", err);
        setLoadError(apiErrorMessage(err, "We couldn't load this employee."));
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id, reloadKey]);

  // free blob preview URLs
  useEffect(() => () => { if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview); }, [preview]);

  /* ---------- handlers ---------- */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setEmployee((prev) => ({ ...prev, [name]: value }));
    if (saveError) setSaveError("");
  };
  const handleBlur = (e) => setTouched((t) => ({ ...t, [e.target.name]: true }));

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      setPhotoError("Please choose an image file (JPG, PNG or WebP).");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setPhotoError(`That photo is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB.`);
      return;
    }
    setPhotoError("");
    setImgBroken(false);
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const undoPhoto = () => {
    setImage(null);
    setPreview(originalPreview);
    setPhotoError("");
    setImgBroken(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  /* ---------- derived ---------- */
  const changed = (k) => String(employee[k] ?? "") !== String(original[k] ?? "");
  const changedKeys = ["name", "designation", "department", "salary", "maritalStatus"].filter(changed);
  const changeCount = changedKeys.length + (image ? 1 : 0);
  const isDirty = changeCount > 0;

  const errors = useMemo(() => {
    const e = {};
    if (!employee.name.trim()) e.name = "Name can't be empty.";
    if (!employee.department) e.department = "Choose a department.";
    if (employee.salary !== "" && Number(employee.salary) < 0) e.salary = "Salary can't be negative.";
    return e;
  }, [employee]);
  const errFor = (k) => (touched[k] ? errors[k] : "");
  const isValid = Object.keys(errors).length === 0;

  const deptName = (did) => departments.find((d) => d._id === did)?.dep_name || "";
  const deptChanged = changed("department") && !!original.department;
  const showPhoto = preview && !imgBroken;

  /* ---------- submit ---------- */
  const send = (clearManager = false) => {
    const fd = new FormData();
    Object.keys(employee).forEach((key) => fd.append(key, employee[key]));
    if (image) fd.append("profileImage", image);
    // Multipart sends strings; backend treats "true" as clearManager: true.
    if (clearManager) fd.append("clearManager", "true");
    return axios.put(`${import.meta.env.VITE_BACKEND_URL}/api/employee/${id}`, fd, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
  };

  const finish = (res) => {
    if (res?.data?.success) {
      setOriginal(employee);
      setOriginalPreview(preview);
      setImage(null);
      setShowAlert(true);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ name: true, department: true, salary: true });
    if (saving || !isValid) return;
    setSaving(true);
    setSaveError("");
    try {
      finish(await send(false));
    } catch (err) {
      // Moving a department's current manager to another department.
      if (apiErrorCode(err) === "MANAGER_REASSIGNMENT_REQUIRED") {
        setManagerPrompt(apiErrorMessage(err, "This employee is the manager of their current department."));
      } else {
        setSaveError(apiErrorMessage(err, "Update failed"));
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmClearManager = async () => {
    setSaving(true);
    try {
      finish(await send(true));
      setManagerPrompt(null);
    } catch (err) {
      setManagerPrompt(null);
      setSaveError(apiErrorMessage(err, "Update failed"));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSaving(false);
    }
  };

  const resetAll = () => {
    setEmployee(original);
    undoPhoto();
    setTouched({});
    setSaveError("");
  };

  const goBack = () => {
    if (isDirty && !showAlert && !window.confirm("You have unsaved changes. Leave without saving?")) return;
    navigate(-1);
  };

  /* ---------- states ---------- */
  if (loading) return <LoadingView />;
  if (loadError) {
    return (
      <div className={`flex min-h-screen items-center justify-center p-6 font-sans ${PAGE_BG}`}>
        <div className="w-full max-w-sm overflow-hidden rounded-[2rem] bg-white text-center shadow-[0_40px_90px_-20px_rgba(127,29,29,0.35)] ring-1 ring-red-100">
          <div className="h-1.5 bg-gradient-to-r from-red-600 via-rose-500 to-orange-400" />
          <div className="p-8">
            <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-50 text-amber-500"><AlertTriangle size={28} /></span>
            <h2 className="text-xl font-extrabold tracking-tight text-gray-900">Couldn't open this record</h2>
            <p className="mt-2 text-sm text-gray-500">{loadError}</p>
            <div className="mt-6 flex gap-2">
              <button onClick={() => navigate(-1)} className="flex-1 rounded-2xl bg-gray-50 py-3 text-sm font-bold text-gray-600 ring-1 ring-gray-200 hover:bg-white">Go back</button>
              <button onClick={() => setReloadKey((k) => k + 1)} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30">
                <RefreshCw size={15} /> Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const nameShown = employee.name.trim() || "Unnamed employee";
  const salaryNum = Number(employee.salary || 0);

  return (
    <>
      {/* ================= MODALS ================= */}
      <AnimatePresence>
        {showAlert && (
          <Modal key="ok" onClose={() => navigate("/admin-dashboard/employees")}>
            <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />
            <div className="px-7 pb-2 pt-8 text-center">
              <ModalIcon icon={CheckCircle2} tone="success" />
              <h3 className="text-xl font-extrabold tracking-tight text-gray-900">Changes saved</h3>
              <p className="mt-2 text-sm text-gray-500"><b className="text-gray-900">{nameShown}</b>'s record is up to date.</p>
            </div>
            <div className="space-y-2.5 p-7 pt-5">
              <button
                onClick={() => navigate("/admin-dashboard/employees")}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:-translate-y-0.5 active:scale-[0.98]"
              >
                Back to directory <ArrowRight size={16} />
              </button>
              <button
                onClick={() => navigate(`/admin-dashboard/employees/${id}`)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-50 py-3.5 text-sm font-bold text-gray-600 ring-1 ring-gray-200 transition hover:bg-white hover:text-gray-900 active:scale-[0.98]"
              >
                <Eye size={16} /> View profile
              </button>
            </div>
          </Modal>
        )}

        {managerPrompt && (
          <Modal key="mgr" onClose={() => !saving && setManagerPrompt(null)}>
            <div className="h-1.5 bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500" />
            <div className="px-7 pb-2 pt-8 text-center">
              <ModalIcon icon={Crown} tone="warning" />
              <h3 className="text-xl font-extrabold tracking-tight text-gray-900">They manage their current team</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">{managerPrompt}</p>
              <div className="mt-4 rounded-2xl bg-amber-50 p-3 text-left ring-1 ring-amber-100">
                <p className="flex items-center gap-2 text-xs text-amber-900">
                  <span className="truncate font-semibold">{deptName(original.department) || "Current department"}</span>
                  <ArrowRight size={13} className="shrink-0 text-amber-500" />
                  <span className="truncate font-semibold">{deptName(employee.department) || "New department"}</span>
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-amber-800">
                  Saving will clear the manager of <b>{deptName(original.department) || "the old department"}</b>. You can pick a new one from Departments → Edit.
                </p>
              </div>
            </div>
            <div className="flex gap-3 p-7 pt-5">
              <button
                onClick={() => setManagerPrompt(null)}
                disabled={saving}
                className="flex-1 rounded-2xl bg-gray-50 py-3.5 text-sm font-bold text-gray-600 ring-1 ring-gray-200 transition hover:bg-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmClearManager}
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:-translate-y-0.5 disabled:opacity-80"
              >
                {saving ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : "Clear & save"}
              </button>
            </div>
          </Modal>
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
              Employees <ChevronRight size={12} />
              <span className="max-w-[180px] truncate">{original.name || "Employee"}</span>
              <ChevronRight size={12} /> <span className="font-semibold text-red-600">Edit</span>
            </span>
          </motion.div>

          {/* ================= PROFILE HEADER ================= */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mb-6 overflow-hidden rounded-[2rem] bg-white/90 shadow-[0_24px_60px_-24px_rgba(127,29,29,0.35)] ring-1 ring-white/70 backdrop-blur-sm"
          >
            <div className="relative h-24 overflow-hidden bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 sm:h-28">
              <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.12]"
                style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
              <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/15 blur-3xl" />
            </div>
            <div className="flex flex-col items-center gap-4 px-5 pb-5 sm:flex-row sm:items-end sm:px-8">
              {/* photo */}
              <div className="relative -mt-14 shrink-0">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  aria-label="Change photo"
                  className={`group relative block h-28 w-28 overflow-hidden rounded-[1.75rem] bg-white p-1 shadow-xl ring-4 ${image ? "ring-amber-300" : "ring-white"}`}
                >
                  {showPhoto ? (
                    <img src={preview} alt="" onError={() => setImgBroken(true)} className="h-full w-full rounded-[1.45rem] object-cover" />
                  ) : (
                    <span className={`flex h-full w-full items-center justify-center rounded-[1.45rem] bg-gradient-to-br text-3xl font-extrabold text-white ${colorFor(nameShown)}`}>
                      {initials(nameShown) || <User size={32} />}
                    </span>
                  )}
                  <span className="absolute inset-1 flex flex-col items-center justify-center gap-1 rounded-[1.45rem] bg-gray-900/50 text-white opacity-0 transition group-hover:opacity-100">
                    <Camera size={20} />
                    <span className="text-[10px] font-bold">Change</span>
                  </span>
                </button>
                <span className="pointer-events-none absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/30 ring-2 ring-white">
                  <Camera size={15} />
                </span>
                <input ref={fileRef} type="file" hidden accept="image/*" onChange={handleImageChange} />
              </div>

              <div className="min-w-0 flex-1 text-center sm:pb-1 sm:text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">Edit employee</p>
                <h1 className="truncate text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">{nameShown}</h1>
                <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
                  <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 font-mono text-[11px] font-semibold text-gray-600">
                    <Fingerprint size={11} /> {employee.employeeId || "No ID"}
                  </span>
                  {employee.designation && <span className="text-xs text-gray-500">{employee.designation}</span>}
                  {deptName(employee.department) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                      <Building2 size={11} /> {deptName(employee.department)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-center gap-1 sm:items-end sm:pb-1">
                {image ? (
                  <button type="button" onClick={undoPhoto} className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-50">
                    <Undo2 size={13} /> Undo new photo
                  </button>
                ) : (
                  <span className="text-[11px] text-gray-400">Click the photo to change it · max 5 MB</span>
                )}
                {photoError && <span className="flex items-center gap-1 text-[11px] font-semibold text-red-600"><AlertCircle size={12} /> {photoError}</span>}
              </div>
            </div>
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
              <div className="space-y-6 p-6 sm:p-8">
                <AnimatePresence>
                  {saveError && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div role="alert" className="flex items-start gap-3 rounded-2xl bg-red-50 p-4 ring-1 ring-red-100">
                        <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" />
                        <div className="flex-1">
                          <p className="text-sm font-bold text-red-800">Couldn't save changes</p>
                          <p className="text-sm text-red-700">{saveError}</p>
                        </div>
                        <button type="button" onClick={() => setSaveError("")} aria-label="Dismiss" className="text-red-400 hover:text-red-700"><X size={16} /></button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* identity */}
                <div>
                  <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400"><User size={13} className="text-red-500" /> Identity</p>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <FieldWrap label="Full name" required error={errFor("name")} changed={changed("name")} id="e-name">
                      <div className={shell(errFor("name"), changed("name"))}>
                        <User size={16} className="shrink-0 text-gray-400 transition group-focus-within:text-red-500" />
                        <input id="e-name" name="name" value={employee.name} onChange={handleChange} onBlur={handleBlur} placeholder="Full name"
                          className="w-full min-w-0 bg-transparent py-3 text-sm font-semibold text-gray-900 placeholder:font-normal placeholder:text-gray-400 focus:outline-none" />
                      </div>
                    </FieldWrap>

                    <FieldWrap label="Employee ID" hint="IDs can't be changed here." id="e-id">
                      <div className="flex items-center gap-3 rounded-2xl bg-gray-100/80 px-4 ring-1 ring-gray-200">
                        <Fingerprint size={16} className="shrink-0 text-gray-400" />
                        <input id="e-id" value={employee.employeeId} readOnly tabIndex={-1}
                          className="w-full min-w-0 cursor-not-allowed bg-transparent py-3 font-mono text-sm font-semibold text-gray-500 focus:outline-none" />
                        <Lock size={14} className="shrink-0 text-gray-400" />
                      </div>
                    </FieldWrap>

                    <FieldWrap label="Marital status" changed={changed("maritalStatus")} id="e-marital">
                      <div className={`${shell("", changed("maritalStatus"))} relative`}>
                        <Heart size={16} className="shrink-0 text-gray-400 transition group-focus-within:text-red-500" />
                        <select id="e-marital" name="maritalStatus" value={employee.maritalStatus} onChange={handleChange}
                          className={`w-full min-w-0 cursor-pointer appearance-none bg-transparent py-3 pr-6 text-sm font-semibold focus:outline-none ${employee.maritalStatus ? "text-gray-900" : "text-gray-400"}`}>
                          <option value="">Select</option>
                          {MARITAL.map((m) => <option key={m} value={m} className="text-gray-900">{m}</option>)}
                          {employee.maritalStatus && !MARITAL.includes(employee.maritalStatus) && (
                            <option value={employee.maritalStatus}>{employee.maritalStatus}</option>
                          )}
                        </select>
                        <ChevronDown size={15} className="pointer-events-none absolute right-4 text-gray-400" />
                      </div>
                    </FieldWrap>
                  </div>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-red-100 to-transparent" />

                {/* work */}
                <div>
                  <p className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400"><Briefcase size={13} className="text-red-500" /> Work & pay</p>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <FieldWrap label="Designation" changed={changed("designation")} id="e-desig">
                      <div className={shell("", changed("designation"))}>
                        <Briefcase size={16} className="shrink-0 text-gray-400 transition group-focus-within:text-red-500" />
                        <input id="e-desig" name="designation" value={employee.designation} onChange={handleChange} placeholder="e.g. Senior Analyst"
                          className="w-full min-w-0 bg-transparent py-3 text-sm font-semibold text-gray-900 placeholder:font-normal placeholder:text-gray-400 focus:outline-none" />
                      </div>
                    </FieldWrap>

                    <FieldWrap label="Department" required error={errFor("department")} changed={changed("department")} id="e-dept">
                      <div className={`${shell(errFor("department"), changed("department"))} relative`}>
                        <Building2 size={16} className="shrink-0 text-gray-400 transition group-focus-within:text-red-500" />
                        <select id="e-dept" name="department" value={employee.department} onChange={handleChange} onBlur={handleBlur}
                          className={`w-full min-w-0 cursor-pointer appearance-none bg-transparent py-3 pr-6 text-sm font-semibold focus:outline-none ${employee.department ? "text-gray-900" : "text-gray-400"}`}>
                          <option value="">Select a department</option>
                          {departments.map((d) => <option key={d._id} value={d._id} className="text-gray-900">{d.dep_name}</option>)}
                        </select>
                        <ChevronDown size={15} className="pointer-events-none absolute right-4 text-gray-400" />
                      </div>
                    </FieldWrap>

                    <FieldWrap
                      label="Annual salary"
                      error={errFor("salary")}
                      changed={changed("salary")}
                      hint={employee.salary !== "" && !errors.salary ? `≈ ₹${Math.round(salaryNum / 12).toLocaleString("en-IN")} per month` : undefined}
                      id="e-salary"
                    >
                      <div className={shell(errFor("salary"), changed("salary"))}>
                        <IndianRupee size={16} className="shrink-0 text-gray-400 transition group-focus-within:text-red-500" />
                        <input id="e-salary" type="number" min="0" inputMode="numeric" name="salary" value={employee.salary} onChange={handleChange} onBlur={handleBlur} placeholder="0"
                          className="w-full min-w-0 bg-transparent py-3 text-sm font-semibold tabular-nums text-gray-900 placeholder:font-normal placeholder:text-gray-400 focus:outline-none" />
                      </div>
                    </FieldWrap>
                  </div>

                  <AnimatePresence>
                    {deptChanged && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="mt-5 flex items-start gap-2.5 rounded-2xl bg-amber-50 p-3.5 ring-1 ring-amber-200">
                          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
                          <p className="text-xs leading-relaxed text-amber-900">
                            Moving from <b>{deptName(original.department) || "their current department"}</b> to <b>{deptName(employee.department) || "a new department"}</b>.
                            If they manage their current team, you'll be asked before that assignment is cleared.
                          </p>
                        </div>
                      </motion.div>
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
                      <button type="button" onClick={resetAll} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-gray-500 transition hover:bg-white hover:text-gray-900">
                        <Undo2 size={13} /> Reset
                      </button>
                    </>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-gray-400"><CheckCircle2 size={13} className="text-emerald-500" /> No changes yet</span>
                  )}
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  <button type="button" onClick={goBack} className="rounded-2xl px-5 py-3.5 text-sm font-bold text-gray-500 transition hover:bg-white hover:text-gray-900">Cancel</button>
                  <motion.button
                    type="submit"
                    disabled={saving}
                    whileTap={{ scale: 0.98 }}
                    className={`flex items-center justify-center gap-2.5 rounded-2xl px-6 py-3.5 text-sm font-bold text-white transition ${
                      isDirty && isValid ? "bg-gradient-to-r from-red-600 to-rose-500 shadow-lg shadow-red-600/30 hover:-translate-y-0.5 hover:shadow-xl" : "bg-gray-300"
                    } disabled:cursor-not-allowed disabled:opacity-80`}
                  >
                    {saving ? <><Loader2 size={17} className="animate-spin" /> Saving…</> : <><Save size={17} /> Save changes</>}
                  </motion.button>
                </div>
              </div>
            </motion.form>

            {/* ================= SIDE: CHANGES ================= */}
            <motion.aside
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.18 }}
              className="space-y-6 lg:sticky lg:top-24 lg:col-span-2 lg:self-start"
            >
              <div className="rounded-3xl bg-white/85 p-5 shadow-[0_10px_30px_-14px_rgba(127,29,29,0.18)] ring-1 ring-white/70 backdrop-blur-sm">
                <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-gray-400">Pending changes</p>
                {!isDirty ? (
                  <div className="flex flex-col items-center gap-2 py-4 text-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500"><CheckCircle2 size={20} /></span>
                    <p className="text-sm text-gray-400">Everything matches what's saved.</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {image && (
                      <li className="flex items-center gap-3 rounded-2xl bg-amber-50/60 p-3 ring-1 ring-amber-100">
                        <img src={preview} alt="" className="h-10 w-10 rounded-xl object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Photo</p>
                          <p className="truncate text-sm font-semibold text-gray-900">{image.name}</p>
                        </div>
                        <button type="button" onClick={undoPhoto} aria-label="Undo photo" className="text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                      </li>
                    )}
                    {changed("name") && <ChangeRow label="Name" from={original.name} to={employee.name.trim()} />}
                    {changed("designation") && <ChangeRow label="Designation" from={original.designation} to={employee.designation} />}
                    {changed("department") && <ChangeRow label="Department" from={deptName(original.department)} to={deptName(employee.department)} />}
                    {changed("salary") && (
                      <ChangeRow
                        label="Annual salary"
                        from={original.salary !== "" ? `₹${Number(original.salary).toLocaleString("en-IN")}` : ""}
                        to={employee.salary !== "" ? `₹${salaryNum.toLocaleString("en-IN")}` : ""}
                      />
                    )}
                    {changed("maritalStatus") && <ChangeRow label="Marital status" from={original.maritalStatus} to={employee.maritalStatus} />}
                  </ul>
                )}
              </div>

              <button
                type="button"
                onClick={() => navigate(`/admin-dashboard/employees/${id}`)}
                className="flex w-full items-center justify-between rounded-3xl bg-white/85 p-4 text-sm font-bold text-gray-700 shadow-[0_10px_30px_-14px_rgba(127,29,29,0.18)] ring-1 ring-white/70 backdrop-blur-sm transition hover:text-red-600 hover:ring-red-200"
              >
                <span className="flex items-center gap-2.5"><Eye size={16} className="text-red-500" /> View full profile</span>
                <ArrowRight size={16} />
              </button>
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
      <span className="min-w-0 flex-1 truncate text-gray-400 line-through">{from || "—"}</span>
      <ArrowRight size={14} className="shrink-0 text-amber-500" />
      <span className="min-w-0 flex-1 truncate font-semibold text-gray-900">{to || "—"}</span>
    </div>
  </li>
);

const LoadingView = () => (
  <div className={`min-h-screen px-4 pt-6 sm:px-8 ${PAGE_BG}`}>
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="h-11 w-24 animate-pulse rounded-2xl bg-white/70" />
      <div className="overflow-hidden rounded-[2rem] bg-white/60">
        <div className="h-24 animate-pulse bg-red-200/50 sm:h-28" />
        <div className="flex items-end gap-4 px-8 pb-5">
          <div className="-mt-14 h-28 w-28 animate-pulse rounded-[1.75rem] bg-white" />
          <div className="flex-1 space-y-2 pb-1"><div className="h-7 w-1/3 animate-pulse rounded-xl bg-white/80" /><div className="h-4 w-1/4 animate-pulse rounded-xl bg-white/80" /></div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="h-96 animate-pulse rounded-3xl bg-white/70 lg:col-span-3" />
        <div className="h-48 animate-pulse rounded-3xl bg-white/70 lg:col-span-2" />
      </div>
    </div>
  </div>
);

export default EmployeeEdit;