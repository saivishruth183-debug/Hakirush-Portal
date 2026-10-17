import axios from "axios";
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { formatTotalExperience } from "../../utils/employeeExperience";
import {
  Calendar, ChevronLeft, ChevronRight, Fingerprint, Mail, Droplets, Briefcase, IdCard, CreditCard,
  PiggyBank, Heart, User, Pencil, Building2, X, Copy, Check, Eye, EyeOff, Cake, Clock,
  IndianRupee, AlertTriangle, RefreshCw, ShieldCheck, Users, ZoomIn, Wallet, BadgeCheck,
} from "lucide-react";

const PAGE_BG = "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";

const avatarColors = [
  "from-red-500 to-rose-600",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-violet-500 to-purple-600",
  "from-slate-600 to-slate-800",
];
const colorFor = (s = "") => avatarColors[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % avatarColors.length];

const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith("http")) return imagePath;
  return `${import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "")}/${imagePath.replace(/^\/+/, "")}`;
};

/* ---------- date helpers (never print "Invalid Date") ---------- */
const toDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};
const fmtDate = (v) => {
  const d = toDate(v);
  return d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "";
};
const ageFrom = (v) => {
  const d = toDate(v);
  if (!d) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age >= 0 ? age : null;
};
const tenureFrom = (v) => {
  const d = toDate(v);
  if (!d) return "";
  const now = new Date();
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) months--;
  if (months < 0) return "";
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (!y && !m) return "Joined this month";
  return [y && `${y} yr${y > 1 ? "s" : ""}`, m && `${m} mo`].filter(Boolean).join(" ");
};
const daysToBirthday = (v) => {
  const d = toDate(v);
  if (!d) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return Math.round((next - today) / 86400000);
};

const mask = (value, keep = 4) => {
  const s = String(value || "");
  if (!s) return "";
  if (s.length <= keep) return s;
  return "•".repeat(Math.min(s.length - keep, 8)) + s.slice(-keep);
};

