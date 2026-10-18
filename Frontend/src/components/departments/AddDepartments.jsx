import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiErrorMessage } from "../../utils/apiError";
import {
  Building2, FileText, ChevronLeft, Plus, Loader2, CheckCircle2, AlertCircle, Users,
  UserCog, Sparkles, ArrowRight, X, Eye,
} from "lucide-react";

const PAGE_BG = "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const NAME_MAX = 60;
const DESC_MAX = 500;
const SUGGESTIONS = ["Human Resources", "Finance", "Marketing", "Operations", "IT Support", "Sales"];

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

/* ================= SUCCESS MODAL ================= */
const SuccessAlert = ({ name, onDone, onAddAnother }) => {
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
          <h3 className="text-xl font-extrabold tracking-tight text-gray-900">Department added</h3>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            <b className="text-gray-900">{name}</b> is now on record and ready to be staffed.
          </p>
        </div>
        <div className="space-y-2.5 p-7 pt-5">
          <button
            onClick={onDone}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:-translate-y-0.5 active:scale-[0.98]"
          >
            Go to departments <ArrowRight size={16} />
          </button>
          <button
            onClick={onAddAnother}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-50 py-3.5 text-sm font-bold text-gray-600 ring-1 ring-gray-200 transition hover:bg-white hover:text-gray-900 active:scale-[0.98]"
          >
            <Plus size={16} /> Add another
          </button>
        </div>
      </motion.div>
    </div>
  );
};

