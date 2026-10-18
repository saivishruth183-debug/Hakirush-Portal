import axios from "axios";
import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar, ChevronLeft, Building2, Mail, CreditCard, Edit, Fingerprint,
  Copy, Check, Wallet, Clock, Crown, CalendarRange, Send, RefreshCw,
  SearchX, WifiOff, X, Sparkles,
} from "lucide-react";
import ClientMediaAdmin from "./ClientMediaAdmin";

const PAGE_BG =
  "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const CARD =
  "rounded-3xl bg-white/90 ring-1 ring-white/70 shadow-[0_10px_40px_-12px_rgba(127,29,29,0.18)] backdrop-blur";

const AVATAR_BG = ["from-red-500 to-rose-400", "from-violet-500 to-fuchsia-400", "from-sky-500 to-cyan-400", "from-amber-500 to-orange-400", "from-emerald-500 to-teal-400"];
const colorFor = (s = "") => AVATAR_BG[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_BG.length];

const PLAN_META = {
  Annual: { label: "Annual Premium", icon: Crown, chip: "bg-red-50 text-red-700 ring-red-100" },
  Quarterly: { label: "Quarterly Standard", icon: CalendarRange, chip: "bg-violet-50 text-violet-700 ring-violet-100" },
};

const tenureOf = (d) => {
  if (!d) return null;
  const start = new Date(d);
  if (isNaN(start)) return null;
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months--;
  if (months < 0) return "Starts soon";
  if (months < 1) return "New this month";
  const y = Math.floor(months / 12), m = months % 12;
  return [y && `${y} yr${y > 1 ? "s" : ""}`, m && `${m} mo`].filter(Boolean).join(" ");
};

