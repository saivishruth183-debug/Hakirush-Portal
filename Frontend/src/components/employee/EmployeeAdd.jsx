import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { fetchDepartments } from "../../utils/EmployeeHelper";
import { apiErrorMessage } from "../../utils/apiError";
import { useNavigate } from "react-router-dom";
import {
  UserPlus, Camera, CheckCircle2, ChevronLeft, ChevronRight, ChevronDown, User, Mail, IdCard,
  CreditCard, Landmark, Calendar, Heart, Building2, ShieldCheck, Briefcase, Clock,
  IndianRupee, Droplet, AlertCircle, X, Loader2, Trash2, Upload, Send, Plus, ArrowRight,
} from "lucide-react";

const PAGE_BG = "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // matches server limit (5MB)
const REDIRECT_MS = 2400;

const REQUIRED = [
  "name", "email", "employeeId", "dob", "gender", "maritalStatus",
  "department", "role", "designation", "experience", "salary", "bloodGroup",
];

const LABELS = {
  name: "Full name", email: "Email address", employeeId: "Employee ID", dob: "Date of birth",
  gender: "Gender", maritalStatus: "Marital status", department: "Department", role: "System role",
  designation: "Designation", experience: "Experience", salary: "Annual salary", bloodGroup: "Blood group",
};

const avatarColors = [
  "from-red-500 to-rose-600",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-violet-500 to-purple-600",
  "from-slate-600 to-slate-800",
];
const colorFor = (s = "") => avatarColors[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % avatarColors.length];
const initials = (s = "") => s.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "";

const todayISO = () => new Date().toISOString().split("T")[0];

/* ---------- validation ---------- */
const validate = (data) => {
  const errs = {};
  REQUIRED.forEach((k) => {
    if (!String(data[k] ?? "").trim()) errs[k] = `${LABELS[k]} is required.`;
  });
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) errs.email = "Enter a valid email address.";
  if (data.dob && data.dob > todayISO()) errs.dob = "Date of birth can't be in the future.";
  if (data.experience !== undefined && data.experience !== "" && Number(data.experience) < 0) errs.experience = "Experience can't be negative.";
  if (data.salary !== undefined && data.salary !== "" && Number(data.salary) < 0) errs.salary = "Salary can't be negative.";
  const aadhar = String(data.aadharcard || "").replace(/\s/g, "");
  if (aadhar && !/^\d{12}$/.test(aadhar)) errs.aadharcard = "Aadhaar should be 12 digits.";
  const pan = String(data.pancard || "").replace(/\s/g, "").toUpperCase();
  if (pan && !/^[A-Z]{5}\d{4}[A-Z]$/.test(pan)) errs.pancard = "PAN looks like ABCDE1234F.";
  return errs;
};

/* ================= SUCCESS MODAL ================= */
const SuccessAlert = ({ name, email, onDone, onAddAnother }) => (
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
        <h3 className="text-xl font-extrabold tracking-tight text-gray-900">{name || "Employee"} is onboarded</h3>
        <div className="mx-auto mt-3 flex max-w-[280px] items-start gap-2.5 rounded-2xl bg-sky-50 p-3 text-left ring-1 ring-sky-100">
          <Send size={15} className="mt-0.5 shrink-0 text-sky-600" />
          <p className="text-xs leading-relaxed text-sky-900">
            An onboarding email has been sent{email ? <> to <b className="break-all">{email}</b></> : ""} to set up a secure password.
          </p>
        </div>
      </div>
      <div className="space-y-2.5 p-7 pt-5">
        <button
          onClick={onDone}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:-translate-y-0.5 active:scale-[0.98]"
        >
          Back to directory <ArrowRight size={16} />
        </button>
        <button
          onClick={onAddAnother}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-50 py-3.5 text-sm font-bold text-gray-600 ring-1 ring-gray-200 transition hover:bg-white hover:text-gray-900 active:scale-[0.98]"
        >
          <Plus size={16} /> Add another employee
        </button>
      </div>
      <motion.div
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: REDIRECT_MS / 1000, ease: "linear" }}
        className="h-1 origin-left bg-gradient-to-r from-emerald-500 to-teal-400"
      />
    </motion.div>
  </div>
);

