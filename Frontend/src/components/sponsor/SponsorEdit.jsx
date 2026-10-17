import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Camera, CheckCircle2, X, ChevronLeft, Crown, Handshake, CalendarCheck2, Radio,
  Check, RotateCcw, Undo2, Loader2, Save, AlertTriangle, RefreshCw, Eye, UploadCloud,
  PencilLine, ArrowRight, WifiOff, Megaphone, Hash, CalendarClock, Award,
} from "lucide-react";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // matches server limit (5MB)

const PAGE_BG =
  "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const CARD =
  "rounded-3xl bg-white/90 ring-1 ring-white/70 shadow-[0_10px_40px_-12px_rgba(127,29,29,0.18)] backdrop-blur";

const UPCOMING_MAX = 500;
const COLLABS = [
  { value: "Title Sponsor", blurb: "Headline partner · name on the event", icon: Crown, tone: "from-red-600 to-rose-500" },
  { value: "Associate Sponsor", blurb: "Co-branded across the season", icon: Handshake, tone: "from-violet-500 to-fuchsia-400" },
  { value: "Event Sponsor", blurb: "Backs specific events", icon: CalendarCheck2, tone: "from-amber-500 to-orange-400" },
  { value: "Media Partner", blurb: "Coverage, promotion & reach", icon: Radio, tone: "from-sky-500 to-cyan-400" },
];
const FIELD_LABELS = { sponsorId: "Sponsor ID", name: "Sponsor name", collaboration: "Collaboration", eventsSponsored: "Events sponsored", reach: "Market reach", upcomingEvents: "Upcoming events" };

const initialsOf = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const clip = (v, n = 60) => (v && v.length > n ? `${v.slice(0, n)}…` : v);
const showValue = (k, v) => (v === "" || v === undefined || v === null ? "—" : k === "upcomingEvents" ? clip(String(v)) : String(v));

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