const compactINR = (n) => {
  n = Number(n) || 0;
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)} Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(1)} L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)} K`;
  return String(n);
};

const ViewClient = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  // UI-only
  const [failed, setFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  const fetchClient = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/api/client/${id}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      if (res.data?.success) setClient(res.data.client);
    } catch (err) {
      console.error("Failed to load profile");
      // a 404 means not found; anything else is a load failure we can retry
      if (err?.response?.status !== 404) setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchClient(); }, [fetchClient]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e) => e.key === "Escape" && setLightbox(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const getImageUrl = (imagePath) => {
    if (!imagePath) return "/default-avatar.png";
    if (imagePath.startsWith("http")) return imagePath;
    return `${import.meta.env.VITE_BACKEND_URL}/${imagePath.replace(/^\/+/, "")}`;
  };

  const initials = React.useMemo(() => {
    const name = client?.userId?.name || "";
    return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  }, [client]);

  if (loading) return <LoadingSkeleton />;
  if (!client && failed) return <ErrorView onRetry={fetchClient} />;
  if (!client) return <NotFoundView />;

  const name = client?.userId?.name || "N/A";
  const email = client?.userId?.email;
  const plan = PLAN_META[client.planType];
  const PlanIcon = plan?.icon || CreditCard;
  const joined = client.dateOfJoining ? new Date(client.dateOfJoining) : null;
  const joinedLong = joined ? joined.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "—";
  const tenure = tenureOf(client.dateOfJoining);
  const hasLogo = client?.companyLogo && !logoFailed;
  const budget = Number(client.budget || 0);

  return (
    <div className={`relative min-h-screen ${PAGE_BG} p-4 pb-16 text-gray-900 sm:p-6 lg:p-8`}>
      {/* Logo lightbox */}
      <AnimatePresence>
        {lightbox && hasLogo && (
          <motion.div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/70 p-6 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setLightbox(false)}>
            <button aria-label="Close" className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><X size={18} /></button>
            <motion.img src={getImageUrl(client.companyLogo)} alt={`${name} logo`}
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="max-h-[80vh] max-w-full rounded-3xl bg-white object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto max-w-5xl">
        <button
          onClick={() => navigate(-1)}
          className="group mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-gray-500 ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200"
        >
          <ChevronLeft size={14} className="transition-transform group-hover:-translate-x-0.5" /> Back
        </button>

        {/* ============ HERO ============ */}
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className={`${CARD} overflow-hidden`}>
          <div className="relative h-32 bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 sm:h-40">
            <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/15 blur-2xl" />
            <div className="absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-rose-300/30 blur-2xl" />
            <svg className="absolute inset-0 h-full w-full opacity-[0.08]" aria-hidden="true">
              <defs><pattern id="vc-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.5" fill="white" /></pattern></defs>
              <rect width="100%" height="100%" fill="url(#vc-dots)" />
            </svg>
            <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-white ring-1 ring-white/25 backdrop-blur">
              <Sparkles size={12} /> Partner since {joined ? joined.getFullYear() : "—"}
            </span>
          </div>

          <div className="px-5 pb-6 sm:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:gap-5">
                <motion.button
                  type="button"
                  whileHover={hasLogo ? { scale: 1.04 } : {}}
                  onClick={() => hasLogo && setLightbox(true)}
                  className={`relative z-10 -mt-12 h-24 w-24 shrink-0 overflow-hidden rounded-3xl bg-white shadow-xl ring-4 ring-white sm:-mt-14 sm:h-28 sm:w-28 ${hasLogo ? "cursor-zoom-in" : "cursor-default"}`}
                  aria-label={hasLogo ? "View logo" : undefined}
                >
                  {hasLogo ? (
                    <img src={getImageUrl(client.companyLogo)} alt="Company logo" className="h-full w-full object-cover" onError={() => setLogoFailed(true)} />
                  ) : (
                    <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${colorFor(name)} text-3xl font-extrabold text-white`}>
                      {initials || <Building2 size={30} />}
                    </div>
                  )}
                </motion.button>
                <div className="min-w-0 sm:pt-4">
                  <h1 className="break-words text-2xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-3xl">{name}</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${plan?.chip || "bg-gray-100 text-gray-500 ring-gray-200"}`}>
                      <PlanIcon size={12} /> {plan?.label || client.planType || "Unassigned plan"}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                      <Building2 size={12} /> Client account
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 gap-2 lg:pt-4">
                {email && (
                  <a href={`mailto:${email}`}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-gray-700 ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200 sm:flex-none">
                    <Send size={15} /> Email
                  </a>
                )}
                <button
                  onClick={() => navigate(`/admin-dashboard/clients/edit/${client._id}`)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:-translate-y-0.5 hover:brightness-110 active:scale-95 sm:flex-none"
                >
                  <Edit size={15} /> Edit profile
                </button>
              </div>
            </div>

            {/* Quick stats */}
            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat icon={Wallet} tone="from-emerald-500 to-teal-400" label="Budget" value={`₹${compactINR(budget)}`} sub={`₹${budget.toLocaleString("en-IN")}`} />
              <Stat icon={PlanIcon} tone="from-red-600 to-rose-500" label="Plan" value={client.planType || "—"} sub={plan ? (client.planType === "Annual" ? "Billed yearly" : "Billed quarterly") : "Not set"} />
              <Stat icon={Clock} tone="from-violet-500 to-fuchsia-400" label="With us" value={tenure || "—"} sub={joined ? `since ${joined.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}` : "No join date"} />
              <Stat icon={Calendar} tone="from-amber-500 to-orange-400" label="Joined" value={joined ? joined.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"} sub={joined ? String(joined.getFullYear()) : ""} />
            </div>
          </div>
        </motion.section>

        {/* ============ DETAILS ============ */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
          <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className={`${CARD} p-5 sm:p-6 lg:col-span-3`}>
            <CardTitle icon={<Fingerprint size={15} />} title="Account details" />
            <dl className="mt-4 divide-y divide-gray-100">
              <Row icon={Building2} label="Company name" value={client.userId?.name} />
              <Row icon={Mail} label="Contact email" value={email} copy href={email ? `mailto:${email}` : undefined} />
              <Row icon={CreditCard} label="Billing tier" value={plan?.label || client.planType} />
              <Row icon={Calendar} label="Partner since" value={joinedLong} />
              <Row icon={Fingerprint} label="Client ID" value={client.clientId || client._id} copy mono />
            </dl>
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-gray-900 to-red-950 p-6 text-white shadow-[0_20px_50px_-15px_rgba(127,29,29,0.5)] lg:col-span-2">
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-red-500/30 blur-3xl" />
            <div className="relative flex h-full flex-col">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-red-200/80"><Wallet size={12} /> Contract budget</p>
              <p className="mt-3 text-4xl font-extrabold tracking-tight">₹{budget.toLocaleString("en-IN")}</p>
              <p className="mt-1 text-sm text-white/60">{client.planType ? `${plan?.label || client.planType} plan` : "No plan assigned"}</p>

              {client.planType === "Quarterly" && budget > 0 && (
                <div className="mt-5 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                  <p className="text-[11px] uppercase tracking-wider text-white/50">Per quarter (if billed evenly)</p>
                  <p className="text-lg font-bold">₹{Math.round(budget / 4).toLocaleString("en-IN")}</p>
                </div>
              )}

              <div className="mt-auto pt-6">
                <button
                  onClick={() => navigate(`/admin-dashboard/clients/edit/${client._id}`)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 py-3 text-sm font-semibold ring-1 ring-white/15 transition hover:bg-white hover:text-gray-900"
                >
                  <Edit size={14} /> Update plan or budget
                </button>
              </div>
            </div>
          </motion.section>
        </div>

        {/* Admin management: client gallery + performance standings */}
        <ClientMediaAdmin clientId={client._id} />
      </div>
    </div>
  );
};

// --- SUPPORTING COMPONENTS ---

const Stat = ({ icon: Icon, tone, label, value, sub }) => (
  <div className="flex items-center gap-3 rounded-2xl bg-gray-50/80 p-3.5 ring-1 ring-gray-100">
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${tone} text-white shadow-md`}>
      <Icon size={17} />
    </div>
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <p className="truncate text-base font-extrabold text-gray-900">{value}</p>
      {sub && <p className="truncate text-[11px] text-gray-400">{sub}</p>}
    </div>
  </div>
);

