import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/authContext";
import { motion, AnimatePresence } from "framer-motion";
import Cricket from "../../assets/cricket.png";
import {
  Trophy,
  Users,
  Medal,
  X,
  MapPin,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Zap,
  Target,
  ShieldCheck,
  Activity,
  BarChart3,
  Bell,
  Images,
  Maximize2,
  Pause,
  Play,
  Inbox,
  Crown,
  Search,
  Shirt,
  Clock,
  Fingerprint,
  LayoutGrid,
  List,
} from "lucide-react";

const fallbackImage = Cricket;
const API = import.meta.env.VITE_BACKEND_URL;

/* ================= THEME UTILS ================= */
const getStatusBadgeClass = (status) => {
  switch ((status || "").toLowerCase()) {
    case "upcoming": return "text-amber-700 border-amber-200 bg-amber-50";
    case "ongoing": return "text-emerald-700 border-emerald-200 bg-emerald-50";
    case "completed": return "text-slate-500 border-slate-200 bg-slate-50";
    default: return "text-red-700 border-red-200 bg-red-50";
  }
};

const getPoints = (t) => t.points ?? (t.won || 0) * 2;
const getWinRate = (t) => (t.played ? Math.round(((t.won || 0) / t.played) * 100) : 0);

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4, ease: "easeOut" } }),
};

const normalizeRosterEntry = (entry, i) => ({
  id: entry._id || entry.id || i,
  name: entry.name || "Unnamed",
  team: entry.event || "Other",
  event: entry.event || "Event not specified",
  jerseySize: entry.jerseySize || "—",
  joined: entry.createdAt,
});

const avatarColors = [
  "from-red-500 to-rose-600",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-violet-500 to-purple-600",
  "from-slate-600 to-slate-800",
];
const colorFor = (str = "") => avatarColors[[...str].reduce((s, c) => s + c.charCodeAt(0), 0) % avatarColors.length];
const initials = (name = "") => name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";

