import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, UserPlus, CheckCircle2, ArrowLeft, Award, Crown, Handshake, CalendarCheck2,
  Megaphone, UploadCloud, Trash2, AlertTriangle, Loader2, X, Check, Sparkles,
  CalendarClock, Hash, Building2, Radio,
} from "lucide-react";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // matches server limit (5MB)
const REDIRECT_MS = 1800;
const UPCOMING_MAX = 500;

const PAGE_BG =
  "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const CARD =
  "rounded-3xl bg-white/90 ring-1 ring-white/70 shadow-[0_10px_40px_-12px_rgba(127,29,29,0.18)] backdrop-blur";

const COLLABS = [
  { value: "Title Sponsor", blurb: "Headline partner · name on the event", icon: Crown, tone: "from-red-600 to-rose-500" },
  { value: "Associate Sponsor", blurb: "Co-branded across the season", icon: Handshake, tone: "from-violet-500 to-fuchsia-400" },
  { value: "Event Sponsor", blurb: "Backs specific events", icon: CalendarCheck2, tone: "from-amber-500 to-orange-400" },
  { value: "Media Partner", blurb: "Coverage, promotion & reach", icon: Radio, tone: "from-sky-500 to-cyan-400" },
];
const REACH_HINTS = ["50K followers", "1M impressions", "2.5M impressions", "Regional TV"];

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
    <h3 className="text-xl font-extrabold tracking-tight text-gray-900">Sponsor added</h3>
    <p className="mt-2 text-sm text-gray-500">
      <span className="font-semibold text-gray-800">{name || "The sponsor"}</span> is now in the partner directory.
    </p>
    <div className="mt-5 h-1 overflow-hidden rounded-full bg-gray-100">
      <motion.div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400" initial={{ width: "0%" }} animate={{ width: "100%" }}
        transition={{ duration: REDIRECT_MS / 1000, ease: "linear" }} />
    </div>
    <p className="mt-2 text-[11px] text-gray-400">Taking you to the sponsor list…</p>
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

