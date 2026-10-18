import axios from "axios";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { formatTotalExperience } from "../../utils/employeeExperience";
import {
  Calendar, ChevronLeft, Fingerprint, Mail,
  Droplets, Briefcase, IdCard, CreditCard,
  PiggyBank, Heart, User, Edit, Globe, X,
  Eye, EyeOff, Copy, Check, Cake, Building2, BadgeCheck, Wallet, ShieldCheck, Clock, ZoomIn, SearchX,
} from "lucide-react";

const PAGE_BG =
  "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const CARD =
  "rounded-3xl bg-white/90 ring-1 ring-white/70 shadow-[0_10px_40px_-12px_rgba(127,29,29,0.18)] backdrop-blur";

/* ---------- helpers (UI only) ---------- */
const AVATAR_BG = ["from-red-500 to-rose-400", "from-violet-500 to-fuchsia-400", "from-sky-500 to-cyan-400", "from-amber-500 to-orange-400", "from-emerald-500 to-teal-400"];
const colorFor = (s = "") => AVATAR_BG[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_BG.length];
const longDate = (d) => {
  const x = new Date(d);
  return !d || isNaN(x) ? "—" : x.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
};
const ageFrom = (dob) => {
  const d = new Date(dob);
  if (!dob || isNaN(d)) return null;
  const t = new Date();
  let a = t.getFullYear() - d.getFullYear();
  if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a--;
  return a;
};
const daysToBirthday = (dob) => {
  const d = new Date(dob);
  if (!dob || isNaN(d)) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  let next = new Date(t.getFullYear(), d.getMonth(), d.getDate());
  if (next < t) next = new Date(t.getFullYear() + 1, d.getMonth(), d.getDate());
  return Math.round((next - t) / 86400000);
};
const tenure = (join) => {
  const d = new Date(join);
  if (!join || isNaN(d)) return null;
  const t = new Date();
  let m = (t.getFullYear() - d.getFullYear()) * 12 + (t.getMonth() - d.getMonth());
  if (t.getDate() < d.getDate()) m--;
  if (m < 1) return "New this month";
  const y = Math.floor(m / 12), r = m % 12;
  return [y && `${y} yr${y > 1 ? "s" : ""}`, r && `${r} mo`].filter(Boolean).join(" ");
};
const mask = (v, keep = 4) => {
  const s = String(v || "");
  if (!s) return "";
  if (s.length <= keep) return s;
  return "•".repeat(Math.max(4, s.length - keep)) + s.slice(-keep);
};

const EmployeeProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isImageOpen, setIsImageOpen] = useState(false);
  // UI-only
  const [imgFailed, setImgFailed] = useState(false);
  const [revealed, setRevealed] = useState({});
  const [showSalary, setShowSalary] = useState(false);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/employee/${id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        if (res.data?.success) setEmployee(res.data.employee);
      } catch {
        console.error("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };
    fetchEmployee();
  }, [id]);

  // Close lightbox on Escape key
  useEffect(() => {
    if (!isImageOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setIsImageOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isImageOpen]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(""), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const getImageUrl = (imagePath) => {
    if (!imagePath) return "/default-avatar.png";
    if (imagePath.startsWith("http")) return imagePath;
    return `${import.meta.env.VITE_BACKEND_URL}/${imagePath.replace(/^\/+/, "")}`;
  };

  const initials = React.useMemo(() => {
    const name = employee?.userId?.name || "";
    return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  }, [employee]);

  if (loading) return <LoadingPulse />;
  if (!employee) return <ErrorView />;

  const hasProfileImage = Boolean(employee?.userId?.profileImage) && !imgFailed;
  const name = employee?.userId?.name || "Employee";
  const isActive = employee.isActive ?? employee.userId?.isActive;
  const age = ageFrom(employee.dob);
  const bdayIn = daysToBirthday(employee.dob);
  const joinYear = new Date(employee.dateOfJoining).getFullYear();
  const experience = formatTotalExperience(employee.experience, employee.dateOfJoining, {
    isActive: employee.isActive ?? employee.userId?.isActive,
    inactiveSince: employee.inactiveSince,
    inactiveDurationMs: employee.inactiveDurationMs,
  });
  const salary = Number(employee.salary || 0);

  const copy = (key, value) => {
    if (!value) return;
    navigator.clipboard?.writeText(String(value)).then(() => setCopied(key)).catch(() => {});
  };

  const CopyBtn = ({ k, value }) =>
    value ? (
      <button type="button" onClick={() => copy(k, value)} aria-label="Copy" title="Copy"
        className="rounded-lg p-1.5 text-gray-300 transition hover:bg-gray-100 hover:text-gray-700">
        {copied === k ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
      </button>
    ) : null;

  const docs = [
    { k: "aadhar", label: "Aadhaar card", value: employee.aadharcard, Icon: IdCard },
    { k: "pan", label: "PAN card", value: employee.pancard, Icon: CreditCard },
    { k: "pf", label: "PF number", value: employee.pfNumber, Icon: PiggyBank },
  ];

  return (
    <div className={`min-h-screen ${PAGE_BG} p-4 sm:p-6 lg:p-8`}>
      <div className="mx-auto max-w-5xl">
        {/* back */}
        <button onClick={() => navigate(-1)}
          className="group mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-gray-500 ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200">
          <ChevronLeft size={14} className="transition-transform group-hover:-translate-x-0.5" /> Back
        </button>

        {/* ============ HERO ============ */}
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className={`${CARD} overflow-hidden`}>
          <div className="relative h-32 bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 sm:h-40">
            <div className="absolute -right-10 -top-16 h-60 w-60 rounded-full bg-white/15 blur-2xl" />
            <div className="absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-orange-300/25 blur-2xl" />
            <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:24px_24px]" />
            <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/25 backdrop-blur">
              <Building2 size={12} /> Hakirush · since {isNaN(joinYear) ? "—" : joinYear}
            </span>
          </div>

          <div className="px-5 pb-6 sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:gap-5">
                {/* avatar (only this overlaps the banner) */}
                <button type="button"
                  onClick={() => hasProfileImage && setIsImageOpen(true)}
                  className={`group relative z-10 -mt-14 h-28 w-28 shrink-0 overflow-hidden rounded-3xl bg-white shadow-xl ring-4 ring-white sm:-mt-16 sm:h-32 sm:w-32 ${hasProfileImage ? "cursor-zoom-in" : "cursor-default"}`}>
                  {hasProfileImage ? (
                    <>
                      <img src={getImageUrl(employee.userId.profileImage)} className="h-full w-full object-cover" alt="Profile" onError={() => setImgFailed(true)} />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition group-hover:opacity-100"><ZoomIn size={22} /></span>
                    </>
                  ) : (
                    <span className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${colorFor(name)} text-4xl font-extrabold text-white`}>{initials || "?"}</span>
                  )}
                </button>

                <div className="min-w-0 sm:pt-4">
                  <h1 className="break-words text-2xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-3xl">{name}</h1>
                  <p className="mt-0.5 text-sm text-gray-500">{employee?.designation || "Team member"}{employee?.department?.dep_name && <> · {employee.department.dep_name}</>}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-2.5 py-1 font-mono text-xs font-semibold text-white"><Fingerprint size={12} />{employee.employeeId}</span>
                    {typeof isActive === "boolean" && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${isActive ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-gray-100 text-gray-500 ring-gray-200"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-gray-400"}`} /> {isActive ? "Active" : "Inactive"}
                      </span>
                    )}
                    {tenure(employee.dateOfJoining) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-100"><Clock size={12} />{tenure(employee.dateOfJoining)} here</span>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={() => navigate(`/employee-dashboard/profile/${employee._id}/edit`)}
                className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98] sm:mt-4"
              >
                <Edit size={15} /> Edit profile
              </button>
            </div>

            {/* quick stats */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Experience", value: experience || "—", Icon: Briefcase, tone: "bg-red-50 text-red-600" },
                { label: "Joined", value: longDate(employee.dateOfJoining), Icon: Calendar, tone: "bg-violet-50 text-violet-600" },
                { label: "Age", value: age !== null ? `${age} yrs` : "—", Icon: User, tone: "bg-sky-50 text-sky-600" },
                { label: "Birthday", value: bdayIn === null ? "—" : bdayIn === 0 ? "Today 🎉" : `in ${bdayIn} days`, Icon: Cake, tone: "bg-pink-50 text-pink-600" },
              ].map((s, i) => (
                <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}
                  className="rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-100">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${s.tone}`}><s.Icon size={15} /></div>
                  <p className="mt-2 truncate text-sm font-extrabold text-gray-900" title={String(s.value)}>{s.value}</p>
                  <p className="text-[11px] font-semibold text-gray-400">{s.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* ============ WORK ============ */}
          <Section icon={Briefcase} title="Work details" delay={0.05}>
            <Field icon={<Fingerprint size={15} />} label="Employee ID" value={employee.employeeId} mono action={<CopyBtn k="eid" value={employee.employeeId} />} />
            <Field icon={<Globe size={15} />} label="Department" value={employee.department?.dep_name} />
            <Field icon={<BadgeCheck size={15} />} label="Designation" value={employee.designation} />
            <Field icon={<Calendar size={15} />} label="Official join date" value={longDate(employee.dateOfJoining)} />
            <Field icon={<Briefcase size={15} />} label="Total experience" value={experience} />
          </Section>

          {/* ============ PERSONAL ============ */}
          <Section icon={User} title="Personal" delay={0.08}>
            <Field icon={<Mail size={15} />} label="Email address" value={employee.userId?.email}
              action={
                <span className="flex items-center">
                  <CopyBtn k="email" value={employee.userId?.email} />
                  {employee.userId?.email && <a href={`mailto:${employee.userId.email}`} className="rounded-lg px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50">Mail</a>}
                </span>
              } />
            <Field icon={<Calendar size={15} />} label="Date of birth" value={longDate(employee.dob)} sub={age !== null ? `${age} years old` : null} />
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[
                { label: "Gender", value: employee.gender, Icon: User },
                { label: "Marital", value: employee.maritalStatus, Icon: Heart },
                { label: "Blood", value: employee.bloodGroup, Icon: Droplets, red: true },
              ].map((p) => (
                <div key={p.label} className="rounded-2xl bg-gray-50 p-3 text-center ring-1 ring-gray-100">
                  <p.Icon size={15} className={`mx-auto ${p.red ? "text-red-500" : "text-gray-400"}`} />
                  <p className={`mt-1 truncate text-sm font-extrabold capitalize ${p.red ? "text-red-600" : "text-gray-900"}`}>{p.value || "—"}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{p.label}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* ============ DOCUMENTS ============ */}
          <Section icon={ShieldCheck} title="Identity documents" subtitle="Hidden for privacy — tap the eye to show" delay={0.11}>
            {docs.map((d) => {
              const open = revealed[d.k];
              return (
                <Field key={d.k} icon={<d.Icon size={15} />} label={d.label}
                  value={d.value ? (open ? d.value : mask(d.value)) : null} mono
                  action={d.value ? (
                    <span className="flex items-center">
                      <button type="button" onClick={() => setRevealed((r) => ({ ...r, [d.k]: !r[d.k] }))} aria-label={open ? "Hide" : "Show"} title={open ? "Hide" : "Show"}
                        className="rounded-lg p-1.5 text-gray-300 transition hover:bg-gray-100 hover:text-gray-700">
                        {open ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <CopyBtn k={d.k} value={d.value} />
                    </span>
                  ) : null} />
              );
            })}
          </Section>

          {/* ============ COMPENSATION ============ */}
          <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 p-6 text-white shadow-xl shadow-red-600/25">
            <div className="pointer-events-none absolute -right-12 -top-14 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-12 left-10 h-32 w-32 rounded-full bg-orange-300/25 blur-2xl" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25"><Wallet size={18} /></div>
                <div>
                  <p className="text-sm font-bold">Compensation</p>
                  <p className="text-xs text-white/75">Annual CTC</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowSalary((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-bold ring-1 ring-white/25 transition hover:bg-white/25">
                {showSalary ? <EyeOff size={14} /> : <Eye size={14} />} {showSalary ? "Hide" : "Show"}
              </button>
            </div>
            <div className="relative mt-6">
              <AnimatePresence mode="wait" initial={false}>
                <motion.p key={showSalary ? "on" : "off"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                  className="text-4xl font-extrabold tabular-nums tracking-tight sm:text-5xl">
                  {showSalary ? `₹${salary.toLocaleString("en-IN")}` : "₹ ••••••"}
                </motion.p>
              </AnimatePresence>
              <p className="mt-1 text-sm text-white/80">per year</p>
            </div>
            <div className="relative mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white/15 p-3 ring-1 ring-white/20">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">Approx. monthly</p>
                <p className="mt-0.5 text-lg font-extrabold tabular-nums">{showSalary ? `₹${Math.round(salary / 12).toLocaleString("en-IN")}` : "••••"}</p>
              </div>
              <div className="rounded-2xl bg-white/15 p-3 ring-1 ring-white/20">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">PF number</p>
                <p className="mt-0.5 truncate font-mono text-lg font-extrabold">{employee.pfNumber ? (revealed.pf ? employee.pfNumber : mask(employee.pfNumber)) : "—"}</p>
              </div>
            </div>
          </motion.section>
        </div>
      </div>

      {/* ============ IMAGE LIGHTBOX ============ */}
      {createPortal(
        <AnimatePresence>
          {isImageOpen && hasProfileImage && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsImageOpen(false)}
              role="dialog" aria-modal="true"
              className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/85 p-6 backdrop-blur"
            >
              <button
                onClick={() => setIsImageOpen(false)}
                className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20 transition hover:bg-white/20"
                aria-label="Close"
              >
                <X size={18} />
              </button>
              <motion.img
                initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                src={getImageUrl(employee.userId.profileImage)}
                alt="Profile enlarged"
                onClick={(e) => e.stopPropagation()}
                className="max-h-[85vh] max-w-full rounded-3xl object-contain shadow-2xl"
              />
              <p className="absolute bottom-6 left-0 right-0 text-center text-sm font-semibold text-white/80">{name}</p>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

// --- SUPPORTING COMPONENTS ---

const Section = ({ icon: Icon, title, subtitle, delay = 0, children }) => (
  <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className={`${CARD} p-5 sm:p-6`}>
    <div className="mb-4 flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600"><Icon size={16} /></div>
      <div>
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>
    </div>
    <div className="space-y-2">{children}</div>
  </motion.section>
);

const Field = ({ icon, label, value, sub, mono, action }) => (
  <div className="flex items-center gap-3 rounded-2xl p-2.5 transition hover:bg-gray-50">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-400 ring-1 ring-gray-100">{icon}</span>
    <div className="min-w-0 flex-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className={`truncate text-sm font-bold ${value ? "text-gray-900" : "text-gray-300"} ${mono ? "font-mono tracking-wide" : ""}`} title={value || undefined}>
        {value || "Not added"}
      </p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
    {action}
  </div>
);

const LoadingPulse = () => (
  <div className={`min-h-screen ${PAGE_BG} p-4 sm:p-6 lg:p-8`}>
    <div className="mx-auto max-w-5xl animate-pulse">
      <div className="mb-4 h-7 w-20 rounded-full bg-white/80" />
      <div className={`${CARD} overflow-hidden`}>
        <div className="h-32 bg-red-200/60 sm:h-40" />
        <div className="flex items-start gap-5 px-5 pb-6 sm:px-8">
          <div className="-mt-14 h-28 w-28 rounded-3xl bg-gray-200 ring-4 ring-white sm:h-32 sm:w-32" />
          <div className="space-y-2 pt-4"><div className="h-6 w-48 rounded bg-gray-200" /><div className="h-4 w-32 rounded bg-gray-100" /></div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => <div key={i} className={`${CARD} h-64`} />)}
      </div>
    </div>
  </div>
);

const ErrorView = () => (
  <div className={`flex min-h-screen items-center justify-center p-6 ${PAGE_BG}`}>
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className={`${CARD} w-full max-w-sm p-8 text-center`}>
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 ring-1 ring-gray-100"><SearchX size={28} /></div>
      <h2 className="text-xl font-extrabold tracking-tight text-gray-900">Profile not found</h2>
      <p className="mt-2 text-sm text-gray-500">We couldn't load this profile. Please try again.</p>
      <button
        onClick={() => window.history.back()}
        className="mt-6 w-full rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 hover:brightness-110"
      >
        Go back
      </button>
    </motion.div>
  </div>
);

export default EmployeeProfile;