/* ================= MAIN PAGE ================= */
const ClientSportsPlan = () => {
  const { user } = useAuth();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState([]);
  const [activeAnnouncement, setActiveAnnouncement] = useState(null);
  const [performanceData, setPerformanceData] = useState([]);
  const [clientImages, setClientImages] = useState([]);
  const [sharedImages, setSharedImages] = useState([]);
  const [galleryMonth, setGalleryMonth] = useState("");
  const [zoomImage, setZoomImage] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [activeEmployee, setActiveEmployee] = useState(null);

  useEffect(() => {
    if (!user?._id) return;
    const fetchData = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };
        const [clientRes, annRes, perfRes, imagesRes, rosterRes] = await Promise.all([
          axios.get(`${API}/api/client/me`, { headers }),
          axios.get(`${API}/api/announcements/public`, { headers }),
          axios.get(`${API}/api/client/shared/performance`, { headers }),
          axios
            .get(`${API}/api/client/me/gallery`, { headers })
            .catch(() => ({ data: { images: [], sharedImages: [], galleryMonth: "" } })),
          axios.get(`${API}/api/client/me/roster`, { headers }),
        ]);
        const found = clientRes.data.client;
        setClient(found || null);
        setAnnouncements(annRes.data.announcements || []);
        setPerformanceData(perfRes.data.standings || []);
        setClientImages((imagesRes.data.images || []).map((image) => image.url));
        setSharedImages((imagesRes.data.sharedImages || []).map((image) => image.url));
        setGalleryMonth(imagesRes.data.galleryMonth || "");

        const rosterEntries = rosterRes.data?.entries;
        if (!Array.isArray(rosterEntries)) throw new Error("The server returned invalid roster data.");
        setEmployees(rosterEntries.map(normalizeRosterEntry));
      } catch (err) {
        console.error("Connection Interrupted", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  // Close modals with Escape + lock background scroll while open
  useEffect(() => {
    const open = zoomImage || activeAnnouncement || activeEmployee;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (zoomImage) setZoomImage(null);
      else if (activeEmployee) setActiveEmployee(null);
      else setActiveAnnouncement(null);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [zoomImage, activeAnnouncement, activeEmployee]);

  const sortedTeams = useMemo(
    () => [...performanceData].sort((a, b) => (b.won || 0) - (a.won || 0) || getPoints(b) - getPoints(a)),
    [performanceData]
  );

  const stats = useMemo(() => {
    const played = performanceData.reduce((s, t) => s + (t.played || 0), 0);
    const won = performanceData.reduce((s, t) => s + (t.won || 0), 0);
    const points = performanceData.reduce((s, t) => s + getPoints(t), 0);
    return {
      teams: performanceData.length,
      played,
      won,
      points,
      winRate: played ? Math.round((won / played) * 100) : 0,
    };
  }, [performanceData]);

  const galleries = useMemo(
    () => {
      const monthLabel = galleryMonth
        ? new Date(`${galleryMonth}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
        : "Last Month";
      return [
        { id: "shared", label: `${monthLabel} Highlights`, short: monthLabel, images: sharedImages, interval: 6000 },
        { id: "client", label: "Client Gallery", short: "Your's Gallery", images: clientImages, interval: 5000 },
      ];
    },
    [galleryMonth, sharedImages, clientImages]
  );

  if (loading) return <LoadingScreen />;
  if (!client) return <AccessPending />;

  const orgName = client?.userId?.name;
  const plan = client.planType;

  return (
    <div className="min-h-screen lg:h-screen bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)] text-slate-900 font-sans lg:overflow-hidden selection:bg-red-200/60">
      <div className="flex flex-col lg:flex-row lg:h-full">
        {/* ================= MAIN ================= */}
        <main className="flex-1 lg:overflow-y-auto">
          {/* HERO */}
          <section className="relative overflow-hidden bg-slate-950 text-white">
            <img src={fallbackImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-red-950/70" />
            <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-red-600/30 blur-3xl" />

            <div className="relative max-w-6xl mx-auto px-6 md:px-10 py-10 md:py-14">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <motion.div initial="hidden" animate="show" variants={fadeUp}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">Live dashboard</span>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Welcome back</p>
                  <h1 className="mt-1 text-3xl md:text-5xl font-black tracking-tight">{orgName}</h1>
                  <p className="mt-3 text-sm text-slate-300 max-w-md">
                    Track your squads, your people, tournament moments and every update.
                  </p>
                  <p className="mt-3 inline-flex max-w-full items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-slate-300">
                    <Fingerprint size={13} className="shrink-0 text-red-300" />
                    <span className="shrink-0 font-semibold">Client ID</span>
                    <span className="truncate font-mono" title={client.clientId || client._id}>{client.clientId || client._id}</span>
                  </p>
                </motion.div>

                <motion.div initial="hidden" animate="show" custom={1} variants={fadeUp} className="flex flex-wrap gap-3 self-start md:self-auto">
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md px-5 py-4">
                    <div className="p-2.5 rounded-xl bg-white/10">
                      <Users size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Roster Players</p>
                      <p className="text-lg font-extrabold">{employees.length}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md px-5 py-4">
                    <div className="p-2.5 rounded-xl bg-red-600 shadow-lg shadow-red-600/40">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Plan</p>
                      <p className="text-lg font-extrabold">{plan}</p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </section>

          <div className="max-w-6xl mx-auto px-6 md:px-10 -mt-8 pb-16 space-y-10 relative">
            {/* KPI CARDS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard i={0} icon={Users} label="Squads" value={stats.teams} tone="slate" />
              <StatCard i={1} icon={Activity} label="Matches Played" value={stats.played} tone="blue" />
              <StatCard i={2} icon={Trophy} label="Matches Won" value={stats.won} tone="emerald" />
              <StatCard i={3} icon={Target} label="Win Rate" value={`${stats.winRate}%`} tone="red" progress={stats.winRate} />
            </div>

            {/* PERFORMANCE */}
            <section className="space-y-6">
              <SectionTitle icon={BarChart3} eyebrow="Live standings" title="Company" accent="Performance" />
              {sortedTeams.length > 0 ? (
                <>
                  <Podium teams={sortedTeams.slice(0, 3)} />
                  <StandingsTable teams={sortedTeams} />
                </>
              ) : (
                <EmptyState icon={BarChart3} title="No standings yet" text="Performance data will appear here once matches are recorded." />
              )}
            </section>

            {/* EMPLOYEES */}
            <section className="space-y-6">
              <SectionTitle icon={Users} eyebrow="Registered players" title="Roster" accent="Details" />
              <EmployeeSection employees={employees} onSelect={setActiveEmployee} />
            </section>

            {/* MEDIA */}
            <section className="space-y-6">
              <SectionTitle icon={Images} eyebrow="Moments" title="Media" accent="Hub" />
              <MediaHub galleries={galleries} onZoom={setZoomImage} />
            </section>
          </div>
        </main>

        {/* ================= SIDEBAR ================= */}
        <aside className="w-full lg:w-[360px] flex flex-col bg-white/70 backdrop-blur-2xl border-t lg:border-t-0 lg:border-l border-slate-200/70 h-[520px] lg:h-full">
          <div className="px-6 py-5 border-b border-slate-200/70 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative p-2.5 bg-red-600 rounded-xl shadow-md shadow-red-600/30">
                <Bell size={16} className="text-white" />
                {announcements.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 border-2 border-white" />
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Updates Feed</p>
                <p className="text-[11px] text-slate-400 font-medium">Announcements & events</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-100 px-2.5 py-1 rounded-full">
              {announcements.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {announcements.length === 0 ? (
              <EmptyState icon={Inbox} title="All caught up" text="New announcements will show up here." compact />
            ) : (
              announcements.map((a, i) => (
                <motion.button
                  key={a._id}
                  initial="hidden" animate="show" custom={i} variants={fadeUp}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setActiveAnnouncement(a)}
                  className="w-full text-left flex gap-3 p-3 rounded-2xl bg-white border border-slate-200/70 hover:border-red-200 shadow-sm hover:shadow-lg hover:shadow-red-900/5 transition-all group"
                >
                  <div className="w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-red-50 to-slate-100 flex items-center justify-center">
                    {a.image ? (
                      <img src={a.image} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <Zap size={18} className="text-red-300" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {a.status && (
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${getStatusBadgeClass(a.status)}`}>
                          {a.status}
                        </span>
                      )}
                      <span className="text-[10px] font-semibold text-slate-400 truncate">{a.date}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-800 group-hover:text-red-600 transition-colors line-clamp-2 leading-snug">
                      {a.title}
                    </p>
                    {a.venue && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400 truncate">
                        <MapPin size={11} /> {a.venue}
                      </p>
                    )}
                  </div>
                </motion.button>
              ))
            )}
          </div>
        </aside>
      </div>

      {/* ================= ANNOUNCEMENT MODAL ================= */}
      <AnimatePresence>
        {activeAnnouncement && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setActiveAnnouncement(null)}
              className="absolute inset-0 bg-slate-950/50 backdrop-blur-md"
            />
            <motion.div
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              role="dialog" aria-modal="true"
              className="relative bg-white w-full max-w-2xl rounded-t-[2rem] sm:rounded-[2rem] overflow-hidden shadow-2xl z-10 flex flex-col max-h-[92vh]"
            >
              <div className="relative h-56 md:h-72 bg-slate-100 flex-shrink-0">
                {activeAnnouncement.image ? (
                  <img src={activeAnnouncement.image} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-red-600 to-slate-900 flex items-center justify-center">
                    <Activity size={48} className="text-white/30" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />
                <button
                  onClick={() => setActiveAnnouncement(null)}
                  aria-label="Close"
                  className="absolute top-4 right-4 p-2.5 bg-white/15 hover:bg-red-600 backdrop-blur border border-white/20 text-white rounded-xl transition-all"
                >
                  <X size={16} />
                </button>
                <div className="absolute bottom-0 left-0 p-6 md:p-8 w-full">
                  {activeAnnouncement.status && (
                    <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getStatusBadgeClass(activeAnnouncement.status)} mb-3`}>
                      {activeAnnouncement.status}
                    </span>
                  )}
                  <h3 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight">
                    {activeAnnouncement.title}
                  </h3>
                </div>
              </div>

              <div className="p-6 md:p-8 overflow-y-auto space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InfoPill icon={Calendar} label="Date" value={activeAnnouncement.date} />
                  <InfoPill icon={MapPin} label="Venue" value={activeAnnouncement.venue} />
                </div>
                {activeAnnouncement.description && (
                  <p className="text-slate-600 leading-relaxed text-[15px] whitespace-pre-line">
                    {activeAnnouncement.description}
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= EMPLOYEE PROFILE MODAL ================= */}
      <EmployeeModal employee={activeEmployee} onClose={() => setActiveEmployee(null)} onZoom={setZoomImage} />

      {/* ================= FULL-SCREEN IMAGE ================= */}
      <AnimatePresence>
        {zoomImage && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setZoomImage(null)}
              className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl"
            />
            <motion.img
              initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }}
              src={zoomImage}
              alt="Enlarged view"
              className="relative z-10 max-w-full max-h-[88vh] object-contain rounded-2xl shadow-2xl"
            />
            <button
              onClick={() => setZoomImage(null)}
              aria-label="Close"
              className="absolute top-5 right-5 z-20 p-3 bg-white/10 hover:bg-red-600 text-white rounded-xl transition-all border border-white/15"
            >
              <X size={18} />
            </button>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ================= SMALL PIECES ================= */
const LoadingScreen = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
    <div className="relative flex items-center justify-center">
      <div className="w-16 h-16 border-4 border-slate-200 border-t-red-600 rounded-full animate-spin" />
      <img src={fallbackImage} alt="" className="absolute w-8 h-8 object-contain opacity-70" />
    </div>
    <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.3em] text-slate-500">Loading your dashboard</p>
  </div>
);

const AccessPending = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="text-center p-12 bg-white rounded-[2rem] shadow-xl shadow-slate-200/60 border border-slate-100 max-w-sm w-full"
    >
      <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-red-100">
        <ShieldCheck size={28} className="text-red-500" />
      </div>
      <h2 className="text-slate-900 font-bold text-xl tracking-tight">Access Pending</h2>
      <p className="text-slate-500 text-sm mt-2">Your account hasn't been assigned a plan yet. Please check back soon.</p>
    </motion.div>
  </div>
);

const SectionTitle = ({ icon: Icon, eyebrow, title, accent }) => (
  <div className="flex items-center gap-4">
    <div className="p-3 rounded-2xl bg-white border border-slate-200/70 shadow-sm">
      <Icon size={20} className="text-red-600" />
    </div>
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{eyebrow}</p>
      <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
        {title} <span className="text-red-600">{accent}</span>
      </h2>
    </div>
  </div>
);

const toneMap = {
  slate: "bg-slate-900 text-white shadow-slate-900/20",
  blue: "bg-sky-500 text-white shadow-sky-500/30",
  emerald: "bg-emerald-500 text-white shadow-emerald-500/30",
  red: "bg-red-600 text-white shadow-red-600/30",
};

const StatCard = ({ icon: Icon, label, value, tone, progress, i }) => (
  <motion.div
    initial="hidden" animate="show" custom={i} variants={fadeUp}
    className="bg-white rounded-3xl border border-slate-200/70 shadow-lg shadow-slate-200/40 p-5"
  >
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${toneMap[tone]}`}>
      <Icon size={18} />
    </div>
    <p className="mt-4 text-3xl font-black tracking-tight text-slate-900">{value}</p>
    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mt-0.5">{label}</p>
    {progress !== undefined && (
      <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <motion.div
          initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.9, ease: "easeOut" }}
          className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-600"
        />
      </div>
    )}
  </motion.div>
);