const ModalIcon = ({ tone, children }) => (
  <motion.div initial={{ scale: 0.5, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}
    className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ring-1 ${tone}`}>
    {children}
  </motion.div>
);

/* ================= SUCCESS ALERT ================= */
const SuccessAlert = ({ onClose, onView, changes }) => (
  <Modal dismissable={false}>
    <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400" />
    <ModalIcon tone="bg-emerald-50 text-emerald-600 ring-emerald-100"><CheckCircle2 size={30} strokeWidth={2.2} /></ModalIcon>
    <h3 className="text-xl font-extrabold tracking-tight text-gray-900">Sponsor updated</h3>
    <p className="mt-2 text-sm text-gray-500">
      {changes > 0 ? `${changes} change${changes > 1 ? "s" : ""} saved to the sponsor record.` : "The sponsor record has been saved."}
    </p>
    <div className="mt-6 grid grid-cols-2 gap-2">
      <button onClick={onView} className="flex items-center justify-center gap-1.5 rounded-2xl bg-gray-100 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-200">
        <Eye size={15} /> View sponsor
      </button>
      <button onClick={onClose}
        className="flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 transition hover:brightness-110">
        All sponsors <ArrowRight size={15} />
      </button>
    </div>
  </Modal>
);

const ErrorAlert = ({ title, message, onClose }) => (
  <Modal onClose={onClose}>
    <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-red-600 to-rose-400" />
    <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 hover:bg-gray-100"><X size={16} /></button>
    <ModalIcon tone="bg-red-50 text-red-600 ring-red-100"><AlertTriangle size={28} /></ModalIcon>
    <h3 className="text-xl font-extrabold tracking-tight text-gray-900">{title}</h3>
    <p className="mt-2 text-sm leading-relaxed text-gray-500">{message}</p>
    <button onClick={onClose}
      className="mt-6 w-full rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:brightness-110">
      Got it
    </button>
  </Modal>
);

const LeaveConfirm = ({ onStay, onLeave, count }) => (
  <Modal onClose={onStay}>
    <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-500 to-orange-400" />
    <ModalIcon tone="bg-amber-50 text-amber-600 ring-amber-100"><AlertTriangle size={28} /></ModalIcon>
    <h3 className="text-xl font-extrabold tracking-tight text-gray-900">Discard changes?</h3>
    <p className="mt-2 text-sm text-gray-500">You have {count} unsaved change{count > 1 ? "s" : ""}. If you leave now, they'll be lost.</p>
    <div className="mt-6 grid grid-cols-2 gap-2">
      <button onClick={onStay} className="rounded-2xl bg-gray-100 py-3 text-sm font-bold text-gray-700 hover:bg-gray-200">Keep editing</button>
      <button onClick={onLeave} className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/30 hover:brightness-110">Discard</button>
    </div>
  </Modal>
);

const SponsorEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState({
    sponsorId: "",
    name: "",
    collaboration: "",
    eventsSponsored: "",
    reach: "",
    upcomingEvents: "",
  });

  const [image, setImage] = useState(null); // new logo file
  const [preview, setPreview] = useState("/default-avatar.png");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  // UI-only
  const [original, setOriginal] = useState(null);
  const [originalPreview, setOriginalPreview] = useState(null);
  const [hasLogo, setHasLogo] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState(null); // { title, message }
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [savedChanges, setSavedChanges] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [touched, setTouched] = useState({});
  const fileRef = useRef(null);
  const objectUrlRef = useRef(null);

  /* ================= FETCH DATA ================= */
  const fetchClient = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/api/sponsors/${id}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );

      if (res.data.success) {
        const s = res.data.sponsor;
        const values = {
          sponsorId: s.sponsorId || "",
          name: s.name || "",
          collaboration: s.collaboration || "",
          eventsSponsored: s.eventsSponsored || "",
          reach: s.reach || "",
          upcomingEvents: s.upcomingEvents || "",
        };
        setClient(values);
        setOriginal(values);

        if (s.logo) {
          const url = s.logo.startsWith("http") ? s.logo : `${import.meta.env.VITE_BACKEND_URL}/${s.logo}`;
          setPreview(url);
          setOriginalPreview(url);
          setHasLogo(true);
        }
      } else {
        setLoadFailed(true);
      }
    } catch (err) {
      console.error("Failed to load sponsor data", err);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchClient(); }, [fetchClient]);
  useEffect(() => () => { if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current); }, []);

  /* ================= HANDLERS ================= */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setClient((prev) => ({ ...prev, [name]: value }));
  };
  const setField = (name, value) => setClient((prev) => ({ ...prev, [name]: value }));

  const pickImage = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError({ title: "Wrong file type", message: "Please choose an image (PNG, JPG, SVG or WebP) for the sponsor logo." });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError({ title: "File too large", message: "File too large. Max 5MB" });
      return;
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setImage(file);
    setPreview(url);
    setHasLogo(true);
  };

  const handleImageChange = (e) => {
    pickImage(e.target.files[0]);
    e.target.value = "";
  };

  const undoImage = () => {
    setImage(null);
    setPreview(originalPreview || "/default-avatar.png");
    setHasLogo(!!originalPreview);
  };

  /* dirty tracking */
  const changedKeys = original ? Object.keys(client).filter((k) => String(client[k] ?? "") !== String(original[k] ?? "")) : [];
  const changeCount = changedKeys.length + (image ? 1 : 0);
  const dirty = changeCount > 0;
  const isChanged = (k) => changedKeys.includes(k);
  const resetField = (k) => setClient((p) => ({ ...p, [k]: original[k] }));
  const resetAll = () => { if (original) setClient(original); undoImage(); setTouched({}); };

  useEffect(() => {
    if (!dirty || showAlert) return;
    const h = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty, showAlert]);

  const errors = {
    sponsorId: !client.sponsorId?.trim() ? "Sponsor ID is required" : "",
    name: !client.name?.trim() ? "Sponsor name is required" : "",
    collaboration: !client.collaboration ? "Choose a collaboration type" : "",
    eventsSponsored: client.eventsSponsored !== "" &&
      (!Number.isInteger(Number(client.eventsSponsored)) || Number(client.eventsSponsored) < 0) ? "Use a whole number, 0 or more" : "",
  };
  const showErr = (k) => touched[k] && errors[k];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setTouched({ sponsorId: true, name: true, collaboration: true, eventsSponsored: true });
    const firstErr = Object.values(errors).find(Boolean);
    if (firstErr) {
      setError({ title: "Check the form", message: `${firstErr}.` });
      return;
    }
    try {
      setSaving(true);
      const fd = new FormData();
      Object.keys(client).forEach((key) => fd.append(key, client[key]));
      if (image) fd.append("logo", image);

      const res = await axios.put(
        `${import.meta.env.VITE_BACKEND_URL}/api/sponsors/${id}`,
        fd,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }
      );

      if (res.data.success) {
        setSavedChanges(changeCount);
        setOriginal(client);
        if (image) { setOriginalPreview(preview); setImage(null); }
        setShowAlert(true);
      }
    } catch (err) {
      setError({ title: "Update failed", message: err.response?.data?.error || "Update failed." });
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => (dirty ? setLeaveOpen(true) : navigate(-1));

  if (loading) return <LoadingSkeleton />;
  if (loadFailed) return <LoadError onRetry={fetchClient} onBack={() => navigate(-1)} />;

  const displayName = client.name?.trim() || original?.name || "Sponsor";
  const collab = COLLABS.find((c) => c.value === client.collaboration);
  const CollabIcon = collab?.icon || Award;

  return (
    <div className={`relative min-h-screen ${PAGE_BG} p-4 pb-16 text-gray-900 sm:p-6 lg:p-8`}>
      <AnimatePresence>
        {showAlert && (
          <SuccessAlert key="ok" changes={savedChanges}
            onClose={() => navigate("/admin-dashboard/sponsors")}
            onView={() => navigate(`/admin-dashboard/sponsors/${id}`)} />
        )}
        {error && <ErrorAlert key="err" title={error.title} message={error.message} onClose={() => setError(null)} />}
        {leaveOpen && <LeaveConfirm key="leave" count={changeCount} onStay={() => setLeaveOpen(false)} onLeave={() => navigate(-1)} />}
      </AnimatePresence>

      <div className="mx-auto max-w-6xl">
        {/* HEADER */}
        <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <button onClick={goBack}
            className="group mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-gray-500 ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200">
            <ChevronLeft size={14} className="transition-transform group-hover:-translate-x-0.5" /> Back
          </button>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/30">
                <PencilLine size={24} />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                  Edit <span className="bg-gradient-to-r from-red-600 to-rose-500 bg-clip-text text-transparent">Sponsor</span>
                </h1>
                <p className="truncate text-sm text-gray-500">Updating <span className="font-semibold text-gray-700">{original?.name || displayName}</span></p>
              </div>
            </div>
            <AnimatePresence>
              {dirty && (
                <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                  className="inline-flex items-center gap-1.5 self-start rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-100 sm:self-auto">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" /> {changeCount} unsaved change{changeCount > 1 ? "s" : ""}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </motion.header>

        <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* ============ LEFT: LOGO + SUMMARY ============ */}
          <aside className="space-y-5 lg:col-span-4">
            <div className="space-y-5 lg:sticky lg:top-6">
              <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={`${CARD} p-5`}>
                <div className="mb-4 flex items-center justify-between">
                  <SectionTitle icon={<Camera size={15} />} title="Sponsor logo" />
                  {image && <EditedTag />}
                </div>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); pickImage(e.dataTransfer.files?.[0]); }}
                  onClick={() => fileRef.current?.click()}
                  role="button" tabIndex={0}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), fileRef.current?.click())}
                  className={`group relative flex cursor-pointer flex-col items-center rounded-3xl border-2 border-dashed p-6 text-center outline-none transition focus-visible:ring-2 focus-visible:ring-red-400 ${
                    dragOver ? "border-red-400 bg-red-50/70" : "border-transparent bg-gray-50/70 hover:border-red-200"
                  }`}
                >
                  <motion.div animate={dragOver ? { scale: 1.06 } : { scale: 1 }} className="relative">
                    <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl bg-white shadow-md ring-4 ring-white">
                      {hasLogo ? (
                        <img src={preview} alt="Sponsor logo" className="h-full w-full object-cover" onError={() => setHasLogo(false)} />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-red-500 to-rose-400 text-3xl font-extrabold text-white">
                          {initialsOf(displayName) || <Building2 size={30} />}
                        </span>
                      )}
                    </div>
                    <span className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/30 transition group-hover:scale-110">
                      <Camera size={15} />
                    </span>
                  </motion.div>
                  <p className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-gray-700"><UploadCloud size={14} /> {dragOver ? "Drop to replace" : "Replace logo"}</p>
                  <p className="text-xs text-gray-400">Click or drag an image · max 5 MB</p>
                  <input ref={fileRef} type="file" hidden accept="image/*" onChange={handleImageChange} />
                </div>
                {image && (
                  <div className="mt-3 flex items-center justify-between rounded-2xl bg-amber-50 px-3 py-2 text-xs ring-1 ring-amber-100">
                    <span className="truncate font-medium text-amber-800">New: {image.name}</span>
                    <button type="button" onClick={undoImage} className="ml-2 inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 font-semibold text-amber-800 hover:bg-white">
                      <Undo2 size={12} /> Undo
                    </button>
                  </div>
                )}
              </motion.section>

              {/* Summary card */}
              <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 p-5 text-white shadow-[0_20px_50px_-15px_rgba(220,38,38,0.55)]">
                <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/15 blur-2xl" />
                <p className="relative text-[11px] font-semibold uppercase tracking-wider text-white/80">After saving</p>
                <p className="relative mt-2 truncate text-xl font-extrabold">{displayName}</p>
                <p className="relative mt-1 flex items-center gap-1 truncate text-xs text-white/85">
                  <CollabIcon size={12} className="shrink-0" /> {collab?.value || "Collaboration type"}
                </p>
                <div className="relative mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
                    <p className="text-[10px] uppercase tracking-wider text-white/70">Events</p>
                    <p className="truncate text-sm font-bold">{client.eventsSponsored !== "" ? client.eventsSponsored : "—"}</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
                    <p className="text-[10px] uppercase tracking-wider text-white/70">Reach</p>
                    <p className="truncate text-sm font-bold">{client.reach?.trim() || "—"}</p>
                  </div>
                </div>
              </motion.section>

              {/* Pending changes */}
              <AnimatePresence>
                {dirty && (
                  <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className={`${CARD} p-5`}>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-bold text-gray-900">Pending changes</h3>
                      <button type="button" onClick={resetAll} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-red-600">
                        <RotateCcw size={12} /> Reset all
                      </button>
                    </div>
                    <ul className="space-y-2">
                      {changedKeys.map((k) => (
                        <li key={k} className="rounded-2xl bg-gray-50 p-3 text-xs ring-1 ring-gray-100">
                          <p className="font-semibold text-gray-500">{FIELD_LABELS[k]}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="text-gray-400 line-through">{showValue(k, original[k])}</span>
                            <ArrowRight size={11} className="text-gray-300" />
                            <span className="font-bold text-gray-900">{showValue(k, client[k])}</span>
                          </p>
                        </li>
                      ))}
                      {image && (
                        <li className="rounded-2xl bg-gray-50 p-3 text-xs ring-1 ring-gray-100">
                          <p className="font-semibold text-gray-500">Sponsor logo</p>
                          <p className="mt-1 font-bold text-gray-900">Replaced with a new image</p>
                        </li>
                      )}
                    </ul>
                  </motion.section>
                )}
              </AnimatePresence>
            </div>
          </aside>

          {/* ============ RIGHT: FORM ============ */}
          <div className="space-y-5 lg:col-span-8">
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`${CARD} p-5 sm:p-6`}>
              <SectionTitle icon={<Building2 size={15} />} title="Sponsor details" subtitle="Who they are and how they partner with you" />
              <div className="mt-5">
                <FieldHeader label="Sponsor ID" required changed={isChanged("sponsorId")} onReset={() => resetField("sponsorId")} />
                <div className="group relative">
                  <Hash size={16} className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 transition ${showErr("sponsorId") ? "text-red-400" : "text-gray-400 group-focus-within:text-red-500"}`} />
                  <input
                    name="sponsorId"
                    value={client.sponsorId}
                    onChange={handleChange}
                    onBlur={() => setTouched((t) => ({ ...t, sponsorId: true }))}
                    placeholder="e.g. SP-2026-001"
                    maxLength={100}
                    required
                    className={inputCls(showErr("sponsorId"), isChanged("sponsorId"))}
                  />
                </div>
                <FieldError msg={showErr("sponsorId")} />
              </div>
              <div className="mt-5">
                <FieldHeader label="Sponsor name" required changed={isChanged("name")} onReset={() => resetField("name")} />
                <div className="group relative">
                  <Building2 size={16} className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 transition ${showErr("name") ? "text-red-400" : "text-gray-400 group-focus-within:text-red-500"}`} />
                  <input
                    name="name"
                    value={client.name}
                    onChange={handleChange}
                    onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                    placeholder="Enter sponsor name"
                    required
                    className={inputCls(showErr("name"), isChanged("name"))}
                  />
                </div>
                <FieldError msg={showErr("name")} />
              </div>

              <div className="mt-5">
                <FieldHeader label="Collaboration type" required changed={isChanged("collaboration")} onReset={() => resetField("collaboration")} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Collaboration type">
                  {COLLABS.map((c) => {
                    const active = client.collaboration === c.value;
                    const wasOriginal = original?.collaboration === c.value;
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
                          <p className="flex items-center gap-2 text-sm font-bold text-gray-900">
                            {c.value}
                            {wasOriginal && !active && <span className="rounded-full bg-gray-100 px-1.5 py-px text-[10px] font-semibold text-gray-500">Current</span>}
                          </p>
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
              </div>
            </motion.section>

            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className={`${CARD} p-5 sm:p-6`}>
              <SectionTitle icon={<Megaphone size={15} />} title="Impact" subtitle="Track record and audience" />
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <FieldHeader label="Events sponsored" changed={isChanged("eventsSponsored")} onReset={() => resetField("eventsSponsored")} />
                  <div className="group relative">
                    <Hash size={16} className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 transition ${showErr("eventsSponsored") ? "text-red-400" : "text-gray-400 group-focus-within:text-red-500"}`} />
                    <input
                      type="number"
                      name="eventsSponsored"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={client.eventsSponsored}
                      onChange={handleChange}
                      onBlur={() => setTouched((t) => ({ ...t, eventsSponsored: true }))}
                      onWheel={(e) => e.currentTarget.blur()}
                      placeholder="Enter count"
                      className={`${inputCls(showErr("eventsSponsored"), isChanged("eventsSponsored"))} pr-20 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none`}
                    />
                    <div className="absolute right-2 top-1/2 flex -translate-y-1/2 overflow-hidden rounded-xl ring-1 ring-gray-200">
                      {[-1, 1].map((d) => (
                        <button key={d} type="button" aria-label={d < 0 ? "Decrease" : "Increase"}
                          onClick={() => setField("eventsSponsored", String(Math.max(0, (parseInt(client.eventsSponsored, 10) || 0) + d)))}
                          className="bg-white px-2.5 py-1 text-sm font-bold text-gray-500 transition hover:bg-red-50 hover:text-red-600">
                          {d < 0 ? "−" : "+"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <FieldError msg={showErr("eventsSponsored")} />
                </div>
                <div>
                  <FieldHeader label="Market reach" changed={isChanged("reach")} onReset={() => resetField("reach")} />
                  <div className="group relative">
                    <Megaphone size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 transition group-focus-within:text-red-500" />
                    <input
                      name="reach"
                      value={client.reach}
                      onChange={handleChange}
                      placeholder="e.g. 5M reach"
                      className={inputCls(false, isChanged("reach"))}
                    />
                  </div>
                </div>
              </div>
            </motion.section>

            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={`${CARD} p-5 sm:p-6`}>
              <SectionTitle icon={<CalendarClock size={15} />} title="Future pipeline" subtitle="What's coming up with this partner" />
              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <div className="flex-1"><FieldHeader label="Upcoming events" changed={isChanged("upcomingEvents")} onReset={() => resetField("upcomingEvents")} /></div>
                </div>
                <textarea
                  name="upcomingEvents"
                  rows={3}
                  maxLength={Math.max(UPCOMING_MAX, (original?.upcomingEvents || "").length)}
                  value={client.upcomingEvents}
                  onChange={handleChange}
                  placeholder="Describe upcoming collaborations…"
                  className={`w-full resize-none rounded-2xl px-4 py-3 text-sm text-gray-900 outline-none ring-1 transition placeholder:text-gray-300 focus:ring-2 focus:ring-red-400 ${
                    isChanged("upcomingEvents") ? "bg-amber-50/40 ring-amber-200" : "bg-white ring-gray-200"
                  }`}
                />
                <p className="mt-1 text-right text-[11px] tabular-nums text-gray-400">{(client.upcomingEvents || "").length}/{Math.max(UPCOMING_MAX, (original?.upcomingEvents || "").length)}</p>
              </div>
            </motion.section>

            {/* ACTIONS */}
            <div className="sticky bottom-3 z-20">
              <div className={`${CARD} flex items-center gap-2 p-3`}>
                <button type="button" onClick={goBack}
                  className="rounded-2xl px-4 py-3 text-sm font-semibold text-gray-500 transition hover:bg-gray-100 hover:text-gray-800">
                  Cancel
                </button>
                {dirty && (
                  <button type="button" onClick={resetAll}
                    className="hidden items-center gap-1.5 rounded-2xl px-4 py-3 text-sm font-semibold text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 sm:inline-flex">
                    <RotateCcw size={14} /> Reset
                  </button>
                )}
                <button type="submit" disabled={saving || !dirty}
                  className="ml-auto flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none sm:flex-none">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {saving ? "Saving…" : dirty ? `Save ${changeCount} change${changeCount > 1 ? "s" : ""}` : "No changes yet"}
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

const inputCls = (err, changed) =>
  `w-full rounded-2xl py-3 pl-10 pr-4 text-sm font-semibold text-gray-900 outline-none ring-1 transition placeholder:font-normal placeholder:text-gray-300 focus:ring-2 ${
    err ? "bg-white ring-red-300 focus:ring-red-400" : changed ? "bg-amber-50/40 ring-amber-200 focus:ring-red-400" : "bg-white ring-gray-200 focus:ring-red-400"
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

const EditedTag = () => (
  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-100">Edited</span>
);

const FieldHeader = ({ label, required, changed, onReset }) => (
  <div className="mb-1.5 flex items-center justify-between gap-2">
    <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
      {label} {required && <span className="text-red-500">*</span>}
      {changed && <EditedTag />}
    </label>
    {changed && (
      <button type="button" onClick={onReset} className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-400 hover:text-red-600">
        <Undo2 size={11} /> Undo
      </button>
    )}
  </div>
);

const FieldError = ({ msg }) => (
  <AnimatePresence initial={false}>
    {msg && (
      <motion.p initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-1 text-[11px] font-medium text-red-500">
        {msg}
      </motion.p>
    )}
  </AnimatePresence>
);

const LoadingSkeleton = () => (
  <div className={`min-h-screen ${PAGE_BG} p-4 sm:p-6 lg:p-8`}>
    <div className="mx-auto max-w-6xl animate-pulse">
      <div className="mb-3 h-7 w-20 rounded-full bg-white/80" />
      <div className="mb-6 flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-red-200/70" />
        <div className="space-y-2"><div className="h-6 w-40 rounded bg-gray-200" /><div className="h-4 w-56 rounded bg-gray-100" /></div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-4">
          <div className={`${CARD} h-64`} />
          <div className="h-36 rounded-3xl bg-red-200/50" />
        </div>
        <div className="space-y-5 lg:col-span-8">
          <div className={`${CARD} h-36`} />
          <div className={`${CARD} h-72`} />
        </div>
      </div>
    </div>
  </div>
);

const LoadError = ({ onRetry, onBack }) => (
  <div className={`flex min-h-screen items-center justify-center p-6 ${PAGE_BG}`}>
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className={`${CARD} w-full max-w-sm p-8 text-center`}>
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500 ring-1 ring-red-100"><WifiOff size={28} /></div>
      <h2 className="text-xl font-extrabold tracking-tight text-gray-900">Couldn't load sponsor</h2>
      <p className="mt-2 text-sm text-gray-500">Failed to load sponsor record. Check your connection and try again.</p>
      <div className="mt-6 flex gap-2">
        <button onClick={onBack} className="flex-1 rounded-2xl bg-gray-100 py-3 text-sm font-bold text-gray-700 hover:bg-gray-200">Go back</button>
        <button onClick={onRetry}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 hover:brightness-110">
          <RefreshCw size={15} /> Retry
        </button>
      </div>
    </motion.div>
  </div>
);

export default SponsorEdit;
