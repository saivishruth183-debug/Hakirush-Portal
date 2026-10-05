import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../../context/authContext";
import { motion as Motion, AnimatePresence } from "framer-motion";
import { apiErrorMessage, apiErrorStatus } from "../../utils/apiError";
import {
  X,
  MapPin,
  Calendar,
  ChevronRight,
  Zap,
  ShieldCheck,
  Activity,
  Bell,
  ImageOff,
  Trophy,
  RefreshCw
} from "lucide-react";

const BACKEND = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/+$/, "");

// Gallery URLs may be absolute (ImageKit) or backend-relative.
const resolveImageUrl = (url) => {
  if (!url || typeof url !== "string") return null;
  if (/^https?:\/\//i.test(url)) return url;
  return `${BACKEND}/${url.replace(/^\/+/, "")}`;
};

/* ================= THEME UTILS ================= */
const getStatusBadgeClass = (status) => {
  switch ((status || "").toLowerCase()) {
    case "upcoming": return "text-amber-700 border-amber-200/70 bg-amber-50/60";
    case "ongoing": return "text-emerald-700 border-emerald-200/70 bg-emerald-50/60";
    case "completed": return "text-slate-500 border-slate-200 bg-slate-50";
    default: return "text-red-700 border-red-200/70 bg-red-50/60";
  }
};

const ClientSportsPlan = () => {
  const { user } = useAuth();
  const [client, setClient] = useState(null);
  const [clientError, setClientError] = useState("");
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState([]);
  const [activeAnnouncement, setActiveAnnouncement] = useState(null);

  // Performance standings (admin-entered; empty until published)
  const [standings, setStandings] = useState([]);
  const [standingsUpdatedAt, setStandingsUpdatedAt] = useState(null);
  const [standingsError, setStandingsError] = useState("");

  // Employee roster entered by this client in Relationship.
  const [roster, setRoster] = useState([]);
  const [rosterError, setRosterError] = useState("");

  // Client gallery (admin-uploaded; empty until published)
  const [clientImages, setClientImages] = useState([]);
  const [galleryError, setGalleryError] = useState("");
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  // Top-Level Lifted States for Zoom Modals
  const [zoomImage, setZoomImage] = useState(null);

  const userId = user?._id;

  // Own data only: /client/me, /client/me/roster, /client/me/performance, /client/me/gallery.
  // (The full client list is admin-only and is never downloaded here.)
  const fetchData = useCallback(async () => {
    if (!userId) return;
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };
      const [clientRes, annRes, perfRes, galleryRes, rosterRes] = await Promise.allSettled([
        axios.get(`${BACKEND}/api/client/me`, { headers }),
        axios.get(`${BACKEND}/api/announcements/public`, { headers }),
        axios.get(`${BACKEND}/api/client/me/performance`, { headers }),
        axios.get(`${BACKEND}/api/client/me/gallery`, { headers }),
        axios.get(`${BACKEND}/api/client/me/roster`, { headers })
      ]);

      if (clientRes.status === "fulfilled") {
        setClient(clientRes.value.data?.client || null);
        setClientError("");
      } else {
        setClient(null);
        // 404 = no client record linked yet ("Access Pending"); anything else is an error
        setClientError(
          apiErrorStatus(clientRes.reason) === 404
            ? ""
            : apiErrorMessage(clientRes.reason, "Couldn't load your account.")
        );
      }

      setAnnouncements(
        annRes.status === "fulfilled" && Array.isArray(annRes.value.data?.announcements)
          ? annRes.value.data.announcements
          : []
      );

      if (perfRes.status === "fulfilled") {
        const rows = perfRes.value.data?.standings;
        setStandings(Array.isArray(rows) ? rows : []);
        setStandingsUpdatedAt(perfRes.value.data?.updatedAt || null);
        setStandingsError("");
      } else {
        setStandings([]);
        setStandingsError(apiErrorMessage(perfRes.reason, "Couldn't load standings."));
      }

      if (galleryRes.status === "fulfilled") {
        const imgs = galleryRes.value.data?.images;
        setClientImages(Array.isArray(imgs) ? imgs.filter((img) => resolveImageUrl(img?.url)) : []);
        setGalleryError("");
      } else {
        setClientImages([]);
        setGalleryError(apiErrorMessage(galleryRes.reason, "Couldn't load the gallery."));
      }

      if (rosterRes.status === "fulfilled") {
        const entries = rosterRes.value.data?.entries;
        setRoster(Array.isArray(entries) ? entries : []);
        setRosterError("");
      } else {
        setRoster([]);
        setRosterError(apiErrorMessage(rosterRes.reason, "Couldn't load employee details."));
      }
      setGalleryIndex(0);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const retry = () => {
    setLoading(true);
    fetchData();
  };

  // Gallery auto-advance (must be before any return)
  useEffect(() => {
    let interval;
    if (isGalleryOpen && clientImages.length > 1) {
      interval = setInterval(() => {
        setGalleryIndex((prev) => (prev + 1) % clientImages.length);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isGalleryOpen, clientImages.length]);

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50/50">
      <div className="relative flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-slate-100 border-t-red-600 rounded-full animate-spin" />
        <div className="absolute w-10 h-10 border-4 border-transparent border-b-red-400 rounded-full animate-spin reverse-spin opacity-40" />
      </div>
      <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.3em] text-slate-500">Loading Environment...</p>
    </div>
  );

  if (!client && clientError) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50/30 p-6">
      <div className="text-center p-12 bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 max-w-sm w-full">
        <h2 className="text-slate-900 font-bold text-lg tracking-tight">Something went wrong</h2>
        <p className="text-slate-500 text-sm mt-2">{clientError}</p>
        <button
          onClick={retry}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-red-600"
        >
          <RefreshCw size={13} /> Retry
        </button>
      </div>
    </div>
  );

  if (!client) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50/30 p-6">
      <div className="text-center p-12 bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 max-w-sm w-full">
        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-slate-100">
          <ShieldCheck size={28} className="text-slate-400" />
        </div>
        <h2 className="text-slate-900 font-bold text-xl tracking-tight">Access Pending</h2>
        <p className="text-slate-400 text-xs mt-2 uppercase tracking-wider font-semibold">Awaiting Dossier Assignment</p>
      </div>
    </div>
  );

  const plan = client.planType || "—";
  const currentImage = clientImages[galleryIndex] || null;

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 via-red-50/30 to-slate-50 text-slate-900 font-sans overflow-hidden selection:bg-red-200/60 relative">
      <div className="flex flex-col lg:flex-row h-full">
        
        {/* MAIN: OPERATIONS (Left Side) */}
        <main className="flex-1 overflow-y-auto bg-white/70 backdrop-blur-3xl relative border-r border-slate-200/60 shadow-[8px_0_32px_rgba(0,0,0,0.01)]">
          
          {/* HEADER HUD */}
          <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_2px_20px_rgba(0,0,0,0.01)]">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Organization</p>
                <p className="text-lg font-extrabold text-slate-900 tracking-tight">{client?.userId?.name}</p>
              </div>
              <div className="h-8 w-px bg-slate-200 hidden sm:block self-end mb-0.5" />
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Tier Level</p>
                <p className="text-lg font-extrabold text-red-600 tracking-tight">{plan}</p>
              </div>
            </div>
          </div>

          {/* MAIN SPACE WITH THE LEADERBOARD & IMAGES */}
          <div className="p-6 md:p-10 lg:p-12 max-w-5xl mx-auto space-y-12">
            <PerformanceLeaderboard
              teams={standings}
              updatedAt={standingsUpdatedAt}
              error={standingsError}
              onRetry={retry}
            />
            <EmployeeRoster entries={roster} error={rosterError} onRetry={retry} />
            {/* CLIENT-SPECIFIC IMAGE GALLERY SECTION */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden hover:border-slate-300 transition-all mb-8">
              <button
                onClick={() => setIsGalleryOpen(!isGalleryOpen)}
                className="w-full flex items-center justify-between p-6 text-left focus:outline-none group bg-white hover:bg-slate-50/40 transition-colors"
              >
                <div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-red-600 transition-colors">
                    {client?.userId?.name} Gallery
                  </h3>
                  <p className="text-slate-400 text-[11px] font-medium mt-0.5">
                    {isGalleryOpen ? "Click to hide gallery" : "Click to expand client media gallery"}
                  </p>
                </div>
                <Motion.div
                  animate={{ rotate: isGalleryOpen ? 90 : 0 }}
                  transition={{ type: "spring", stiffness: 250, damping: 20 }}
                  className="p-2 bg-slate-50 border border-slate-200/60 rounded-xl group-hover:bg-red-50 group-hover:border-red-100 transition-colors"
                >
                  <ChevronRight size={16} className="text-slate-400 group-hover:text-red-600 transition-colors" />
                </Motion.div>
              </button>
              <AnimatePresence initial={false}>
                {isGalleryOpen && (
                  <Motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                  >
                    <div className="px-6 pb-6 border-t border-slate-100 pt-5 flex justify-center bg-slate-50/20">
                      {galleryError ? (
                        <div className="w-full max-w-lg h-40 flex flex-col items-center justify-center gap-2 text-slate-500 bg-slate-50 rounded-xl border border-slate-200/60 text-sm">
                          {galleryError}
                          <button onClick={retry} className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-red-600">
                            <RefreshCw size={12} /> Retry
                          </button>
                        </div>
                      ) : currentImage ? (
                        <div
                          onClick={() => setZoomImage(resolveImageUrl(currentImage.url))}
                          className="relative w-full max-w-lg h-72 rounded-xl overflow-hidden shadow-sm border border-slate-200/60 cursor-pointer group/clientGallery"
                        >
                          <AnimatePresence mode="wait">
                            <Motion.img
                              key={currentImage._id || galleryIndex}
                              src={resolveImageUrl(currentImage.url)}
                              alt={currentImage.caption || `Gallery image ${galleryIndex + 1}`}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.3 }}
                              className="w-full h-full object-cover"
                            />
                          </AnimatePresence>
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent flex flex-col justify-end p-5">
                            <span className="text-[9px] font-bold tracking-wider text-red-400 uppercase mb-0.5">
                              {clientImages.length > 1 ? `Image ${galleryIndex + 1} of ${clientImages.length} · auto-advances` : "Gallery"}
                            </span>
                            <h4 className="text-sm font-bold text-white">{currentImage.caption || `Gallery image #${galleryIndex + 1}`}</h4>
                            <p className="text-[11px] text-slate-300 font-medium mt-1 opacity-0 group-hover/clientGallery:opacity-100 transition-opacity duration-300">
                              Click image to view full size
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full max-w-lg h-40 flex flex-col items-center justify-center gap-2 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          <ImageOff size={22} />
                          <span className="text-sm font-medium">No gallery images yet</span>
                        </div>
                      )}
                    </div>
                  </Motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </main>

        {/* SIDEBAR: INTEL FEED (Right Side) */}
        <aside className="w-full lg:w-[340px] bg-slate-50/60 backdrop-blur-3xl flex flex-col z-20 border-t lg:border-t-0 lg:border-l border-slate-200/60 h-[400px] lg:h-full">
          <div className="p-5 border-b border-slate-200/60 bg-white/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-red-50 rounded-lg border border-red-100">
                <Bell size={15} className="text-red-600" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800">Updates Feed</span>
            </div>
            {announcements.length > 0 && (
              <span className="bg-red-50 text-red-600 border border-red-100 text-[10px] px-2 py-0.5 rounded-full font-bold">
                {announcements.length}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {announcements.map((a) => (
              <Motion.button
                whileHover={{ y: -2, scale: 1.01 }} 
                whileTap={{ scale: 0.99 }}
                key={a._id}
                onClick={() => setActiveAnnouncement(a)}
                className="w-full text-left p-4.5 rounded-2xl bg-white border border-slate-200/60 hover:border-red-200 shadow-sm hover:shadow-md hover:shadow-red-950/5 transition-all group relative overflow-hidden"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-red-500 transition-colors" />
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{a.date}</span>
                  <Zap size={13} className="text-slate-300 group-hover:text-red-500 transition-colors" />
                </div>
                <p className="text-sm font-bold text-slate-800 group-hover:text-red-600 transition-colors line-clamp-2 pr-2">
                  {a.title}
                </p>
              </Motion.button>
            ))}
          </div>
        </aside>
      </div>

      {/* ANNOUNCEMENT MODAL */}
      <AnimatePresence>
        {activeAnnouncement && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
            <Motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setActiveAnnouncement(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <Motion.div 
              initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
              className="relative bg-white w-full max-w-2xl rounded-[2rem] overflow-hidden shadow-[0_30px_70px_rgba(0,0,0,0.15)] border border-slate-100 z-10 flex flex-col max-h-[90vh]"
            >
              <div className="relative h-56 md:h-64 bg-slate-100 flex-shrink-0">
                {activeAnnouncement.image ? (
                  <img src={activeAnnouncement.image} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-red-50 to-slate-100 flex items-center justify-center">
                    <Activity size={40} className="text-red-200" />
                  </div>
                )}
                <button 
                  onClick={() => setActiveAnnouncement(null)} 
                  className="absolute top-5 right-5 p-2.5 bg-white/90 backdrop-blur border border-slate-200/80 hover:bg-red-600 hover:text-white rounded-xl transition-all shadow-md group"
                >
                  <X size={16} className="text-slate-600 group-hover:text-white transition-colors" />
                </button>
                <div className="absolute bottom-0 left-0 p-6 md:p-8 w-full bg-gradient-to-t from-white via-white/80 to-transparent">
                  <span className={`inline-block px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getStatusBadgeClass(activeAnnouncement.status)} mb-3`}>
                    {activeAnnouncement.status}
                  </span>
                  <h3 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">{activeAnnouncement.title}</h3>
                </div>
              </div>
              
              <div className="p-6 md:p-8 overflow-y-auto space-y-6">
                <div className="flex flex-wrap gap-6 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-5">
                  <span className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/40"><Calendar size={13} className="text-red-500"/> {activeAnnouncement.date}</span>
                  <span className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/40"><MapPin size={13} className="text-red-500"/> {activeAnnouncement.venue}</span>
                </div>
                <p className="text-slate-600 leading-relaxed font-medium text-base bg-slate-50 border border-slate-100 p-5 rounded-2xl shadow-inner">
                  "{activeAnnouncement.description}"
                </p>
              </div>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LIFTED GLOBAL FULL-SCREEN IMAGE MODAL */}
      <AnimatePresence>
        {zoomImage && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <Motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setZoomImage(null)}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl"
            />
            <Motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative max-w-5xl w-full max-h-[85vh] flex items-center justify-center rounded-2xl overflow-hidden z-10"
            >
              <img src={zoomImage} className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl" alt="Enlarged view" />
              <button 
                onClick={() => setZoomImage(null)} 
                className="absolute top-4 right-4 p-2.5 bg-slate-900/80 hover:bg-red-600 text-white rounded-xl transition-all border border-slate-700 shadow-xl"
              >
                <X size={18}/>
              </button>
            </Motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const EmployeeRoster = ({ entries = [], error, onRetry }) => (
  <section className="space-y-6">
    <div className="border-l-4 border-red-600 pl-5">
      <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 leading-tight">
        Employee <span className="text-red-600">Details</span>
      </h2>
      <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
        Personnel entered in Relationship
      </p>
    </div>

    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
      {error ? (
        <div className="py-12 flex flex-col items-center gap-2 text-slate-500 text-sm">
          {error}
          <button onClick={onRetry} className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-red-600">
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      ) : entries.length === 0 ? (
        <div className="py-12 flex flex-col items-center gap-2 text-slate-400">
          <ShieldCheck size={24} />
          <span className="text-sm font-medium">No employee details added yet</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/70">
                <th className="py-4 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Employee Name</th>
                <th className="py-4 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Jersey Size</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((entry, index) => (
                <tr key={entry._id || index} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-6 text-sm font-semibold text-slate-800">{entry.name}</td>
                  <td className="py-4 px-6 text-center text-sm font-medium text-slate-500">{entry.jerseySize || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </section>
);

/* ================= LEADERBOARD TABLE COMPONENT =================
   Standings come from GET /api/client/me/performance (entered by an admin).
   No placeholder/fallback data is shown as if it were real. */
const PerformanceLeaderboard = ({ teams = [], updatedAt, error, onRetry }) => {
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const sortedTeams = [...teams].sort(
    (a, b) => num(b.points) - num(a.points) || num(b.won) - num(a.won)
  );

  const getRankStyle = (index) => {
    switch (index) {
      case 0: return "bg-amber-500/10 text-amber-700 border border-amber-500/20 shadow-sm";
      case 1: return "bg-slate-400/10 text-slate-600 border border-slate-400/20 shadow-sm";
      case 2: return "bg-amber-700/10 text-amber-800 border border-amber-700/20 shadow-sm";
      default: return "bg-slate-50 text-slate-500 border border-slate-200/60";
    }
  };

  const updatedLabel = (() => {
    if (!updatedAt) return null;
    const d = new Date(updatedAt);
    return isNaN(d.getTime()) ? null : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  })();

  return (
    <div className="space-y-6">
      <div className="border-l-4 border-red-600 pl-5">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 leading-tight">
          Company <span className="text-red-600">Performance</span>
        </h2>
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">
          Standings{updatedLabel ? ` · Updated ${updatedLabel}` : ""}
        </p>
      </div>

      {/* TABLE BOX */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        {error ? (
          <div className="py-12 flex flex-col items-center gap-2 text-slate-500 text-sm">
            {error}
            <button onClick={onRetry} className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-red-600">
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        ) : sortedTeams.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-2 text-slate-400">
            <Trophy size={24} />
            <span className="text-sm font-medium">No standings published yet</span>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/70 backdrop-blur-sm">
                <th className="py-4 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-20">Rank</th>
                <th className="py-4 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Squad / Division</th>
                <th className="py-4 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center w-24">Played</th>
                <th className="py-4 px-4 text-[10px] font-bold text-emerald-600 uppercase tracking-wider text-center w-24 bg-emerald-50/40 border-x border-slate-200/40">Won</th>
                <th className="py-4 px-4 text-[10px] font-bold text-red-500 uppercase tracking-wider text-center w-24">Lost</th>
                <th className="py-4 px-6 text-[10px] font-bold text-slate-900 uppercase tracking-wider text-right w-32">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedTeams.map((team, idx) => (
                <tr key={team._id || idx} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="py-4 px-6">
                    <span className={`w-6 h-6 flex items-center justify-center text-xs font-bold rounded-md ${getRankStyle(idx)}`}>
                      {idx + 1}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-sm font-semibold text-slate-800 group-hover:text-red-600 transition-colors">
                      {team.teamName}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center text-sm font-medium text-slate-500">{num(team.played)}</td>
                  <td className="py-4 px-4 text-center text-sm font-bold text-emerald-600 bg-emerald-50/10 border-x border-slate-100/60">{num(team.won)}</td>
                  <td className="py-4 px-4 text-center text-sm font-medium text-slate-400">{num(team.lost)}</td>
                  <td className="py-4 px-6 text-right text-sm font-bold text-slate-900 tracking-tight">{num(team.points)} PTS</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  );
};

export default ClientSportsPlan;