/* ================= FIELD PIECES ================= */
const shell = (err) =>
  `group flex items-center gap-3 rounded-2xl bg-gray-50 px-4 ring-1 transition focus-within:bg-white focus-within:ring-2 ${
    err ? "ring-red-300 focus-within:ring-red-400" : "ring-gray-200 focus-within:ring-red-300"
  }`;

const FieldWrap = ({ label, required, error, hint, children, id }) => (
  <div className="min-w-0 space-y-1.5" data-field={id}>
    <label htmlFor={id} className="flex items-center gap-1 text-[13px] font-bold text-gray-800">
      {label}
      {required ? <span className="text-red-500">*</span> : <span className="text-[11px] font-medium text-gray-400">(optional)</span>}
    </label>
    {children}
    <AnimatePresence initial={false}>
      {error ? (
        <motion.p key="e" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
          className="flex items-center gap-1 text-[11px] font-semibold text-red-600">
          <AlertCircle size={12} className="shrink-0" /> {error}
        </motion.p>
      ) : hint ? (
        <p className="text-[11px] text-gray-400">{hint}</p>
      ) : null}
    </AnimatePresence>
  </div>
);

const TextField = ({ icon: Icon, label, name, required, error, hint, prefix, value, onChange, onBlur, ...props }) => (
  <FieldWrap label={label} required={required} error={error} hint={hint} id={`f-${name}`}>
    <div className={shell(error)}>
      <Icon size={16} className="shrink-0 text-gray-400 transition group-focus-within:text-red-500" />
      {prefix && <span className="-mr-1 text-sm font-semibold text-gray-400">{prefix}</span>}
      <input
        id={`f-${name}`}
        name={name}
        value={value ?? ""}
        onChange={onChange}
        onBlur={onBlur}
        aria-invalid={!!error}
        className="w-full min-w-0 bg-transparent py-3 text-sm font-semibold text-gray-900 placeholder:font-normal placeholder:text-gray-400 focus:outline-none"
        {...props}
      />
    </div>
  </FieldWrap>
);

const SelectField = ({ icon: Icon, label, name, required, error, hint, options, placeholder = "Select", value, onChange, onBlur, disabled }) => (
  <FieldWrap label={label} required={required} error={error} hint={hint} id={`f-${name}`}>
    <div className={`${shell(error)} relative`}>
      <Icon size={16} className="shrink-0 text-gray-400 transition group-focus-within:text-red-500" />
      <select
        id={`f-${name}`}
        name={name}
        value={value ?? ""}
        onChange={onChange}
        onBlur={onBlur}
        disabled={disabled}
        aria-invalid={!!error}
        className={`w-full min-w-0 cursor-pointer appearance-none bg-transparent py-3 pr-6 text-sm font-semibold focus:outline-none disabled:cursor-wait ${value ? "text-gray-900" : "text-gray-400"}`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value} className="text-gray-900">{o.label}</option>)}
      </select>
      <ChevronDown size={15} className="pointer-events-none absolute right-4 text-gray-400" />
    </div>
  </FieldWrap>
);