/* ================= SMALL PIECES ================= */
const CopyButton = ({ value, label }) => {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard?.writeText(String(value)); setCopied(true); setTimeout(() => setCopied(false), 1400); }}
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${
        copied ? "bg-emerald-50 text-emerald-600" : "text-gray-300 hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
      }`}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
};

const InfoRow = ({ icon: Icon, label, value, sub, copy, mono, sensitive, revealed }) => (
  <div className="group flex items-center gap-3 rounded-2xl p-3 transition hover:bg-red-50/50">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
      <Icon size={17} />
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-[11px] font-medium text-gray-400">{label}</p>
      {value ? (
        <p className={`truncate text-sm font-semibold text-gray-900 ${mono ? "font-mono tracking-wide" : ""}`}>
          {sensitive && !revealed ? mask(value) : value}
        </p>
      ) : (
        <p className="text-sm font-medium text-gray-300">Not provided</p>
      )}
      {sub && value && <p className="truncate text-[11px] text-gray-400">{sub}</p>}
    </div>
    {copy && value && (!sensitive || revealed) && <CopyButton value={value} label={label} />}
  </div>
);

const Card = ({ icon: Icon, title, right, children, i = 0, className = "" }) => (
  <motion.section
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0, transition: { delay: 0.12 + i * 0.06, duration: 0.45 } }}
    className={`overflow-hidden rounded-3xl bg-white/90 shadow-[0_14px_40px_-18px_rgba(127,29,29,0.2)] ring-1 ring-white/70 backdrop-blur-sm ${className}`}
  >
    <div className="flex items-center justify-between gap-3 border-b border-red-50 px-5 py-4">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-md shadow-red-600/25">
          <Icon size={15} />
        </span>
        <h3 className="text-sm font-extrabold tracking-tight text-gray-900">{title}</h3>
      </div>
      {right}
    </div>
    <div className="p-2 sm:p-3">{children}</div>
  </motion.section>
);

const Stat = ({ icon: Icon, label, value, tone }) => (
  <div className="flex items-center gap-3 rounded-2xl bg-white/80 p-3.5 ring-1 ring-white/70">
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
      <Icon size={17} />
    </span>
    <div className="min-w-0">
      <p className="truncate text-base font-extrabold leading-tight text-gray-900">{value || "—"}</p>
      <p className="text-[11px] font-medium text-gray-500">{label}</p>
    </div>
  </div>
);

const Skeleton = ({ className = "" }) => <div className={`animate-pulse rounded-2xl bg-white/70 ${className}`} />;

/* ================= PAGE ================= */
const EmployeeView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isImageOpen, setIsImageOpen] = useState(false);
  const [imgBroken, setImgBroken] = useState(false);
  const [showSensitive, setShowSensitive] = useState(false);
  const [showSalary, setShowSalary] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const fetchEmployee = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/employee/${id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        if (res.data?.success) setEmployee(res.data.employee);
        else setEmployee(null);
      } catch (err) {
        console.error("Failed to load profile");
        setEmployee(null);
        if (err?.response?.status !== 404) {
          setLoadError(err?.response?.data?.error || err?.response?.data?.message || "We couldn't load this profile. Check your connection and try again.");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchEmployee();
  }, [id, reloadKey]);

  // Close lightbox on Escape key
  useEffect(() => {
    if (!isImageOpen) return;
    const onKeyDown = (e) => e.key === "Escape" && setIsImageOpen(false);
    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [isImageOpen]);

  const name = employee?.userId?.name || "Unnamed employee";
  const initials = useMemo(
    () => name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase(),
    [name]
  );

  if (loading) return <LoadingView />;
  if (!employee) return <ErrorView message={loadError} onRetry={loadError ? () => setReloadKey((k) => k + 1) : null} onBack={() => navigate(-1)} />;

  const photo = getImageUrl(employee?.userId?.profileImage);
  const hasPhoto = Boolean(photo) && !imgBroken;
  const rawActive = employee.isActive ?? employee.userId?.isActive;
  const isActive = typeof rawActive === "boolean" ? rawActive : undefined;
  const role = employee.userId?.role;
  const dept = employee.department;
  const joined = toDate(employee.dateOfJoining);
  const age = ageFrom(employee.dob);
  const bdayIn = daysToBirthday(employee.dob);
  const salary = Number(employee.salary || 0);
  const hasSalary = employee.salary !== undefined && employee.salary !== null && employee.salary !== "";
  const experience = formatTotalExperience(employee.experience, employee.dateOfJoining, {
    isActive: employee.isActive ?? employee.userId?.isActive,
    inactiveSince: employee.inactiveSince,
    inactiveDurationMs: employee.inactiveDurationMs,
  });
  const docCount = [employee.aadharcard, employee.pancard, employee.pfNumber].filter(Boolean).length;
  const editPath = `/admin-dashboard/employees/edit/${employee._id}`;

  return (
    <div className={`min-h-screen px-4 pb-16 pt-6 font-sans text-gray-700 sm:px-8 ${PAGE_BG}`}>
      <div className="mx-auto max-w-6xl">
        {/* ================= TOP ROW ================= */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-6 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate(-1)}
            className="group inline-flex items-center gap-2 rounded-2xl bg-white/80 px-3.5 py-2.5 text-sm font-semibold text-gray-600 shadow-sm ring-1 ring-red-100 transition hover:text-red-600 hover:ring-red-200"
          >
            <ChevronLeft size={17} className="transition-transform group-hover:-translate-x-0.5" />
            Back
          </button>
          <span className="hidden items-center gap-1.5 text-xs font-medium text-gray-400 sm:flex">
            Employees <ChevronRight size={12} />
            <span className="max-w-[220px] truncate font-semibold text-red-600">{name}</span>
          </span>
        </motion.div>

        {/* ================= PROFILE HEADER ================= */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-[2rem] bg-white/90 shadow-[0_24px_60px_-24px_rgba(127,29,29,0.35)] ring-1 ring-white/70 backdrop-blur-sm"
        >
          {/* cover */}
          <div className="relative h-32 overflow-hidden bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 sm:h-40">
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.12]"
              style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/15 blur-3xl" />
            <div aria-hidden className="pointer-events-none absolute -bottom-20 left-1/4 h-48 w-48 rounded-full bg-orange-300/30 blur-3xl" />
          </div>

          <div className="relative px-5 pb-6 sm:px-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end">
                {/* avatar */}
                <button
                  type="button"
                  onClick={() => hasPhoto && setIsImageOpen(true)}
                  disabled={!hasPhoto}
                  aria-label={hasPhoto ? "View photo" : undefined}
                  className={`group relative -mt-16 h-32 w-32 shrink-0 rounded-[2rem] bg-white p-1.5 shadow-xl ring-4 ring-white sm:-mt-20 sm:h-36 sm:w-36 ${hasPhoto ? "cursor-zoom-in" : "cursor-default"}`}
                >
                  {hasPhoto ? (
                    <>
                      <img src={photo} alt={name} onError={() => setImgBroken(true)}
                        className={`h-full w-full rounded-[1.6rem] object-cover ${isActive === false ? "grayscale" : ""}`} />
                      <span className="absolute inset-1.5 flex items-center justify-center rounded-[1.6rem] bg-gray-900/40 text-white opacity-0 transition group-hover:opacity-100">
                        <ZoomIn size={22} />
                      </span>
                    </>
                  ) : (
                    <span className={`flex h-full w-full items-center justify-center rounded-[1.6rem] bg-gradient-to-br text-4xl font-extrabold text-white ${isActive === false ? "from-gray-300 to-gray-400" : colorFor(name)}`}>
                      {initials || <User size={36} />}
                    </span>
                  )}
                  {typeof isActive === "boolean" && (
                    <span className={`absolute bottom-2 right-2 h-5 w-5 rounded-full ring-4 ring-white ${isActive ? "bg-emerald-500" : "bg-gray-400"}`} />
                  )}
                </button>

                {/* name block */}
                <div className="min-w-0 text-center sm:pb-1 sm:text-left">
                  <h1 className="truncate text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">{name}</h1>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {employee.designation || "Team member"}
                    {dept?.dep_name && <> · <span className="font-semibold text-gray-700">{dept.dep_name}</span></>}
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
                    {employee.employeeId && (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 font-mono text-[11px] font-semibold text-gray-600">
                        <Fingerprint size={11} /> {employee.employeeId}
                      </span>
                    )}
                    {typeof isActive === "boolean" &&
                      (isActive ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-gray-400" /> Inactive
                        </span>
                      ))}
                    {role && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold capitalize text-amber-700">
                        <ShieldCheck size={11} /> {role}
                      </span>
                    )}
                    {joined && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">
                        <BadgeCheck size={11} /> Since {joined.getFullYear()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* actions */}
              <div className="flex flex-wrap justify-center gap-2 sm:justify-end sm:pb-1">
                {employee.userId?.email && (
                  <a
                    href={`mailto:${employee.userId.email}`}
                    className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-sm ring-1 ring-red-100 transition hover:text-red-600 hover:ring-red-200"
                  >
                    <Mail size={16} /> Email
                  </a>
                )}
                {dept?._id && (
                  <button
                    onClick={() => navigate(`/admin-dashboard/department/${dept._id}/employees`)}
                    className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-gray-700 shadow-sm ring-1 ring-red-100 transition hover:text-red-600 hover:ring-red-200"
                  >
                    <Users size={16} /> Team
                  </button>
                )}
                <button
                  onClick={() => navigate(editPath)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98]"
                >
                  <Pencil size={16} /> Edit profile
                </button>
              </div>
            </div>

            {/* quick stats */}
            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat icon={Clock} label="Time with us" value={tenureFrom(employee.dateOfJoining)} tone="bg-red-50 text-red-600" />
              <Stat icon={Briefcase} label="Total experience" value={experience} tone="bg-sky-50 text-sky-600" />
              <Stat icon={Cake} label={bdayIn === 0 ? "Birthday today 🎉" : "Age"} value={age !== null ? `${age} years` : ""} tone="bg-pink-50 text-pink-600" />
              <Stat icon={Droplets} label="Blood group" value={employee.bloodGroup} tone="bg-rose-50 text-rose-600" />
            </div>
          </div>
        </motion.div>

        {/* ================= DETAILS GRID ================= */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* personal */}
          <Card icon={User} title="Personal details" i={0}>
            <InfoRow icon={Mail} label="Email address" value={employee.userId?.email} copy />
            <InfoRow
              icon={Calendar}
              label="Date of birth"
              value={fmtDate(employee.dob)}
              sub={bdayIn !== null ? (bdayIn === 0 ? "Birthday is today 🎉" : `Next birthday in ${bdayIn} day${bdayIn === 1 ? "" : "s"}`) : ""}
            />
            <InfoRow icon={User} label="Gender" value={employee.gender} />
            <InfoRow icon={Heart} label="Marital status" value={employee.maritalStatus} />
            <InfoRow icon={Droplets} label="Blood group" value={employee.bloodGroup} />
          </Card>

          {/* work */}
          <Card icon={Briefcase} title="Work details" i={1}>
            <InfoRow icon={Fingerprint} label="Employee ID" value={employee.employeeId} mono copy />
            <InfoRow icon={Briefcase} label="Designation" value={employee.designation} />
            <InfoRow icon={Building2} label="Department" value={dept?.dep_name} />
            <InfoRow icon={Calendar} label="Joined on" value={fmtDate(employee.dateOfJoining)} sub={tenureFrom(employee.dateOfJoining)} />
            <InfoRow icon={Clock} label="Total experience" value={experience} />
          </Card>

          {/* documents */}
          <Card
            icon={IdCard}
            title="Identity documents"
            i={2}
            right={
              docCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowSensitive((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gray-50 px-2.5 py-1.5 text-[11px] font-bold text-gray-600 ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200"
                >
                  {showSensitive ? <><EyeOff size={13} /> Hide</> : <><Eye size={13} /> Show</>}
                </button>
              )
            }
          >
            <InfoRow icon={IdCard} label="Aadhaar number" value={employee.aadharcard} mono copy sensitive revealed={showSensitive} />
            <InfoRow icon={CreditCard} label="PAN number" value={employee.pancard} mono copy sensitive revealed={showSensitive} />
            <InfoRow icon={PiggyBank} label="PF number" value={employee.pfNumber} mono copy sensitive revealed={showSensitive} />
            <p className="flex items-center gap-1.5 px-3 pb-2 pt-1 text-[11px] text-gray-400">
              <ShieldCheck size={12} className="text-emerald-500" />
              {docCount ? `${docCount} of 3 on file · hidden by default` : "No documents on file yet"}
            </p>
          </Card>
        </div>

        {/* ================= COMPENSATION ================= */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.32, duration: 0.45 } }}
          className="relative mt-6 overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-gray-900 to-red-950 p-6 text-white shadow-[0_24px_60px_-20px_rgba(127,29,29,0.5)] sm:p-8"
        >
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-red-600/30 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-10 right-10 opacity-[0.07]"><Wallet size={160} strokeWidth={1} /></div>

          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-red-300">
                <IndianRupee size={13} /> Annual compensation
              </p>
              <p className="mt-2 text-4xl font-extrabold tracking-tight tabular-nums sm:text-5xl">
                {hasSalary ? (showSalary ? `₹${salary.toLocaleString("en-IN")}` : "₹ ••••••") : <span className="text-white/40">Not set</span>}
              </p>
              {hasSalary && showSalary && (
                <p className="mt-1 text-sm text-white/60">
                  ≈ ₹{Math.round(salary / 12).toLocaleString("en-IN")} per month
                </p>
              )}
            </div>
            {hasSalary && (
              <button
                type="button"
                onClick={() => setShowSalary((v) => !v)}
                className="inline-flex items-center gap-2 self-start rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20 md:self-auto"
              >
                {showSalary ? <><EyeOff size={16} /> Hide salary</> : <><Eye size={16} /> Show salary</>}
              </button>
            )}
          </div>
        </motion.section>
      </div>

      {/* ================= IMAGE LIGHTBOX ================= */}
      <AnimatePresence>
        {isImageOpen && hasPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsImageOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/85 p-6 backdrop-blur-md"
          >
            <button
              onClick={() => setIsImageOpen(false)}
              className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/20 transition hover:rotate-90 hover:bg-red-600"
              aria-label="Close"
            >
              <X size={18} />
            </button>
            <motion.figure
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="text-center"
            >
              <img src={photo} alt={name} className="max-h-[80vh] max-w-full rounded-3xl object-contain shadow-2xl" />
              <figcaption className="mt-4 text-sm font-semibold text-white/80">{name}</figcaption>
            </motion.figure>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ================= LOADING / ERROR ================= */
const LoadingView = () => (
  <div className={`min-h-screen px-4 pt-6 sm:px-8 ${PAGE_BG}`}>
    <div className="mx-auto max-w-6xl space-y-6">
      <Skeleton className="h-11 w-28" />
      <div className="overflow-hidden rounded-[2rem] bg-white/60">
        <div className="h-32 animate-pulse bg-red-200/50 sm:h-40" />
        <div className="space-y-4 p-6 sm:p-8">
          <div className="flex items-end gap-4">
            <div className="-mt-20 h-32 w-32 animate-pulse rounded-[2rem] bg-white" />
            <div className="flex-1 space-y-2"><Skeleton className="h-7 w-1/3" /><Skeleton className="h-4 w-1/4" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-72" />)}</div>
    </div>
  </div>
);

const ErrorView = ({ message, onRetry, onBack }) => (
  <div className={`flex min-h-screen items-center justify-center p-6 font-sans ${PAGE_BG}`}>
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-sm overflow-hidden rounded-[2rem] bg-white text-center shadow-[0_40px_90px_-20px_rgba(127,29,29,0.35)] ring-1 ring-red-100"
    >
      <div className="h-1.5 bg-gradient-to-r from-red-600 via-rose-500 to-orange-400" />
      <div className="p-8">
        <span className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl ${message ? "bg-amber-50 text-amber-500" : "bg-red-50 text-red-400"}`}>
          {message ? <AlertTriangle size={28} /> : <User size={28} />}
        </span>
        <h2 className="text-xl font-extrabold tracking-tight text-gray-900">{message ? "Couldn't load profile" : "Employee not found"}</h2>
        <p className="mt-2 text-sm text-gray-500">{message || "This person may have been removed, or the link is wrong."}</p>
        <div className="mt-6 flex gap-2">
          <button onClick={onBack} className="flex-1 rounded-2xl bg-gray-50 py-3 text-sm font-bold text-gray-600 ring-1 ring-gray-200 transition hover:bg-white hover:text-gray-900">
            Go back
          </button>
          {onRetry && (
            <button onClick={onRetry} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30">
              <RefreshCw size={15} /> Try again
            </button>
          )}
        </div>
      </div>
    </motion.div>
  </div>
);

export default EmployeeView;