/* ================= FIELD SHELL ================= */
const Field = ({ label, hint, count, max, error, children }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between gap-3">
      <label className="text-sm font-bold text-gray-900">{label}</label>
      {hint && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-600">{hint}</span>}
    </div>
    {children}
    <div className="flex min-h-[16px] items-center justify-between gap-3 text-[11px]">
      <AnimatePresence mode="wait">
        {error ? (
          <motion.span key="err" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-1 font-semibold text-red-600">
            <AlertCircle size={12} /> {error}
          </motion.span>
        ) : (
          <span key="ok" />
        )}
      </AnimatePresence>
      {typeof count === "number" && (
        <span className={`ml-auto tabular-nums font-medium ${count > max * 0.9 ? "text-amber-600" : "text-gray-400"}`}>
          {count}/{max}
        </span>
      )}
    </div>
  </div>
);

/* ================= MAIN COMPONENT ================= */
const AddDepartments = () => {
  const [department, setDepartment] = useState({ dep_name: "", description: "" });
  const [touched, setTouched] = useState({ dep_name: false, description: false });
  const [loading, setLoading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  const [savedName, setSavedName] = useState("");
  const [error, setError] = useState("");
  const nameRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const name = department.dep_name.trim();
  const desc = department.description.trim();
  const nameError = touched.dep_name && !name ? "Please enter a department name." : "";
  const descError = touched.description && !desc ? "Please add a short description." : "";
  const isValid = !!name && !!desc;
  const isDirty = !!department.dep_name || !!department.description;

  const handleChange = (e) => {
    const { name: field, value } = e.target;
    const max = field === "dep_name" ? NAME_MAX : DESC_MAX;
    setDepartment((d) => ({ ...d, [field]: value.slice(0, max) }));
    if (error) setError("");
  };

  const handleBlur = (e) => setTouched((t) => ({ ...t, [e.target.name]: true }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ dep_name: true, description: true });
    if (loading || !isValid) return;
    setLoading(true);
    setError("");

    try {
      // No manager on create: a manager must be an active member of the
      // department, so it is assigned from "Edit department" later.
      const res = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/api/department/add`,
        { dep_name: name, description: department.description },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );

      if (res.data.success) {
        setSavedName(name);
        setShowAlert(true);
      }
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to create department"));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setShowAlert(false);
    setDepartment({ dep_name: "", description: "" });
    setTouched({ dep_name: false, description: false });
    setTimeout(() => nameRef.current?.focus(), 50);
  };

  const goBack = () => {
    if (isDirty && !showAlert && !window.confirm("Discard this new department?")) return;
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
          <SuccessAlert name={savedName} onDone={() => navigate("/admin-dashboard/departments")} onAddAnother={resetForm} />
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
              Back to departments
            </button>
            <span className="hidden items-center gap-1.5 text-xs font-medium text-gray-400 sm:flex">
              Departments <ArrowRight size={12} /> <span className="font-semibold text-red-600">New</span>
            </span>
          </motion.div>

          {/* ================= HEADER ================= */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.05 }} className="mb-6 flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/30">
              <Building2 size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600">Organisation</p>
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
                Add a <span className="text-red-600">department</span>
              </h1>
              <p className="mt-0.5 text-sm text-gray-500">Create a new team. You can add people and a manager next.</p>
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
              <div className="space-y-5 p-6 sm:p-8">
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-start gap-3 rounded-2xl bg-red-50 p-4 ring-1 ring-red-100">
                        <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" />
                        <p className="flex-1 text-sm font-medium text-red-700">{error}</p>
                        <button type="button" onClick={() => setError("")} aria-label="Dismiss" className="text-red-400 hover:text-red-700">
                          <X size={16} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* name */}
                <Field label="Department name" hint="Required" count={department.dep_name.length} max={NAME_MAX} error={nameError}>
                  <div className={`${inputShell(!!nameError)} items-center gap-3 px-4`}>
                    <Building2 size={17} className="shrink-0 text-gray-400 transition group-focus-within:text-red-500" />
                    <input
                      ref={nameRef}
                      name="dep_name"
                      value={department.dep_name}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="e.g. Human Resources"
                      autoComplete="off"
                      aria-invalid={!!nameError}
                      className="w-full bg-transparent py-3.5 text-[15px] font-semibold text-gray-900 placeholder:font-normal placeholder:text-gray-400 focus:outline-none"
                    />
                  </div>
                </Field>

                {/* quick suggestions */}
                {!department.dep_name && (
                  <div className="-mt-3 flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1 text-[11px] font-medium text-gray-400">
                      <Sparkles size={12} className="text-amber-500" /> Quick pick:
                    </span>
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => { setDepartment((d) => ({ ...d, dep_name: s })); setTouched((t) => ({ ...t, dep_name: true })); }}
                        className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600 ring-1 ring-gray-200 transition hover:bg-red-50 hover:text-red-700 hover:ring-red-200"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                {/* description */}
                <Field label="Description" hint="Required" count={department.description.length} max={DESC_MAX} error={descError}>
                  <div className={`${inputShell(!!descError)} items-start gap-3 px-4 py-3.5`}>
                    <FileText size={17} className="mt-0.5 shrink-0 text-gray-400 transition group-focus-within:text-red-500" />
                    <textarea
                      rows={5}
                      name="description"
                      value={department.description}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="What is this department responsible for? e.g. Hiring, onboarding and employee wellbeing."
                      aria-invalid={!!descError}
                      className="w-full resize-none bg-transparent text-[15px] leading-relaxed text-gray-900 placeholder:text-gray-400 focus:outline-none"
                    />
                  </div>
                </Field>

                {/* manager note */}
                <div className="flex items-start gap-3 rounded-2xl bg-sky-50/80 p-4 ring-1 ring-sky-100">
                  <UserCog size={18} className="mt-0.5 shrink-0 text-sky-600" />
                  <p className="text-xs leading-relaxed text-sky-900">
                    <b>About the manager:</b> a manager must already belong to this department, so you'll assign one
                    after adding employees, from <b>Departments → Edit</b>.
                  </p>
                </div>
              </div>

              {/* actions */}
              <div className="flex flex-col-reverse gap-3 border-t border-red-50 bg-gray-50/60 p-5 sm:flex-row sm:items-center sm:justify-end sm:px-8">
                <button
                  type="button"
                  onClick={goBack}
                  className="rounded-2xl px-5 py-3.5 text-sm font-bold text-gray-500 transition hover:bg-white hover:text-gray-900"
                >
                  Cancel
                </button>
                <motion.button
                  type="submit"
                  disabled={loading}
                  whileTap={{ scale: 0.98 }}
                  className={`flex items-center justify-center gap-2.5 rounded-2xl px-6 py-3.5 text-sm font-bold text-white transition ${
                    isValid
                      ? "bg-gradient-to-r from-red-600 to-rose-500 shadow-lg shadow-red-600/30 hover:-translate-y-0.5 hover:shadow-xl"
                      : "bg-gray-300"
                  } disabled:cursor-not-allowed disabled:opacity-80`}
                >
                  {loading ? (
                    <>
                      <Loader2 size={17} className="animate-spin" /> Adding department…
                    </>
                  ) : (
                    <>
                      <Plus size={17} /> Add department
                    </>
                  )}
                </motion.button>
              </div>
            </motion.form>

            {/* ================= SIDE: PREVIEW + NEXT STEPS ================= */}
            <motion.aside
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.18 }}
              className="space-y-6 lg:col-span-2"
            >
              {/* live preview */}
              <div className="rounded-3xl bg-white/85 p-5 shadow-[0_10px_30px_-14px_rgba(127,29,29,0.18)] ring-1 ring-white/70 backdrop-blur-sm">
                <p className="mb-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  <Eye size={13} /> Live preview
                </p>
                <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-gray-100">
                  <motion.div layout className={`h-1.5 bg-gradient-to-r ${name ? colorFor(name) : "from-gray-200 to-gray-300"}`} />
                  <div className="p-4">
                    <div className="flex items-center gap-3">
                      <motion.div
                        key={initials(name)}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-sm font-bold text-white shadow-md ${
                          name ? colorFor(name) : "from-gray-300 to-gray-400"
                        }`}
                      >
                        {name ? initials(name) : <Building2 size={18} />}
                      </motion.div>
                      <div className="min-w-0">
                        <p className={`truncate text-base font-bold ${name ? "text-gray-900" : "text-gray-300"}`}>
                          {name || "Department name"}
                        </p>
                        <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                          <Users size={10} /> 0 members
                        </span>
                      </div>
                    </div>
                    <p className={`mt-3 line-clamp-3 text-sm leading-relaxed ${desc ? "text-gray-600" : "text-gray-300"}`}>
                      {desc || "Your description will appear here."}
                    </p>
                    <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-[11px] font-semibold text-gray-400">
                      Manager: not assigned yet
                    </div>
                  </div>
                </div>
              </div>

              {/* what happens next */}
              <div className="rounded-3xl bg-white/85 p-5 shadow-[0_10px_30px_-14px_rgba(127,29,29,0.18)] ring-1 ring-white/70 backdrop-blur-sm">
                <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-gray-400">What happens next</p>
                <ol className="space-y-4">
                  {[
                    { icon: Building2, title: "Create the department", text: "Give it a clear name and purpose.", done: isValid },
                    { icon: Users, title: "Add employees", text: "Assign people to it from the Employees page." },
                    { icon: UserCog, title: "Choose a manager", text: "Pick one of its members under Edit department." },
                  ].map((s, i) => (
                    <li key={s.title} className="flex gap-3">
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition ${
                          s.done
                            ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/30"
                            : i === 0
                            ? "bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-md shadow-red-600/30"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {s.done ? <CheckCircle2 size={15} /> : i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{s.title}</p>
                        <p className="text-xs text-gray-500">{s.text}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </motion.aside>
          </div>
        </div>
      </div>
    </>
  );
};

export default AddDepartments;