const InfoPill = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
    <div className="p-2 rounded-xl bg-white border border-slate-200/70">
      <Icon size={15} className="text-red-600" />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-slate-800 truncate">{value || "—"}</p>
    </div>
  </div>
);

const EmptyState = ({ icon: Icon, title, text, compact }) => (
  <div className={`flex flex-col items-center justify-center text-center rounded-3xl border border-dashed border-slate-200 bg-white/60 ${compact ? "p-8" : "p-12"}`}>
    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 mb-3">
      <Icon size={22} className="text-slate-400" />
    </div>
    <p className="font-bold text-slate-700">{title}</p>
    <p className="text-sm text-slate-400 mt-1 max-w-xs">{text}</p>
  </div>
);

/* ================= EMPLOYEES ================= */
const Avatar = ({ emp, size = "w-14 h-14", text = "text-base", rounded = "rounded-2xl" }) =>
  emp.image ? (
    <img src={emp.image} alt={emp.name} className={`${size} ${rounded} object-cover border-2 border-white shadow-md`} />
  ) : (
    <div className={`${size} ${rounded} bg-gradient-to-br ${colorFor(emp.name)} text-white ${text} font-black flex items-center justify-center border-2 border-white shadow-md`}>
      {initials(emp.name)}
    </div>
  );