const SponsorAdd = () => {
  const [formData, setFormData] = useState({});
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);
  // UI-only
  const [error, setError] = useState(null);
  const [touched, setTouched] = useState({});
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);
  const redirectRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => () => clearTimeout(redirectRef.current), []);

  const pickLogo = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError({ title: "Wrong file type", message: "Please choose an image (PNG, JPG, SVG or WebP) for the sponsor logo." });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError({ title: "Logo too large", message: "The sponsor logo must be 5 MB or smaller." });
      return;
    }
    setFormData((p) => ({ ...p, logo: file }));
    setPreview(URL.createObjectURL(file));
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "logo") {
      pickLogo(files?.[0]);
      e.target.value = "";
      return;
    }
    setFormData((p) => ({ ...p, [name]: value }));
  };
  const setField = (name, value) => setFormData((p) => ({ ...p, [name]: value }));
  const touch = (e) => setTouched((t) => ({ ...t, [e.target.name]: true }));

  const removeLogo = () => {
    setFormData((p) => { const { logo, ...rest } = p; return rest; }); // eslint-disable-line no-unused-vars
    setPreview(null);
  };

  const errors = {
    name: !formData.name?.trim() ? "Sponsor name is required" : "",
    collaboration: !formData.collaboration ? "Choose a collaboration type" : "",
    eventsSponsored: formData.eventsSponsored !== undefined && formData.eventsSponsored !== "" &&
      (!Number.isInteger(Number(formData.eventsSponsored)) || Number(formData.eventsSponsored) < 0) ? "Use a whole number, 0 or more" : "",
  };
  const showErr = (k) => touched[k] && errors[k];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setTouched({ name: true, collaboration: true, eventsSponsored: true });
    const firstErr = Object.values(errors).find(Boolean);
    if (firstErr) {
      setError({ title: "Check the form", message: `${firstErr}.` });
      return;
    }
    setLoading(true);

    const fd = new FormData();
    Object.keys(formData).forEach((key) => {
      if (formData[key] !== undefined && formData[key] !== "") {
        fd.append(key, formData[key]);
      }
    });

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/api/sponsors/add`,
        fd,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );

      if (res.data?.success) {
        setShowAlert(true);
        redirectRef.current = setTimeout(() => navigate("/admin-dashboard/sponsors"), REDIRECT_MS);
      }
    } catch (err) {
      setError({ title: "Couldn't add sponsor", message: err.response?.data?.error || "Failed to add sponsor" });
    } finally {
      setLoading(false);
    }
  };

  const goNow = () => { clearTimeout(redirectRef.current); navigate("/admin-dashboard/sponsors"); };

  /* progress */
  const checks = [
    ["Name", !errors.name],
    ["Collaboration", !errors.collaboration],
    ["Logo", !!formData.logo],
    ["Events", formData.eventsSponsored !== undefined && formData.eventsSponsored !== "" && !errors.eventsSponsored],
    ["Reach", !!formData.reach?.trim()],
  ];
  const done = checks.filter(([, ok]) => ok).length;
  const pct = Math.round((done / checks.length) * 100);
  const collab = COLLABS.find((c) => c.value === formData.collaboration);
  const CollabIcon = collab?.icon || Award;

  return (
    <div className={`min-h-screen ${PAGE_BG} p-4 pb-16 text-gray-900 sm:p-6 lg:p-8`}>
      <AnimatePresence>
        {showAlert && <SuccessAlert key="ok" name={formData.name} onGo={goNow} />}
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
                <Award size={24} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-500">Partners</p>
                <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                  New <span className="bg-gradient-to-r from-red-600 to-rose-500 bg-clip-text text-transparent">Sponsor</span>
                </h1>
                <p className="text-sm text-gray-500">Add a partner and how they're collaborating with Hakirush.</p>
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
                <SectionTitle icon={<Camera size={15} />} title="Sponsor logo" subtitle="Optional · shown in the directory" />
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
                {formData.logo && (
                  <div className="mt-3 flex items-center justify-between rounded-2xl bg-emerald-50 px-3 py-2 text-xs ring-1 ring-emerald-100">
                    <span className="flex min-w-0 items-center gap-1.5 font-medium text-emerald-700">
                      <CheckCircle2 size={14} className="shrink-0" /> <span className="truncate">{formData.logo.name}</span>
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
                <p className="relative mb-4 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/80"><Sparkles size={12} /> Directory preview</p>
                <div className="relative flex items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/20 text-lg font-bold ring-2 ring-white/40">
                    {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : initials(formData.name) || <Building2 size={22} />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-extrabold">{formData.name?.trim() || "Sponsor name"}</p>
                    <p className="flex items-center gap-1 truncate text-xs text-white/85">
                      <CollabIcon size={12} className="shrink-0" /> {collab?.value || "Collaboration type"}
                    </p>
                  </div>
                </div>
                <div className="relative mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
                    <p className="text-[10px] uppercase tracking-wider text-white/70">Events</p>
                    <p className="truncate text-sm font-bold">{formData.eventsSponsored !== undefined && formData.eventsSponsored !== "" ? formData.eventsSponsored : "—"}</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
                    <p className="text-[10px] uppercase tracking-wider text-white/70">Reach</p>
                    <p className="truncate text-sm font-bold">{formData.reach?.trim() || "—"}</p>
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
            {/* Identity */}
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`${CARD} p-5 sm:p-6`}>
              <SectionTitle icon={<UserPlus size={15} />} title="Sponsor details" subtitle="Who they are and how they partner with you" />

              <div className="mt-5">
                <Field label="Sponsor name" icon={Building2} required error={showErr("name")}>
                  <input name="name" value={formData.name || ""} onChange={handleChange} onBlur={touch} placeholder="e.g. Apex Sports Drinks" autoComplete="organization" className={inputCls(showErr("name"))} />
                </Field>
              </div>

              <p className="mb-2 mt-5 text-xs font-semibold text-gray-600">Collaboration type <span className="text-red-500">*</span></p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Collaboration type">
                {COLLABS.map((c) => {
                  const active = formData.collaboration === c.value;
                  return (
                    <button key={c.value} type="button" role="radio" aria-checked={active}
                      onClick={() => { setField("collaboration", c.value); setTouched((t) => ({ ...t, collaboration: true })); }}
                      className={`relative flex items-center gap-3 rounded-2xl p-4 text-left transition ${
                        active ? "bg-red-50/70 ring-2 ring-red-400" : showErr("collaboration") ? "bg-white ring-1 ring-red-200" : "bg-white ring-1 ring-gray-200 hover:ring-red-200"
                      }`}>
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${c.tone} text-white shadow-md`}>
                        <c.icon size={19} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-900">{c.value}</p>
                        <p className="truncate text-xs text-gray-500">{c.blurb}</p>
                      </div>
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition ${active ? "bg-red-600 text-white" : "ring-2 ring-gray-200"}`}>
                        {active && <Check size={12} strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })}
              </div>
              <FieldError msg={showErr("collaboration")} />
            </motion.section>

            {/* Impact */}
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className={`${CARD} p-5 sm:p-6`}>
              <SectionTitle icon={<Megaphone size={15} />} title="Impact" subtitle="Track record and audience" />
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Events sponsored" icon={Hash} error={showErr("eventsSponsored")}
                  action={
                    <div className="flex overflow-hidden rounded-full ring-1 ring-gray-200">
                      {[-1, 1].map((d) => (
                        <button key={d} type="button" aria-label={d < 0 ? "Decrease" : "Increase"}
                          onClick={() => setField("eventsSponsored", String(Math.max(0, (parseInt(formData.eventsSponsored, 10) || 0) + d)))}
                          className="px-2 py-0.5 text-xs font-bold text-gray-500 transition hover:bg-red-50 hover:text-red-600">
                          {d < 0 ? "−" : "+"}
                        </button>
                      ))}
                    </div>
                  }>
                  <input type="number" name="eventsSponsored" min="0" step="1" inputMode="numeric" value={formData.eventsSponsored ?? ""}
                    onChange={handleChange} onBlur={touch} onWheel={(e) => e.currentTarget.blur()} placeholder="0"
                    className={`${inputCls(showErr("eventsSponsored"))} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none`} />
                </Field>
                <div>
                  <Field label="Market reach" icon={Megaphone}>
                    <input name="reach" value={formData.reach || ""} onChange={handleChange} placeholder="e.g. 2.5M impressions" className={inputCls(false)} />
                  </Field>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {REACH_HINTS.map((h) => (
                      <button key={h} type="button" onClick={() => setField("reach", h)}
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${formData.reach === h ? "bg-red-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600"}`}>
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.section>

            {/* Pipeline */}
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={`${CARD} p-5 sm:p-6`}>
              <SectionTitle icon={<CalendarClock size={15} />} title="Future pipeline" subtitle="Optional · what's coming up with this partner" />
              <div className="mt-5">
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="upcomingEvents" className="text-xs font-semibold text-gray-600">Upcoming events</label>
                  <span className={`text-[11px] tabular-nums ${(formData.upcomingEvents || "").length > UPCOMING_MAX - 50 ? "text-amber-600" : "text-gray-400"}`}>
                    {(formData.upcomingEvents || "").length}/{UPCOMING_MAX}
                  </span>
                </div>
                <textarea id="upcomingEvents" name="upcomingEvents" rows={3} maxLength={UPCOMING_MAX}
                  value={formData.upcomingEvents || ""} onChange={handleChange}
                  placeholder="Describe upcoming collaborations… e.g. Inter-school football cup in December"
                  className="w-full resize-none rounded-2xl bg-white px-4 py-3 text-sm text-gray-900 outline-none ring-1 ring-gray-200 transition placeholder:text-gray-300 focus:ring-2 focus:ring-red-400" />
              </div>
            </motion.section>

            {/* ACTIONS */}
            <div className="sticky bottom-3 z-20">
              <div className={`${CARD} flex items-center gap-3 p-3`}>
                <button type="button" onClick={() => navigate(-1)}
                  className="rounded-2xl px-5 py-3 text-sm font-semibold text-gray-500 transition hover:bg-gray-100 hover:text-gray-800">
                  Discard
                </button>
                <span className="hidden flex-1 text-xs text-gray-400 sm:block">
                  {!errors.name && !errors.collaboration ? "Ready to add." : "Name and collaboration type are required."}
                </span>
                <button type="submit" disabled={loading || showAlert}
                  className="ml-auto flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                  {loading ? "Adding…" : "Add sponsor"}
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

export default SponsorAdd;