/* pill-style single choice (gender, role) */
const ChoiceField = ({ label, name, required, error, options, value, onPick }) => (
  <FieldWrap label={label} required={required} error={error} id={`f-${name}`}>
    <div role="radiogroup" aria-label={label} className={`flex gap-1.5 rounded-2xl bg-gray-50 p-1.5 ring-1 ${error ? "ring-red-300" : "ring-gray-200"}`}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onPick(name, o.value)}
            className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[13px] font-semibold transition ${
              on ? "text-white" : "text-gray-600 hover:bg-white hover:text-gray-900"
            }`}
          >
            {on && (
              <motion.span layoutId={`choice-${name}`} className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 shadow-md shadow-red-600/25"
                transition={{ type: "spring", stiffness: 420, damping: 34 }} />
            )}
            {o.icon && <o.icon size={14} className="relative" />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  </FieldWrap>
);

const Section = ({ icon: Icon, title, subtitle, step, done, total, children, i }) => (
  <motion.section
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0, transition: { delay: 0.1 + i * 0.06, duration: 0.45 } }}
    className="overflow-hidden rounded-3xl bg-white/90 shadow-[0_14px_40px_-18px_rgba(127,29,29,0.2)] ring-1 ring-white/70 backdrop-blur-sm"
  >
    <div className="flex items-center justify-between gap-3 border-b border-red-50 px-5 py-4 sm:px-7">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-md shadow-red-600/25">
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-600">Step {step}</p>
          <h3 className="truncate text-base font-extrabold tracking-tight text-gray-900">{title}</h3>
          {subtitle && <p className="truncate text-xs text-gray-400">{subtitle}</p>}
        </div>
      </div>
      {typeof total === "number" && total > 0 && (
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums ${done === total ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
          {done === total ? <span className="inline-flex items-center gap-1"><CheckCircle2 size={12} /> Done</span> : `${done}/${total}`}
        </span>
      )}
    </div>
    <div className="p-5 sm:p-7">{children}</div>
  </motion.section>
);

/* ================= PAGE ================= */
const Add = () => {
  const [departments, setDepartments] = useState([]);
  const [loadingDept, setLoadingDept] = useState(false);
  const [deptError, setDeptError] = useState("");
  const [formData, setFormData] = useState({});
  const [preview, setPreview] = useState(null);
  const [photoError, setPhotoError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const fileRef = useRef(null);
  const redirectRef = useRef(null);
  const navigate = useNavigate();

  const loadDepartments = async () => {
    try {
      setLoadingDept(true);
      setDeptError("");
      const data = await fetchDepartments();
      setDepartments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      setDeptError("Couldn't load departments.");
    } finally {
      setLoadingDept(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  // free the preview URL when it changes / on unmount
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);
  useEffect(() => () => clearTimeout(redirectRef.current), []);

  /* ---------- handlers ---------- */
  const setPhoto = (file) => {
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
    setFormData((p) => ({ ...p, profileImage: file }));
    setPreview(URL.createObjectURL(file));
  };

  const removePhoto = () => {
    setFormData((p) => {
      const { profileImage, ...rest } = p; // eslint-disable-line no-unused-vars
      return rest;
    });
    setPreview(null);
    setPhotoError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "profileImage") {
      setPhoto(files?.[0]);
      return;
    }
    setFormData((p) => ({ ...p, [name]: value }));
    if (submitError) setSubmitError("");
  };

  const pick = (name, value) => {
    setFormData((p) => ({ ...p, [name]: value }));
    setTouched((t) => ({ ...t, [name]: true }));
  };

  const handleBlur = (e) => setTouched((t) => ({ ...t, [e.target.name]: true }));

  /* ---------- derived ---------- */
  const errors = useMemo(() => validate(formData), [formData]);
  const errFor = (k) => ((touched[k] || submitted) ? errors[k] : "");
  const filled = (k) => !!String(formData[k] ?? "").trim() && !errors[k];
  const doneCount = REQUIRED.filter(filled).length;
  const progress = Math.round((doneCount / REQUIRED.length) * 100);
  const errorCount = Object.keys(errors).length;
  const isDirty = Object.keys(formData).length > 0;

  const deptName = departments.find((d) => d._id === formData.department)?.dep_name;
  const sectionDone = (keys) => keys.filter(filled).length;

  const personalKeys = ["name", "email", "dob", "gender", "maritalStatus", "bloodGroup"];
  const workKeys = ["employeeId", "department", "role", "designation", "experience", "salary"];

  /* ---------- submit ---------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setSubmitted(true);
    if (errorCount) {
      const first = [...REQUIRED, "aadharcard", "pancard"].find((k) => errors[k]);
      document.querySelector(`[data-field="f-${first}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById(`f-${first}`)?.focus({ preventScroll: true });
      return;
    }
    setLoading(true);
    setSubmitError("");
    const fd = new FormData();
    // `manager` is never sent: a manager is a Department assignment
    // (Departments -> Edit), not an employee field.
    Object.keys(formData)
      .filter((key) => key !== "manager")
      .forEach((key) => fd.append(key, formData[key]));
    try {
      const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/employee/add`, fd, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (res.data.success) {
        setShowAlert(true);
        redirectRef.current = setTimeout(() => navigate("/admin-dashboard/employees"), REDIRECT_MS);
      }
    } catch (error) {
      setSubmitError(apiErrorMessage(error, "Submission error"));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setLoading(false);
    }
  };

  const addAnother = () => {
    clearTimeout(redirectRef.current);
    setShowAlert(false);
    setFormData({});
    setPreview(null);
    setTouched({});
    setSubmitted(false);
    setPhotoError("");
    if (fileRef.current) fileRef.current.value = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goDirectory = () => {
    clearTimeout(redirectRef.current);
    navigate("/admin-dashboard/employees");
  };

  const goBack = () => {
    if (isDirty && !window.confirm("Discard this new employee? Anything you've entered will be lost.")) return;
    navigate(-1);
  };

  const v = (k) => formData[k];
  const common = (k) => ({ name: k, value: v(k), onChange: handleChange, onBlur: handleBlur, error: errFor(k) });

  return (
    <>
      <AnimatePresence>
        {showAlert && <SuccessAlert name={formData.name} email={formData.email} onDone={goDirectory} onAddAnother={addAnother} />}
      </AnimatePresence>

      <div className={`min-h-screen px-4 pb-16 pt-6 font-sans text-gray-700 sm:px-8 ${PAGE_BG}`}>
        <div className="mx-auto max-w-6xl">
          {/* ================= TOP ROW ================= */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-6 flex items-center justify-between gap-3">
            <button
              onClick={goBack}
              className="group inline-flex items-center gap-2 rounded-2xl bg-white/80 px-3.5 py-2.5 text-sm font-semibold text-gray-600 shadow-sm ring-1 ring-red-100 transition hover:text-red-600 hover:ring-red-200"
            >
              <ChevronLeft size={17} className="transition-transform group-hover:-translate-x-0.5" />
              Back to employees
            </button>
            <span className="hidden items-center gap-1.5 text-xs font-medium text-gray-400 sm:flex">
              Employees <ChevronRight size={12} /> <span className="font-semibold text-red-600">New</span>
            </span>
          </motion.div>

          {/* ================= HEADER ================= */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }} className="mb-6 flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/30">
              <UserPlus size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">People</p>
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
                Add a new <span className="text-red-600">employee</span>
              </h1>
              <p className="mt-0.5 text-sm text-gray-500">They'll get an email to set their own password once you're done.</p>
            </div>
          </motion.div>

          <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* ================= LEFT: PHOTO + PREVIEW (sticky) ================= */}
            <motion.aside
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08 }}
              className="space-y-6 lg:sticky lg:top-24 lg:col-span-4 lg:self-start"
            >
              <div className="overflow-hidden rounded-3xl bg-white/90 shadow-[0_20px_50px_-20px_rgba(127,29,29,0.25)] ring-1 ring-white/70 backdrop-blur-sm">
                <div className="relative h-24 bg-gradient-to-br from-red-600 via-rose-600 to-rose-500">
                  <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
                </div>
                <div className="-mt-14 px-6 pb-6 text-center">
                  {/* photo drop zone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); setPhoto(e.dataTransfer.files?.[0]); }}
                    className="relative mx-auto h-28 w-28"
                  >
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      aria-label={preview ? "Change photo" : "Upload photo"}
                      className={`group relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-[2rem] bg-white p-1 shadow-xl ring-4 transition ${
                        dragOver ? "ring-red-400" : "ring-white"
                      }`}
                    >
                      {preview ? (
                        <img src={preview} alt="Profile preview" className="h-full w-full rounded-[1.7rem] object-cover" />
                      ) : formData.name ? (
                        <span className={`flex h-full w-full items-center justify-center rounded-[1.7rem] bg-gradient-to-br text-3xl font-extrabold text-white ${colorFor(formData.name)}`}>
                          {initials(formData.name)}
                        </span>
                      ) : (
                        <span className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-[1.7rem] border-2 border-dashed border-red-200 bg-red-50/60 text-red-400">
                          <Upload size={22} />
                          <span className="text-[10px] font-bold">Add photo</span>
                        </span>
                      )}
                      <span className="absolute inset-1 flex items-center justify-center rounded-[1.7rem] bg-gray-900/50 text-white opacity-0 transition group-hover:opacity-100">
                        <Camera size={22} />
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      aria-hidden
                      tabIndex={-1}
                      className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/30 ring-2 ring-white"
                    >
                      <Camera size={15} />
                    </button>
                    <input ref={fileRef} type="file" name="profileImage" accept="image/*" className="hidden" onChange={handleChange} />
                  </div>

                  <div className="mt-2 flex min-h-[20px] items-center justify-center gap-3 text-[11px]">
                    {preview ? (
                      <button type="button" onClick={removePhoto} className="inline-flex items-center gap-1 font-semibold text-gray-400 transition hover:text-red-600">
                        <Trash2 size={12} /> Remove photo
                      </button>
                    ) : (
                      <span className="text-gray-400">JPG, PNG or WebP · up to 5 MB</span>
                    )}
                  </div>
                  <AnimatePresence>
                    {photoError && (
                      <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="mt-1 flex items-center justify-center gap-1 text-[11px] font-semibold text-red-600">
                        <AlertCircle size={12} /> {photoError}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  {/* live preview */}
                  <p className={`mt-4 truncate text-xl font-extrabold tracking-tight ${formData.name ? "text-gray-900" : "text-gray-300"}`}>
                    {formData.name || "Employee name"}
                  </p>
                  <p className={`truncate text-sm ${formData.designation ? "text-gray-500" : "text-gray-300"}`}>
                    {formData.designation || "Designation"}
                  </p>
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                    {formData.employeeId && (
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-gray-600">{formData.employeeId}</span>
                    )}
                    {deptName && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-700">
                        <Building2 size={11} /> {deptName}
                      </span>
                    )}
                    {formData.role && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold capitalize text-amber-700">
                        <ShieldCheck size={11} /> {formData.role}
                      </span>
                    )}
                  </div>
                  {formData.email && (
                    <p className="mt-2 flex items-center justify-center gap-1.5 truncate text-xs text-gray-400">
                      <Mail size={12} className="shrink-0" /> <span className="truncate">{formData.email}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* progress */}
              <div className="rounded-3xl bg-white/85 p-5 shadow-[0_10px_30px_-14px_rgba(127,29,29,0.18)] ring-1 ring-white/70 backdrop-blur-sm">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Form progress</p>
                  <p className={`text-sm font-extrabold tabular-nums ${progress === 100 ? "text-emerald-600" : "text-gray-900"}`}>{progress}%</p>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
                  <motion.div
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className={`h-full rounded-full bg-gradient-to-r ${progress === 100 ? "from-emerald-500 to-teal-400" : "from-red-600 to-rose-400"}`}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {doneCount} of {REQUIRED.length} required fields complete
                </p>
              </div>
            </motion.aside>

            {/* ================= RIGHT: SECTIONS ================= */}
            <div className="space-y-6 lg:col-span-8">
              <AnimatePresence>
                {submitError && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div role="alert" className="flex items-start gap-3 rounded-2xl bg-red-50 p-4 ring-1 ring-red-100">
                      <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-red-800">Couldn't add this employee</p>
                        <p className="text-sm text-red-700">{submitError}</p>
                      </div>
                      <button type="button" onClick={() => setSubmitError("")} aria-label="Dismiss" className="text-red-400 hover:text-red-700">
                        <X size={16} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* STEP 1 */}
              <Section i={0} step={1} icon={User} title="Personal details" subtitle="Who they are and how to reach them"
                done={sectionDone(personalKeys)} total={personalKeys.length}>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <TextField icon={User} label="Full name" required placeholder="e.g. Priya Sharma" autoComplete="off" {...common("name")} />
                  <TextField icon={Mail} label="Email address" type="email" required placeholder="name@company.com"
                    hint="We'll send their sign-in invite here." autoComplete="off" {...common("email")} />
                  <TextField icon={Calendar} label="Date of birth" type="date" required max={todayISO()} {...common("dob")} />
                  <SelectField icon={Droplet} label="Blood group" required
                    options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => ({ label: g, value: g }))}
                    {...common("bloodGroup")} />
                  <ChoiceField label="Gender" name="gender" required error={errFor("gender")} value={v("gender")} onPick={pick}
                    options={[{ label: "Male", value: "Male" }, { label: "Female", value: "Female" }, { label: "Other", value: "Other" }]} />
                  <SelectField icon={Heart} label="Marital status" required
                    options={["Single", "Married", "Divorced", "Widowed"].map((s) => ({ label: s, value: s }))}
                    {...common("maritalStatus")} />
                </div>
              </Section>

              {/* STEP 2 */}
              <Section i={1} step={2} icon={Briefcase} title="Work & pay" subtitle="Their role in the organisation"
                done={sectionDone(workKeys)} total={workKeys.length}>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <TextField icon={IdCard} label="Employee ID" required placeholder="e.g. 1024" autoComplete="off" {...common("employeeId")} />
                  <TextField icon={Briefcase} label="Designation" required placeholder="e.g. Event Coordinator" {...common("designation")} />
                  <div className="min-w-0">
                    <SelectField icon={Building2} label="Department" required
                      options={departments.map((d) => ({ label: d.dep_name, value: d._id }))}
                      placeholder={loadingDept ? "Loading departments…" : departments.length ? "Select a department" : "No departments yet"}
                      disabled={loadingDept}
                      {...common("department")} />
                    {deptError && (
                      <button type="button" onClick={loadDepartments} className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:underline">
                        <AlertCircle size={12} /> {deptError} Try again
                      </button>
                    )}
                  </div>
                  <ChoiceField label="System role" name="role" required error={errFor("role")} value={v("role")} onPick={pick}
                    options={[{ label: "Employee", value: "employee", icon: User }, { label: "Admin", value: "admin", icon: ShieldCheck }]} />
                  <TextField icon={Clock} label="Experience (years)" type="number" min="0" step="0.5" inputMode="decimal" required placeholder="e.g. 3" {...common("experience")} />
                  <TextField icon={IndianRupee} label="Annual salary" type="number" min="0" inputMode="numeric" required placeholder="e.g. 600000"
                    hint={v("salary") && !errors.salary ? `≈ ₹${Number(v("salary")).toLocaleString("en-IN")} per year` : undefined}
                    {...common("salary")} />
                </div>
                {v("role") === "admin" && (
                  <div className="mt-5 flex items-start gap-2.5 rounded-2xl bg-amber-50 p-3.5 ring-1 ring-amber-200">
                    <ShieldCheck size={16} className="mt-0.5 shrink-0 text-amber-600" />
                    <p className="text-xs leading-relaxed text-amber-900">
                      <b>Admin access</b> lets this person manage employees, departments and settings. Only choose it for people who need it.
                    </p>
                  </div>
                )}
              </Section>

              {/* STEP 3 */}
              <Section i={2} step={3} icon={CreditCard} title="Identity documents" subtitle="Optional — you can add these later">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                  <TextField icon={IdCard} label="Aadhaar number" placeholder="1234 5678 9012" inputMode="numeric" autoComplete="off" {...common("aadharcard")} />
                  <TextField icon={CreditCard} label="PAN number" placeholder="ABCDE1234F" autoComplete="off" style={{ textTransform: "uppercase" }} {...common("pancard")} />
                  <TextField icon={Landmark} label="PF number" placeholder="PF account no." autoComplete="off" {...common("pfNumber")} />
                </div>
              </Section>

              {/* ACTIONS */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 0.3 } }}
                className="sticky bottom-4 z-20 flex flex-col-reverse gap-3 rounded-3xl bg-white/95 p-4 shadow-[0_20px_50px_-15px_rgba(127,29,29,0.35)] ring-1 ring-red-100 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <p className="text-center text-xs text-gray-500 sm:text-left">
                  {submitted && errorCount ? (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-red-600">
                      <AlertCircle size={13} /> Fix {errorCount} {errorCount === 1 ? "field" : "fields"} to continue
                    </span>
                  ) : progress === 100 ? (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600">
                      <CheckCircle2 size={13} /> All set — ready to onboard
                    </span>
                  ) : (
                    <>Fields marked <span className="font-bold text-red-500">*</span> are required</>
                  )}
                </p>
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  <button type="button" onClick={goBack} className="rounded-2xl px-5 py-3.5 text-sm font-bold text-gray-500 transition hover:bg-gray-50 hover:text-gray-900">
                    Discard
                  </button>
                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-80"
                  >
                    {loading ? (
                      <><Loader2 size={17} className="animate-spin" /> Onboarding…</>
                    ) : (
                      <><UserPlus size={17} /> Complete onboarding</>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default Add;