const PAGE_SIZE = 12;

const EmployeeSection = ({ employees, onSelect }) => {
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState("All");
  const [view, setView] = useState("list");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const teams = useMemo(() => {
    const counts = employees.reduce((m, e) => ({ ...m, [e.team]: (m[e.team] || 0) + 1 }), {});
    return [["All", employees.length], ...Object.entries(counts).sort((a, b) => b[1] - a[1])];
  }, [employees]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter(
      (e) =>
        (team === "All" || e.team === team) &&
        (!q || [e.name, e.event, e.jerseySize].some((v) => String(v || "").toLowerCase().includes(q)))
    );
  }, [employees, query, team]);

  useEffect(() => setVisible(PAGE_SIZE), [query, team]);

  if (employees.length === 0) {
    return <EmptyState icon={Users} title="No roster players yet" text="Players added to your roster will appear here." />;
  }

  const shown = filtered.slice(0, visible);

  return (
    <div className="bg-white border border-slate-200/70 rounded-3xl shadow-lg shadow-slate-200/40 overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 md:p-5 border-b border-slate-100 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <label className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by player, event or jersey size…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-red-300 focus:ring-4 focus:ring-red-100 transition"
            />
          </label>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-400">
              {filtered.length} of {employees.length}
            </span>
            <div className="flex p-1 bg-slate-100 rounded-xl">
              {[["list", List], ["grid", LayoutGrid]].map(([v, Icon]) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  aria-label={`${v} view`}
                  className={`p-2 rounded-lg transition-colors ${view === v ? "bg-white text-red-600 shadow-sm" : "text-slate-400 hover:text-slate-700"}`}
                >
                  <Icon size={15} />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {teams.map(([t, n]) => (
            <button
              key={t}
              onClick={() => setTeam(t)}
              className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                team === t
                  ? "bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20"
                  : "bg-white text-slate-600 border-slate-200 hover:border-red-200 hover:text-red-600"
              }`}
            >
              {t}
              <span className={`text-[10px] px-1.5 rounded-full ${team === t ? "bg-white/20" : "bg-slate-100 text-slate-400"}`}>{n}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-5">
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">No employees match your search.</p>
        ) : view === "grid" ? (
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence>
              {shown.map((e, i) => (
                <motion.button
                  layout
                  key={e.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: (i % PAGE_SIZE) * 0.03 } }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  whileHover={{ y: -4 }}
                  onClick={() => onSelect(e)}
                  className="group relative text-left rounded-2xl border border-slate-200/80 bg-white hover:border-red-200 hover:shadow-xl hover:shadow-red-900/5 transition-all overflow-hidden"
                >
                  <div className={`h-16 bg-gradient-to-r ${colorFor(e.team)} opacity-90`} />
                  <div className="px-5 pb-5 -mt-8">
                    <Avatar emp={e} size="w-16 h-16" text="text-lg" />
                    <p className="mt-3 font-bold text-slate-900 group-hover:text-red-600 transition-colors truncate">{e.name}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5 truncate">
                      <Trophy size={12} className="flex-shrink-0" /> {e.event}
                    </p>
                    <div className="mt-4 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-slate-100 text-slate-600 truncate">
                        {e.joined ? new Date(e.joined).toLocaleDateString() : "Recently added"}
                      </span>
                      <div className="flex gap-1.5">
                        <span className="px-2 py-1 rounded-md bg-slate-900 text-white text-[10px] font-black">
                          {e.jerseySize}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/80 overflow-hidden">
            {shown.map((e) => (
              <button
                key={e.id}
                onClick={() => onSelect(e)}
                className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-red-50/40 transition-colors group"
              >
                <Avatar emp={e} size="w-11 h-11" text="text-sm" rounded="rounded-xl" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 group-hover:text-red-600 truncate">{e.name}</p>
                  <p className="text-xs text-slate-500 truncate">{e.event} · Jersey {e.jerseySize}</p>
                </div>
                <span className="hidden sm:inline text-xs text-slate-400">
                  {e.joined ? new Date(e.joined).toLocaleDateString() : "Recently added"}
                </span>
                <span className="hidden md:inline text-xs font-semibold text-slate-500 w-28 text-right">Jersey {e.jerseySize}</span>
                <ChevronRight size={16} className="text-slate-300 group-hover:text-red-500" />
              </button>
            ))}
          </div>
        )}

        {filtered.length > visible && (
          <div className="mt-5 flex justify-center">
            <button
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:border-red-300 hover:text-red-600 transition-colors"
            >
              Show more ({filtered.length - visible} left)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const EmployeeModal = ({ employee: e, onClose, onZoom }) => (
  <AnimatePresence>
    {e && (
      <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/50 backdrop-blur-md"
        />
        <motion.div
          initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          role="dialog" aria-modal="true"
          className="relative z-10 w-full max-w-md bg-white rounded-t-[2rem] sm:rounded-[2rem] overflow-hidden shadow-2xl"
        >
          <div className={`h-28 bg-gradient-to-r ${colorFor(e.team)} relative`}>
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white backdrop-blur transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div className="px-6 pb-7 -mt-12">
            <button onClick={() => e.image && onZoom(e.image)} className={e.image ? "cursor-zoom-in" : "cursor-default"}>
              <Avatar emp={e} size="w-24 h-24" text="text-2xl" rounded="rounded-3xl" />
            </button>
            <h3 className="mt-4 text-2xl font-extrabold text-slate-900 tracking-tight">{e.name}</h3>
            <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-1">
              <Trophy size={14} /> {e.event}
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3">
              <InfoPill icon={Shirt} label="Jersey size" value={e.jerseySize} />
              {e.joined && <InfoPill icon={Calendar} label="Registered" value={new Date(e.joined).toLocaleDateString()} />}
              {e.joined && <InfoPill icon={Clock} label="Added at" value={new Date(e.joined).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} />}
            </div>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

/* ================= PODIUM ================= */
const podiumStyles = [
  { ring: "from-amber-300 to-amber-500", height: "h-32", label: "1st", icon: Crown, text: "text-amber-600" },
  { ring: "from-slate-300 to-slate-400", height: "h-24", label: "2nd", icon: Medal, text: "text-slate-500" },
  { ring: "from-orange-300 to-amber-700", height: "h-20", label: "3rd", icon: Medal, text: "text-amber-700" },
];

const Podium = ({ teams }) => {
  // Display order: 2nd, 1st, 3rd
  const order = [1, 0, 2].filter((i) => teams[i]);
  return (
    <div className="grid grid-cols-3 gap-3 md:gap-5 items-end">
      {order.map((rank, pos) => {
        const t = teams[rank];
        const s = podiumStyles[rank];
        const Icon = s.icon;
        return (
          <motion.div
            key={t.teamName + rank}
            initial="hidden" animate="show" custom={pos} variants={fadeUp}
            className="flex flex-col items-center"
          >
            <div className={`p-[3px] rounded-2xl bg-gradient-to-br ${s.ring} shadow-lg mb-3`}>
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-[13px] bg-white flex items-center justify-center">
                <Icon size={22} className={s.text} />
              </div>
            </div>
            <p className="text-sm md:text-base font-bold text-slate-900 text-center line-clamp-1 px-1">{t.teamName}</p>
            <p className="text-[11px] font-semibold text-slate-400 mb-3">
              {t.won} wins · {getPoints(t)} pts
            </p>
            <div
              className={`w-full ${s.height} rounded-t-2xl bg-gradient-to-b ${
                rank === 0 ? "from-red-600 to-red-700" : "from-slate-800 to-slate-900"
              } flex items-start justify-center pt-3 shadow-xl`}
            >
              <span className="text-white/90 text-lg md:text-2xl font-black">{s.label}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

/* ================= STANDINGS TABLE ================= */
const rankBadge = (i) => {
  if (i === 0) return "bg-gradient-to-br from-amber-300 to-amber-500 text-white shadow-md shadow-amber-500/30";
  if (i === 1) return "bg-gradient-to-br from-slate-300 to-slate-400 text-white shadow-md shadow-slate-400/30";
  if (i === 2) return "bg-gradient-to-br from-orange-300 to-amber-700 text-white shadow-md shadow-amber-700/30";
  return "bg-slate-100 text-slate-500";
};

const StandingsTable = ({ teams }) => (
  <div className="bg-white border border-slate-200/70 rounded-3xl shadow-lg shadow-slate-200/40 overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[640px]">
        <thead>
          <tr className="bg-slate-50/80 border-b border-slate-200/70">
            <th className="py-4 pl-6 pr-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-16">#</th>
            <th className="py-4 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Squad</th>
            <th className="py-4 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">P</th>
            <th className="py-4 px-3 text-[10px] font-bold text-emerald-600 uppercase tracking-wider text-center">W</th>
            <th className="py-4 px-3 text-[10px] font-bold text-red-500 uppercase tracking-wider text-center">L</th>
            <th className="py-4 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-40">Win rate</th>
            <th className="py-4 pr-6 pl-3 text-[10px] font-bold text-slate-900 uppercase tracking-wider text-right">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {teams.map((team, idx) => {
            const rate = getWinRate(team);
            return (
              <motion.tr
                key={team.teamName + idx}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.04 }}
                className={`group transition-colors hover:bg-red-50/40 ${idx === 0 ? "bg-amber-50/30" : ""}`}
              >
                <td className="py-4 pl-6 pr-3">
                  <span className={`w-7 h-7 flex items-center justify-center text-xs font-bold rounded-lg ${rankBadge(idx)}`}>
                    {idx + 1}
                  </span>
                </td>
                <td className="py-4 px-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
                      {(team.teamName || "?").slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold text-slate-800 group-hover:text-red-600 transition-colors">
                      {team.teamName}
                    </span>
                  </div>
                </td>
                <td className="py-4 px-3 text-center text-sm font-medium text-slate-500">{team.played}</td>
                <td className="py-4 px-3 text-center text-sm font-bold text-emerald-600">{team.won}</td>
                <td className="py-4 px-3 text-center text-sm font-medium text-red-400">{team.lost}</td>
                <td className="py-4 px-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${rate}%` }} transition={{ duration: 0.8, delay: idx * 0.05 }}
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                      />
                    </div>
                    <span className="text-[11px] font-bold text-slate-500 w-9 text-right">{rate}%</span>
                  </div>
                </td>
                <td className="py-4 pr-6 pl-3 text-right">
                  <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-bold">
                    {getPoints(team)}
                  </span>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

/* ================= MEDIA HUB ================= */
const MediaHub = ({ galleries, onZoom }) => {
  const [active, setActive] = useState(galleries[0].id);
  const current = galleries.find((g) => g.id === active) || galleries[0];

  return (
    <div className="bg-white border border-slate-200/70 rounded-3xl shadow-lg shadow-slate-200/40 overflow-hidden">
      <div className="flex gap-1 p-2 m-4 mb-0 bg-slate-100 rounded-2xl overflow-x-auto">
        {galleries.map((g) => (
          <button
            key={g.id}
            onClick={() => setActive(g.id)}
            className={`relative flex-1 min-w-fit whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              active === g.id ? "text-white" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {active === g.id && (
              <motion.span
                layoutId="media-tab"
                className="absolute inset-0 bg-red-600 rounded-xl shadow-md shadow-red-600/30"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <span className="relative flex items-center justify-center gap-2">
              {g.short}
              <span className={`text-[10px] px-1.5 rounded-md ${active === g.id ? "bg-white/20" : "bg-white text-slate-400"}`}>
                {g.images.length}
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="p-4 md:p-6">
        <MediaCarousel key={current.id} gallery={current} onZoom={onZoom} />
      </div>
    </div>
  );
};

const MediaCarousel = ({ gallery, onZoom }) => {
  const { images, interval, label } = gallery;
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false);
  const count = images.length;

  useEffect(() => {
    if (count < 2 || paused) return;
    const id = setInterval(() => {
      setDirection(1);
      setIndex((i) => (i + 1) % count);
    }, interval);
    return () => clearInterval(id);
  }, [count, paused, interval]);

  const go = (d) => {
    setDirection(d);
    setIndex((i) => (i + d + count) % count);
  };

  if (count === 0) {
    return <EmptyState icon={Images} title="No images yet" text="Photos added for this section will appear here." />;
  }

  const src = images[index] || fallbackImage;

  return (
    <div className="space-y-4">
      <div
        className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden bg-slate-900 group"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.img
            key={index}
            src={src}
            alt={`${label} ${index + 1}`}
            custom={direction}
            initial={{ opacity: 0, x: direction * 60, scale: 1.04 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: direction * -60 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            onClick={() => onZoom(src)}
            className="absolute inset-0 w-full h-full object-cover cursor-zoom-in"
          />
        </AnimatePresence>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/10 to-transparent" />

        {/* top controls */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <span className="px-2.5 py-1 rounded-lg bg-slate-950/50 backdrop-blur text-white text-[11px] font-semibold">
            {index + 1} / {count}
          </span>
          <div className="flex gap-2">
            {count > 1 && (
              <button
                onClick={() => setPaused((p) => !p)}
                aria-label={paused ? "Play slideshow" : "Pause slideshow"}
                className="p-2 rounded-lg bg-slate-950/50 backdrop-blur text-white hover:bg-red-600 transition-colors"
              >
                {paused ? <Play size={14} /> : <Pause size={14} />}
              </button>
            )}
            <button
              onClick={() => onZoom(src)}
              aria-label="View full size"
              className="p-2 rounded-lg bg-slate-950/50 backdrop-blur text-white hover:bg-red-600 transition-colors"
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </div>

        {/* arrows */}
        {count > 1 && (
          <>
            <button
              onClick={() => go(-1)}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/90 text-slate-800 shadow-lg opacity-0 group-hover:opacity-100 hover:bg-red-600 hover:text-white transition-all"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => go(1)}
              aria-label="Next image"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/90 text-slate-800 shadow-lg opacity-0 group-hover:opacity-100 hover:bg-red-600 hover:text-white transition-all"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}

        {/* caption + progress */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-5">
          <p className="text-[10px] font-bold tracking-[0.2em] text-red-400 uppercase">
            Slideshow · {interval / 1000}s
          </p>
          <h4 className="text-lg font-bold text-white mt-0.5">{label}</h4>
          {count > 1 && (
            <div className="flex gap-1.5 mt-3">
              {images.map((_, i) => (
                <div key={i} className="h-1 flex-1 rounded-full bg-white/25 overflow-hidden">
                  {i === index && (
                    <motion.div
                      key={`${index}-${paused}`}
                      initial={{ width: paused ? "100%" : "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: paused ? 0 : interval / 1000, ease: "linear" }}
                      className="h-full bg-white"
                    />
                  )}
                  {i < index && <div className="h-full w-full bg-white/70" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* thumbnails */}
      {count > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => { setDirection(i > index ? 1 : -1); setIndex(i); }}
              aria-label={`Show image ${i + 1}`}
              className={`relative flex-shrink-0 w-24 h-16 rounded-xl overflow-hidden transition-all ${
                i === index ? "ring-2 ring-red-600 ring-offset-2" : "opacity-60 hover:opacity-100"
              }`}
            >
              <img src={img || fallbackImage} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientSportsPlan;
