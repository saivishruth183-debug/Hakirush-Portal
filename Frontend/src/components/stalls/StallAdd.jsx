import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, Plus, CheckCircle2, ArrowLeft, Store, UploadCloud, Trash2, AlertTriangle,
  Loader2, X, Check, Sparkles, Hash, Tag, CalendarCheck2, ClipboardList, GripVertical,
} from "lucide-react";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // matches server limit (5MB)
const REDIRECT_MS = 1800;

const PAGE_BG =
  "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const CARD =
  "rounded-3xl bg-white/90 ring-1 ring-white/70 shadow-[0_10px_40px_-12px_rgba(127,29,29,0.18)] backdrop-blur";

const TYPE_HINTS = ["Premium", "Standard", "Food", "Merchandise", "Sponsor booth"];

const initials = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

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
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => dismissable && onClose?.()} />
      <motion.div role="dialog" aria-modal="true"
        initial={{ y: 40, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 30, opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white p-7 text-center shadow-2xl ring-1 ring-gray-100">
        {children}
      </motion.div>
    </motion.div>,
    document.body
  );
};

/* ================= SUCCESS ALERT ================= */
const SuccessAlert = ({ name, onGo }) => (
  <Modal dismissable={false}>
    <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400" />
    <motion.div initial={{ scale: 0.4, rotate: -15 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}
      className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
      <CheckCircle2 size={30} strokeWidth={2.2} />
    </motion.div>
    <h3 className="text-xl font-extrabold tracking-tight text-gray-900">Stall added</h3>
    <p className="mt-2 text-sm text-gray-500">
      <span className="font-semibold text-gray-800">{name || "The stall"}</span> is now in the stall registry.
    </p>
    <div className="mt-5 h-1 overflow-hidden rounded-full bg-gray-100">
      <motion.div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400" initial={{ width: "0%" }} animate={{ width: "100%" }}
        transition={{ duration: REDIRECT_MS / 1000, ease: "linear" }} />
    </div>
    <p className="mt-2 text-[11px] text-gray-400">Taking you to the stall list…</p>
    <button onClick={onGo}
      className="mt-5 w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 transition hover:brightness-110 active:scale-[0.98]">
      Go to list now
    </button>
  </Modal>
);

const ErrorAlert = ({ title, message, onClose }) => (
  <Modal onClose={onClose}>
    <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-red-600 to-rose-400" />
    <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
    <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}
      className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100">
      <AlertTriangle size={28} />
    </motion.div>
    <h3 className="text-xl font-extrabold tracking-tight text-gray-900">{title}</h3>
    <p className="mt-2 text-sm leading-relaxed text-gray-500">{message}</p>
    <button onClick={onClose}
      className="mt-6 w-full rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:brightness-110">
      Got it
    </button>
  </Modal>
);

