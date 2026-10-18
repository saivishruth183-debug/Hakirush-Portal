import axios from "axios";
import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2, Calendar, ChevronLeft, Globe, Trophy, Edit, Fingerprint, Copy, Check,
  Crown, Handshake, CalendarCheck2, Radio, Award, Megaphone, CalendarClock, Clock,
  RefreshCw, SearchX, WifiOff, X, Sparkles,
} from "lucide-react";

const PAGE_BG =
  "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const CARD =
  "rounded-3xl bg-white/90 ring-1 ring-white/70 shadow-[0_10px_40px_-12px_rgba(127,29,29,0.18)] backdrop-blur";

const COLLAB_META = {
  "Title Sponsor": { icon: Crown, chip: "bg-red-50 text-red-700 ring-red-100", blurb: "Headline partner" },
  "Associate Sponsor": { icon: Handshake, chip: "bg-violet-50 text-violet-700 ring-violet-100", blurb: "Co-branded partner" },
  "Event Sponsor": { icon: CalendarCheck2, chip: "bg-amber-50 text-amber-700 ring-amber-100", blurb: "Backs specific events" },
  "Media Partner": { icon: Radio, chip: "bg-sky-50 text-sky-700 ring-sky-100", blurb: "Coverage & promotion" },
};

const AVATAR_BG = ["from-red-500 to-rose-400", "from-violet-500 to-fuchsia-400", "from-sky-500 to-cyan-400", "from-amber-500 to-orange-400", "from-emerald-500 to-teal-400"];
const colorFor = (s = "") => AVATAR_BG[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_BG.length];

const sinceLabel = (d) => {
  if (!d || isNaN(d)) return null;
  const now = new Date();
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) months--;
  if (months < 1) return "New this month";
  const y = Math.floor(months / 12), m = months % 12;
  return [y && `${y} yr${y > 1 ? "s" : ""}`, m && `${m} mo`].filter(Boolean).join(" ");
};