const CardTitle = ({ icon, title }) => (
  <div className="flex items-center gap-3">
    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600">{icon}</div>
    <h2 className="text-base font-bold text-gray-900">{title}</h2>
  </div>
);

const Row = ({ icon: Icon, label, value, copy, mono, href }) => {
  const [copied, setCopied] = useState(false);
  const doCopy = async () => {
    try { await navigator.clipboard.writeText(String(value)); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch { /* ignore */ }
  };
  return (
    <div className="group flex items-center gap-3 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-400 transition group-hover:bg-red-50 group-hover:text-red-500">
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</dt>
        <dd className={`truncate text-sm font-semibold text-gray-900 ${mono ? "font-mono text-xs" : ""}`}>
          {value ? (href ? <a href={href} className="hover:text-red-600 hover:underline">{value}</a> : value) : <span className="text-gray-300">—</span>}
        </dd>
      </div>
      {copy && value && (
        <button onClick={doCopy} aria-label={`Copy ${label}`} title="Copy"
          className="rounded-lg p-2 text-gray-300 transition hover:bg-gray-100 hover:text-gray-700 sm:opacity-0 sm:group-hover:opacity-100">
          {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
        </button>
      )}
    </div>
  );
};

const LoadingSkeleton = () => (
  <div className={`min-h-screen ${PAGE_BG} p-4 sm:p-6 lg:p-8`}>
    <div className="mx-auto max-w-5xl animate-pulse">
      <div className="mb-4 h-7 w-20 rounded-full bg-white/80" />
      <div className={`${CARD} overflow-hidden`}>
        <div className="h-32 bg-red-200/60 sm:h-40" />
        <div className="px-5 pb-6 sm:px-8">
          <div className="-mt-12 flex items-end gap-4">
            <div className="h-24 w-24 rounded-3xl bg-gray-200 ring-4 ring-white sm:h-28 sm:w-28" />
            <div className="space-y-2 pb-2"><div className="h-6 w-48 rounded bg-gray-200" /><div className="h-4 w-32 rounded bg-gray-100" /></div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl bg-gray-100" />)}
          </div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className={`${CARD} h-72 lg:col-span-3`} />
        <div className="h-72 rounded-3xl bg-gray-300/60 lg:col-span-2" />
      </div>
    </div>
  </div>
);

const StateCard = ({ icon: Icon, tone, title, text, children }) => (
  <div className={`flex min-h-screen items-center justify-center p-6 ${PAGE_BG}`}>
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className={`${CARD} w-full max-w-sm p-8 text-center`}>
      <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ring-1 ${tone}`}><Icon size={28} /></div>
      <h2 className="text-xl font-extrabold tracking-tight text-gray-900">{title}</h2>
      <p className="mt-2 text-sm text-gray-500">{text}</p>
      <div className="mt-6 flex gap-2">{children}</div>
    </motion.div>
  </div>
);

const NotFoundView = () => (
  <StateCard icon={SearchX} tone="bg-gray-50 text-gray-400 ring-gray-100" title="Client not found"
    text="This client may have been deleted, or the link is wrong.">
    <button onClick={() => window.history.back()}
      className="w-full rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 hover:brightness-110">
      Go back
    </button>
  </StateCard>
);

const ErrorView = ({ onRetry }) => (
  <StateCard icon={WifiOff} tone="bg-red-50 text-red-500 ring-red-100" title="Couldn't load client"
    text="Something went wrong while loading this profile. Check your connection and try again.">
    <button onClick={() => window.history.back()} className="flex-1 rounded-2xl bg-gray-100 py-3 text-sm font-bold text-gray-700 hover:bg-gray-200">
      Go back
    </button>
    <button onClick={onRetry}
      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 hover:brightness-110">
      <RefreshCw size={15} /> Retry
    </button>
  </StateCard>
);

export default ViewClient;