const StallAdd = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    number: "",
    type: "",
    eventCount: "",
    plans: [""],
    logo: null,
  });

  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  // UI-only
  const [error, setError] = useState(null);
  const [touched, setTouched] = useState({});
  const [dragOver, setDragOver] = useState(false);
  const [planKeys, setPlanKeys] = useState([0]);
  const nextKey = useRef(1);
  const planRefs = useRef({});
  const fileRef = useRef(null);
  const redirectRef = useRef(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => () => clearTimeout(redirectRef.current), []);

  const pickLogo = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError({ title: "Wrong file type", message: "Please choose an image (PNG, JPG, SVG or WebP) for the stall logo." });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError({ title: "Logo too large", message: "The stall logo must be 5 MB or smaller." });
      return;
    }
    setForm((p) => ({ ...p, logo: file }));
    setPreview(URL.createObjectURL(file));
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "logo") {
      pickLogo(files?.[0]);
      e.target.value = "";
      return;
    }
    setForm((p) => ({ ...p, [name]: value }));
  };
  const setField = (name, value) => setForm((p) => ({ ...p, [name]: value }));
  const touch = (e) => setTouched((t) => ({ ...t, [e.target.name]: true }));

  const removeLogo = () => {
    setForm((p) => ({ ...p, logo: null }));
    setPreview(null);
  };

  const handlePlanChange = (idx, value) => {
    const plans = [...form.plans];
    plans[idx] = value;
    setForm((p) => ({ ...p, plans }));
  };

  const addPlan = (focus = true) => {
    const key = nextKey.current++;
    setForm((p) => ({ ...p, plans: [...p.plans, ""] }));
    setPlanKeys((k) => [...k, key]);
    if (focus) setTimeout(() => planRefs.current[key]?.focus(), 30);
  };
  const removePlan = (idx) => {
    setForm((p) => ({ ...p, plans: p.plans.filter((_, i) => i !== idx) }));
    setPlanKeys((k) => k.filter((_, i) => i !== idx));
  };

  const errors = {
    name: !form.name.trim() ? "Stall name is required" : "",
    number: !String(form.number).trim() ? "Stall number is required" : "",
    type: !form.type.trim() ? "Stall type is required" : "",
    eventCount: form.eventCount !== "" && (!Number.isInteger(Number(form.eventCount)) || Number(form.eventCount) < 0) ? "Use a whole number, 0 or more" : "",
  };
  const showErr = (k) => touched[k] && errors[k];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setTouched({ name: true, number: true, type: true, eventCount: true });
    const firstErr = Object.values(errors).find(Boolean);
    if (firstErr) {
      setError({ title: "Check the form", message: `${firstErr}.` });
      return;
    }
    setLoading(true);

    try {
      const fd = new FormData();
      Object.keys(form).forEach((key) => {
        if (key === "plans") {
          form.plans.forEach((p) => fd.append("plans", p));
        } else if (form[key] !== undefined && form[key] !== null && form[key] !== "") {
          fd.append(key, form[key]);
        }
      });

      const res = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/api/stalls`,
        fd,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );

      if (res.data?.success) {
        setShowAlert(true);
        redirectRef.current = setTimeout(() => navigate("/admin-dashboard/stalls"), REDIRECT_MS);
      }
    } catch (err) {
      setError({ title: "Couldn't add stall", message: err.response?.data?.error || "Failed to add stall" });
    } finally {
      setLoading(false);
    }
  };

  const goNow = () => { clearTimeout(redirectRef.current); navigate("/admin-dashboard/stalls"); };

  /* progress */
  const filledPlans = form.plans.filter((p) => p.trim()).length;
  const checks = [
    ["Name", !errors.name],
    ["Number", !errors.number],
    ["Type", !errors.type],
    ["Logo", !!form.logo],
    ["Plans", filledPlans > 0],
  ];
  const done = checks.filter(([, ok]) => ok).length;
  const pct = Math.round((done / checks.length) * 100);
  const emptyPlans = form.plans.length - filledPlans;

  return (
    <div className={`min-h-screen ${PAGE_BG} p-4 pb-16 text-gray-900 sm:p-6 lg:p-8`}>
      <AnimatePresence>
        {showAlert && <SuccessAlert key="ok" name={form.name} onGo={goNow} />}
        {error && <ErrorAlert key="err" title={error.title} message={error.message} onClose={() => setError(null)} />}
      </AnimatePresence>

      <div className="mx-auto max-w-6xl">
        {/* HEADER */}
        <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <button onClick={() => navigate(-1)}
            className="group mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-gray-500 ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200">
            <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" /> Back
          </button>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/30">
                <Store size={24} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-500">Stalls</p>
                <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                  New <span className="bg-gradient-to-r from-red-600 to-rose-500 bg-clip-text text-transparent">Stall</span>
                </h1>
                <p className="text-sm text-gray-500">Register a stall, its type and the plans it runs.</p>
              </div>
            </div>
            <div className="w-full sm:w-56">
              <div className="mb-1 flex justify-between text-xs font-semibold">
                <span className="text-gray-500">Profile complete</span>
                <span className="text-red-600">{pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white ring-1 ring-gray-200">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-red-600 to-rose-500" animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
              </div>
            </div>
          </div>
        </motion.header>

        <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* ============ LEFT: LOGO + PREVIEW ============ */}
          <aside className="space-y-5 lg:col-span-4">
            <div className="space-y-5 lg:sticky lg:top-6">
              <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={`${CARD} p-5`}>
                <SectionTitle icon={<Camera size={15} />} title="Stall logo" subtitle="Optional · shown in the registry" />
                <div
                  role="button" tabIndex={0}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), fileRef.current?.click())}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); pickLogo(e.dataTransfer.files?.[0]); }}
                  onClick={() => fileRef.current?.click()}
                  className={`group relative mt-4 flex cursor-pointer flex-col items-center rounded-3xl border-2 border-dashed p-6 text-center outline-none transition focus-visible:ring-2 focus-visible:ring-red-400 ${
                    dragOver ? "border-red-400 bg-red-50/70" : preview ? "border-transparent bg-gray-50/70" : "border-gray-200 hover:border-red-300 hover:bg-red-50/30"
                  }`}
                >
                  <motion.div animate={dragOver ? { scale: 1.06 } : { scale: 1 }} className="relative">
                    <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl bg-white shadow-md ring-4 ring-white">
                      {preview ? (
                        <img src={preview} alt="Logo preview" className="h-full w-full object-cover" />
                      ) : (
                        <UploadCloud size={30} className="text-gray-300 transition group-hover:text-red-400" />
                      )}
                    </div>
                    <span className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/30 transition group-hover:scale-110">
                      <Camera size={15} />
                    </span>
                  </motion.div>
                  <p className="mt-4 text-sm font-semibold text-gray-700">{dragOver ? "Drop to add" : preview ? "Change logo" : "Drop logo or click to upload"}</p>
                  <p className="text-xs text-gray-400">PNG, JPG, SVG · max 5 MB</p>
                  <input ref={fileRef} type="file" name="logo" accept="image/*" className="hidden" onChange={handleChange} />
                </div>
                {form.logo && (
                  <div className="mt-3 flex items-center justify-between rounded-2xl bg-emerald-50 px-3 py-2 text-xs ring-1 ring-emerald-100">
                    <span className="flex min-w-0 items-center gap-1.5 font-medium text-emerald-700">
                      <CheckCircle2 size={14} className="shrink-0" /> <span className="truncate">{form.logo.name}</span>
                    </span>
                    <button type="button" onClick={removeLogo} aria-label="Remove logo" className="rounded-lg p-1 text-emerald-700 hover:bg-white hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </motion.section>

              {/* Live preview */}
              <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 p-5 text-white shadow-[0_20px_50px_-15px_rgba(220,38,38,0.55)]">
                <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/15 blur-2xl" />
                <p className="relative mb-4 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/80"><Sparkles size={12} /> Registry preview</p>
                <div className="relative flex items-center gap-3">
                  <div className="relative shrink-0">
                    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white/20 text-lg font-bold ring-2 ring-white/40">
                      {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : initials(form.name) || <Store size={22} />}
                    </div>
                    {String(form.number).trim() && (
                      <span className="absolute -bottom-1.5 -right-1.5 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold text-red-600 shadow">{form.number}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-extrabold">{form.name.trim() || "Stall name"}</p>
                    <p className="flex items-center gap-1 truncate text-xs text-white/85">
                      <Tag size={12} className="shrink-0" /> {form.type.trim() || "Stall type"}
                    </p>
                  </div>
                </div>
                <div className="relative mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
                    <p className="text-[10px] uppercase tracking-wider text-white/70">Events</p>
                    <p className="truncate text-sm font-bold">{form.eventCount !== "" ? form.eventCount : "—"}</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
                    <p className="text-[10px] uppercase tracking-wider text-white/70">Plans</p>
                    <p className="truncate text-sm font-bold">{filledPlans || "—"}</p>
                  </div>
                </div>
                <ul className="relative mt-4 flex flex-wrap gap-1.5">
                  {checks.map(([lbl, ok]) => (
                    <li key={lbl} className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${ok ? "bg-white text-red-600" : "bg-white/15 text-white/80"}`}>
                      {ok ? <Check size={11} strokeWidth={3} /> : <span className="h-1.5 w-1.5 rounded-full bg-white/60" />} {lbl}
                    </li>
                  ))}
                </ul>
              </motion.section>
            </div>
          </aside>

          {/* ============ RIGHT: FORM ============ */}
          <div className="space-y-5 lg:col-span-8">
            {/* Identification */}
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`${CARD} p-5 sm:p-6`}>
              <SectionTitle icon={<Store size={15} />} title="Stall details" subtitle="Name, number and what kind of stall it is" />
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_12rem]">
                <Field label="Stall name" icon={Store} required error={showErr("name")}>
                  <input name="name" value={form.name} onChange={handleChange} onBlur={touch} placeholder="e.g. Fresh Juice Corner" className={inputCls(showErr("name"))} />
                </Field>
                <Field label="Stall number" icon={Hash} required error={showErr("number")}>
                  <input name="number" value={form.number} onChange={handleChange} onBlur={touch} placeholder="ST-001" className={`${inputCls(showErr("number"))} font-mono uppercase`} />
                </Field>
              </div>

              <div className="mt-4">
                <Field label="Stall type" icon={Tag} required error={showErr("type")}>
                  <input name="type" value={form.type} onChange={handleChange} onBlur={touch} placeholder="Premium / Standard" className={inputCls(showErr("type"))} />
                </Field>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {TYPE_HINTS.map((h) => (
                    <button key={h} type="button" onClick={() => { setField("type", h); setTouched((t) => ({ ...t, type: true })); }}
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${form.type === h ? "bg-red-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600"}`}>
                      {h}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 md:max-w-xs">
                <Field label="Events (operation load)" icon={CalendarCheck2} error={showErr("eventCount")}
                  action={
                    <div className="flex overflow-hidden rounded-full ring-1 ring-gray-200">
                      {[-1, 1].map((d) => (
                        <button key={d} type="button" aria-label={d < 0 ? "Decrease" : "Increase"}
                          onClick={() => setField("eventCount", String(Math.max(0, (parseInt(form.eventCount, 10) || 0) + d)))}
                          className="px-2 py-0.5 text-xs font-bold text-gray-500 transition hover:bg-red-50 hover:text-red-600">
                          {d < 0 ? "−" : "+"}
                        </button>
                      ))}
                    </div>
                  }>
                  <input type="number" name="eventCount" min="0" step="1" inputMode="numeric" value={form.eventCount}
                    onChange={handleChange} onBlur={touch} onWheel={(e) => e.currentTarget.blur()} placeholder="0"
                    className={`${inputCls(showErr("eventCount"))} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none`} />
                </Field>
              </div>
            </motion.section>

            {/* Plans */}
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className={`${CARD} p-5 sm:p-6`}>
              <div className="flex items-center justify-between gap-3">
                <SectionTitle icon={<ClipboardList size={15} />} title="Operational plans" subtitle="What this stall offers or runs" />
                <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold tabular-nums text-gray-500">
                  {filledPlans} plan{filledPlans === 1 ? "" : "s"}
                </span>
              </div>

              <ul className="mt-5 space-y-2.5">
                <AnimatePresence initial={false}>
                  {form.plans.map((plan, idx) => {
                    const key = planKeys[idx];
                    return (
                      <motion.li key={key} layout
                        initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: -20, height: 0, marginTop: 0 }}
                        className="group flex items-center gap-2">
                        <span className="flex h-11 w-9 shrink-0 items-center justify-center text-gray-300">
                          <GripVertical size={16} className="hidden sm:block" />
                        </span>
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold transition ${plan.trim() ? "bg-gradient-to-br from-red-600 to-rose-500 text-white shadow shadow-red-600/30" : "bg-gray-100 text-gray-400"}`}>
                          {idx + 1}
                        </span>
                        <input
                          ref={(el) => { planRefs.current[key] = el; }}
                          value={plan}
                          onChange={(e) => handlePlanChange(idx, e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPlan(); } }}
                          placeholder={idx === 0 ? "e.g. Combo meal for ₹199" : "Describe plan"}
                          aria-label={`Plan ${idx + 1}`}
                          className="min-w-0 flex-1 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none ring-1 ring-gray-200 transition placeholder:font-normal placeholder:text-gray-300 focus:ring-2 focus:ring-red-400"
                        />
                        {form.plans.length > 1 && (
                          <button type="button" onClick={() => removePlan(idx)} aria-label={`Remove plan ${idx + 1}`}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-400 transition hover:bg-red-50 hover:text-red-600">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>

              <button type="button" onClick={() => addPlan()}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 py-3 text-sm font-semibold text-gray-500 transition hover:border-red-300 hover:bg-red-50/40 hover:text-red-600">
                <Plus size={16} /> Add another plan
              </button>
              <p className="mt-2 text-[11px] text-gray-400">
                Tip: press <kbd className="rounded bg-gray-100 px-1 font-mono text-[10px] text-gray-500">Enter</kbd> in a plan to add the next one.
                {emptyPlans > 0 && filledPlans > 0 && <> · {emptyPlans} empty row{emptyPlans > 1 ? "s" : ""} will be sent as blank.</>}
              </p>
            </motion.section>

            {/* ACTIONS */}
            <div className="sticky bottom-3 z-20">
              <div className={`${CARD} flex items-center gap-3 p-3`}>
                <button type="button" onClick={() => navigate(-1)}
                  className="rounded-2xl px-5 py-3 text-sm font-semibold text-gray-500 transition hover:bg-gray-100 hover:text-gray-800">
                  Discard
                </button>
                <span className="hidden flex-1 text-xs text-gray-400 sm:block">
                  {!errors.name && !errors.number && !errors.type ? "Ready to add." : "Name, number and type are required."}
                </span>
                <button type="submit" disabled={loading || showAlert}
                  className="ml-auto flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {loading ? "Adding…" : "Add stall"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ===== SUPPORTING COMPONENTS ===== */
const inputCls = (err) =>
  `w-full rounded-2xl bg-white py-3 pl-10 pr-4 text-sm font-semibold text-gray-900 outline-none ring-1 transition placeholder:font-normal placeholder:text-gray-300 focus:ring-2 ${
    err ? "ring-red-300 focus:ring-red-400" : "ring-gray-200 focus:ring-red-400"
  }`;

const SectionTitle = ({ icon, title, subtitle }) => (
  <div className="flex items-center gap-3">
    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600">{icon}</div>
    <div>
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
    </div>
  </div>
);

const FieldError = ({ msg }) => (
  <AnimatePresence initial={false}>
    {msg && (
      <motion.p initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-1.5 text-[11px] font-medium text-red-500">{msg}</motion.p>
    )}
  </AnimatePresence>
);

const Field = ({ label, icon: Icon, required, error, action, children }) => (
  <div>
    <div className="mb-1.5 flex items-center justify-between">
      <label className="text-xs font-semibold text-gray-600">{label} {required && <span className="text-red-500">*</span>}</label>
      {action}
    </div>
    <div className="group relative">
      {Icon && <Icon size={16} className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 transition ${error ? "text-red-400" : "text-gray-400 group-focus-within:text-red-500"}`} />}
      {children}
    </div>
    <FieldError msg={error} />
  </div>
);

export default StallAdd;