const SponsorView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sponsor, setSponsor] = useState(null);
  const [loading, setLoading] = useState(true);
  // UI-only
  const [failed, setFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  const fetchSponsor = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/api/sponsors/${id}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      if (res.data?.success) setSponsor(res.data.sponsor);
    } catch (error) {
      console.error("Failed to load sponsor record.", error);
      if (error?.response?.status !== 404) setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchSponsor(); }, [fetchSponsor]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e) => e.key === "Escape" && setLightbox(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const getImageUrl = (url) => {
    if (!url) return "/default-avatar.png";
    if (url.startsWith("http")) return url;
    return `${import.meta.env.VITE_BACKEND_URL}/${url.replace(/^\/+/, "")}`;
  };

  const initials = React.useMemo(() => {
    const name = sponsor?.name || "";
    return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  }, [sponsor]);

  if (loading) return <LoadingSkeleton />;
  if (!sponsor && failed) return <ErrorView onRetry={fetchSponsor} />;
  if (!sponsor) return <NotFoundView />;

  const name = sponsor.name || "N/A";
  const meta = COLLAB_META[sponsor.collaboration];
  const CollabIcon = meta?.icon || Award;
  const created = sponsor.createdAt ? new Date(sponsor.createdAt) : null;
  const createdLong = created ? created.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "N/A";
  const hasLogo = !!sponsor.logo && !logoFailed;
  const events = sponsor.eventsSponsored ?? 0;
  const eventsNum = Number(events);

  return (
    <div className={`relative min-h-screen ${PAGE_BG} p-4 pb-16 text-gray-900 sm:p-6 lg:p-8`}>
      {/* Logo lightbox */}
      <AnimatePresence>
        {lightbox && hasLogo && (
          <motion.div role="dialog" aria-modal="true" aria-label="Sponsor logo"
            className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/70 p-6 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setLightbox(false)}>
            <button aria-label="Close" className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><X size={18} /></button>
            <motion.img src={getImageUrl(sponsor.logo)} alt={`${name} logo`}
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
              <defs><pattern id="sv-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.5" fill="white" /></pattern></defs>
              <rect width="100%" height="100%" fill="url(#sv-dots)" />
            </svg>
            <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-white ring-1 ring-white/25 backdrop-blur">
              <Sparkles size={12} /> Partner since {created ? created.getFullYear() : "—"}
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
                    <img src={getImageUrl(sponsor.logo)} alt="Sponsor logo" className="h-full w-full object-cover" onError={() => setLogoFailed(true)} />
                  ) : (
                    <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${colorFor(name)} text-3xl font-extrabold text-white`}>
                      {initials || <Building2 size={30} />}
                    </div>
                  )}
                </motion.button>
                <div className="min-w-0 sm:pt-4">
                  <h1 className="break-words text-2xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-3xl">{name}</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${meta?.chip || "bg-gray-100 text-gray-600 ring-gray-200"}`}>
                      <CollabIcon size={12} /> {sponsor.collaboration || "Partner"}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                      <Award size={12} /> Sponsor
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 gap-2 lg:pt-4">
                <button
                  onClick={() => navigate(`/admin-dashboard/sponsors/edit/${sponsor._id}`)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:-translate-y-0.5 hover:brightness-110 active:scale-95 sm:flex-none"
                >
                  <Edit size={15} /> Edit sponsor
                </button>
              </div>
            </div>

            {/* Quick stats */}
            <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat icon={Trophy} tone="from-red-600 to-rose-500" label="Events sponsored"
                value={Number.isFinite(eventsNum) ? eventsNum.toLocaleString("en-IN") : events}
                sub={eventsNum === 1 ? "event so far" : "events so far"} />
              <Stat icon={Megaphone} tone="from-emerald-500 to-teal-400" label="Market reach" value={sponsor.reach || "—"} sub={sponsor.reach ? "audience" : "Not recorded"} />
              <Stat icon={CollabIcon} tone="from-violet-500 to-fuchsia-400" label="Tier" value={sponsor.collaboration?.replace(/\s*(Sponsor|Partner)$/i, "") || "—"} sub={meta?.blurb || "Collaboration"} />
              <Stat icon={Clock} tone="from-amber-500 to-orange-400" label="With us" value={sinceLabel(created) || "—"}
                sub={created ? `since ${created.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}` : "No date"} />
            </div>
          </div>
        </motion.section>

        {/* ============ DETAILS ============ */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
          <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className={`${CARD} p-5 sm:p-6 lg:col-span-3`}>
            <CardTitle icon={<Fingerprint size={15} />} title="Sponsor details" />
            <dl className="mt-4 divide-y divide-gray-100">
              <Row icon={Building2} label="Legal entity" value={sponsor.name} />
              <Row icon={Handshake} label="Collaboration" value={sponsor.collaboration} />
              <Row icon={Trophy} label="Events sponsored" value={String(events)} />
              <Row icon={Globe} label="Market reach" value={sponsor.reach} />
              <Row icon={Calendar} label="Added to directory" value={createdLong} />
              <Row icon={Fingerprint} label="Sponsor ID" value={sponsor.sponsorId || sponsor._id} copy mono />
            </dl>
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-gray-900 to-red-950 p-6 text-white shadow-[0_20px_50px_-15px_rgba(127,29,29,0.5)] lg:col-span-2">
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-red-500/30 blur-3xl" />
            <div className="relative flex h-full flex-col">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-red-200/80"><CalendarClock size={12} /> Upcoming events</p>
              {sponsor.upcomingEvents ? (
                <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-white/90">{sponsor.upcomingEvents}</p>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-white/15 p-5 text-center">
                  <CalendarClock size={22} className="mx-auto text-white/30" />
                  <p className="mt-2 text-sm font-semibold text-white/70">Nothing scheduled yet</p>
                  <p className="text-xs text-white/40">Add upcoming collaborations from the edit page.</p>
                </div>
              )}
              <div className="mt-auto pt-6">
                <button
                  onClick={() => navigate(`/admin-dashboard/sponsors/edit/${sponsor._id}`)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 py-3 text-sm font-semibold ring-1 ring-white/15 transition hover:bg-white hover:text-gray-900"
                >
                  <Edit size={14} /> {sponsor.upcomingEvents ? "Update pipeline" : "Add upcoming events"}
                </button>
              </div>
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
};

/* ===== SUPPORTING COMPONENTS ===== */

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

const Row = ({ icon: Icon, label, value, copy, mono }) => {
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
          {value ? value : <span className="text-gray-300">—</span>}
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
          <div className="flex items-start gap-5">
            <div className="-mt-12 h-24 w-24 rounded-3xl bg-gray-200 ring-4 ring-white sm:h-28 sm:w-28" />
            <div className="space-y-2 pt-4"><div className="h-6 w-48 rounded bg-gray-200" /><div className="h-4 w-32 rounded bg-gray-100" /></div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl bg-gray-100" />)}
          </div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className={`${CARD} h-80 lg:col-span-3`} />
        <div className="h-80 rounded-3xl bg-gray-300/60 lg:col-span-2" />
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
  <StateCard icon={SearchX} tone="bg-gray-50 text-gray-400 ring-gray-100" title="Sponsor not found"
    text="This sponsor may have been deleted, or the link is wrong.">
    <button onClick={() => window.history.back()}
      className="w-full rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 hover:brightness-110">
      Go back
    </button>
  </StateCard>
);

const ErrorView = ({ onRetry }) => (
  <StateCard icon={WifiOff} tone="bg-red-50 text-red-500 ring-red-100" title="Couldn't load sponsor"
    text="Something went wrong while loading this sponsor. Check your connection and try again.">
    <button onClick={() => window.history.back()} className="flex-1 rounded-2xl bg-gray-100 py-3 text-sm font-bold text-gray-700 hover:bg-gray-200">
      Go back
    </button>
    <button onClick={onRetry}
      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 hover:brightness-110">
      <RefreshCw size={15} /> Retry
    </button>
  </StateCard>
);

export default SponsorView;