import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu, LogOut, X, Mail, Copy, Check, ChevronDown,
  Sun, Moon, Sunrise, Sunset, Calendar, BadgeCheck, IdCard, ChevronRight, Clock,
} from "lucide-react";
import { useAuth } from "../../context/authContext";
import { useSidebar } from "../../context/sidebarContext";

/* ================= HELPERS ================= */
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 5) return { text: "Working late", Icon: Moon, tint: "text-indigo-400" };
  if (h < 12) return { text: "Good morning", Icon: Sunrise, tint: "text-amber-500" };
  if (h < 17) return { text: "Good afternoon", Icon: Sun, tint: "text-amber-500" };
  if (h < 21) return { text: "Good evening", Icon: Sunset, tint: "text-orange-500" };
  return { text: "Working late", Icon: Moon, tint: "text-indigo-400" };
};

const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  if (imagePath.startsWith("http")) return imagePath;
  const baseUrl = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "");
  return imagePath.startsWith("/") ? `${baseUrl}${imagePath}` : `${baseUrl}/${imagePath}`;
};

// "/admin-dashboard/attendance-requests" -> ["Admin Dashboard", "Attendance Requests"]
const prettify = (seg) =>
  decodeURIComponent(seg).replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const isIdLike = (seg) => /^[0-9a-f]{24}$/i.test(seg) || /^\d+$/.test(seg);

const panelMotion = {
  initial: { opacity: 0, y: -10, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -10, scale: 0.97 },
  transition: { type: "spring", stiffness: 380, damping: 30 },
};

/* ================= NAVBAR ================= */
const Navbar = () => {
  const { user, logout } = useAuth();
  const { setOpen } = useSidebar();
  const location = useLocation();

  const [scrolled, setScrolled] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [copied, setCopied] = useState(null); // "id" | "email" | null
  const [imgError, setImgError] = useState(false);
  const [now, setNow] = useState(new Date());
  const panelRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // tick every second so the clock's colon can blink and minutes stay exact
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // reset broken-image state if the user's photo changes
  const userImg = user?.profileImage || user?.clientImage || user?.image || user?.avatar;
  useEffect(() => setImgError(false), [userImg]);

  // close the account panel on route change
  useEffect(() => setPanelOpen(false), [location.pathname]);

  useEffect(() => {
    if (!panelOpen) return;
    const onClick = (e) => {
      if (panelRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
      setPanelOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setPanelOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [panelOpen]);

  const copy = (value, key) => {
    if (!value) return;
    navigator.clipboard?.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1600);
  };

  const showImg = userImg && !imgError;
  const initials =
    (user?.name || "?").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
  const firstName = (user?.name || "").split(" ")[0] || "there";
  const role = user?.role || "member";
  const empId = user?.employeeId;
  const isAdmin = role === "admin";
  const isClient = role === "client";
  const clientCode = user?.clientCode;
  const { text: greeting, Icon: GreetIcon, tint } = getGreeting();

  const crumbs = location.pathname.split("/").filter((s) => s && !isIdLike(s)).map(prettify);
  const pageTitle = crumbs[crumbs.length - 1] || "Dashboard";
  const parentCrumb = crumbs.length > 1 ? crumbs[crumbs.length - 2] : "Home";

  const hh = String(now.getHours() % 12 || 12).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ampm = now.getHours() < 12 ? "AM" : "PM";

  // plain function (not a component) so the <img> isn't remounted on every render
  const avatar = (size = "h-10 w-10", text = "text-sm") =>
    showImg ? (
      <img src={getImageUrl(userImg)} alt="" onError={() => setImgError(true)} className={`${size} rounded-full object-cover`} />
    ) : (
      <div className={`${size} ${text} flex items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-rose-600 font-bold text-white`}>
        {initials}
      </div>
    );

  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={`sticky top-0 z-50 font-sans transition-[background-color,box-shadow] duration-300 ${
        scrolled
          ? "bg-white/85 shadow-[0_10px_30px_-14px_rgba(127,29,29,0.22)] backdrop-blur-xl"
          : "bg-white/55 backdrop-blur-md"
      }`}
    >
      {/* brand strip on top + soft line underneath */}
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-red-600 via-rose-500 to-orange-400" />
      <div
        className={`absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-red-300 to-transparent transition-opacity duration-300 ${
          scrolled ? "opacity-100" : "opacity-40"
        }`}
      />

      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:h-[74px] sm:px-8">
        {/* ============ LEFT ============ */}
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-gray-600 shadow-sm ring-1 ring-red-100 transition hover:text-red-600 hover:ring-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 md:hidden"
          >
            <Menu size={19} />
          </button>

          <div className="min-w-0">
            {/* breadcrumb */}
            <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[11px] font-medium text-gray-400">
              <span className="hidden truncate sm:inline">{parentCrumb}</span>
              <ChevronRight size={12} className="hidden shrink-0 sm:inline" />
              <span className="truncate rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-600">{pageTitle}</span>
            </nav>

            {/* greeting — re-animates when you move between pages */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.h1
                key={location.pathname}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="mt-1 flex items-center gap-2 truncate text-base font-extrabold tracking-tight text-gray-900 sm:text-[19px]"
              >
                <span className="hidden truncate sm:inline">
                  {greeting},{" "}
                  <span className="bg-gradient-to-r from-red-600 to-rose-500 bg-clip-text text-transparent">{firstName}</span>
                </span>
                <span className="truncate sm:hidden">{pageTitle}</span>
                <motion.span
                  className="hidden shrink-0 sm:inline-flex"
                  initial={{ rotate: -20, scale: 0.6, opacity: 0 }}
                  animate={{ rotate: 0, scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.15 }}
                >
                  <GreetIcon size={18} className={tint} />
                </motion.span>
              </motion.h1>
            </AnimatePresence>
          </div>
        </div>

        {/* ============ RIGHT ============ */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {/* date + live clock */}
          <div className="hidden items-center overflow-hidden rounded-2xl bg-white/90 text-xs shadow-sm ring-1 ring-red-100 lg:flex">
            <div className="flex items-center gap-2 px-3.5 py-2">
              <Calendar size={14} className="text-red-500" />
              <span className="font-semibold text-gray-700">
                {now.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" })}
              </span>
            </div>
            <div className="flex items-center gap-1.5 border-l border-red-100 bg-red-50/60 px-3.5 py-2">
              <Clock size={13} className="text-red-500" />
              <span className="font-bold tabular-nums text-gray-900">
                {hh}
                <span className={`transition-opacity ${now.getSeconds() % 2 ? "opacity-30" : "opacity-100"}`}>:</span>
                {mm}
              </span>
              <span className="text-[10px] font-semibold text-gray-400">{ampm}</span>
            </div>
          </div>

          {/* account trigger */}
          <motion.button
            ref={triggerRef}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setPanelOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={panelOpen}
            aria-label="Open account menu"
            className={`group flex items-center gap-3 rounded-full p-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 sm:rounded-2xl sm:py-1.5 sm:pl-1.5 sm:pr-3 ${
              panelOpen
                ? "bg-white shadow-md ring-1 ring-red-200"
                : "bg-white/70 shadow-sm ring-1 ring-red-100 hover:bg-white hover:shadow-md hover:ring-red-200"
            }`}
          >
            <span className="relative">
              <span
                className={`block rounded-full p-[2px] transition ${
                  panelOpen
                    ? "bg-gradient-to-br from-red-500 to-rose-600"
                    : "bg-gradient-to-br from-red-200 to-rose-200 group-hover:from-red-400 group-hover:to-rose-500"
                }`}
              >
                <span className="block rounded-full bg-white p-[2px]">{avatar("h-9 w-9")}</span>
              </span>
              <span className="absolute bottom-0.5 right-0.5 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
              </span>
            </span>

            <span className="hidden min-w-0 text-left leading-tight sm:block">
              <span className="block max-w-[150px] truncate text-sm font-bold text-gray-900">{user?.name}</span>
              <span className="mt-1 flex items-center gap-1.5">
                <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-600">
                  {role}
                </span>
                {isAdmin ? (
                  <span className="max-w-[150px] truncate text-[10px] text-gray-400">{user?.email}</span>
                ) : isClient ? (
                  <span className="max-w-[150px] truncate font-mono text-[10px] text-gray-400">{clientCode || "Client ID pending"}</span>
                ) : empId ? (
                  <span className="font-mono text-[10px] text-gray-400">{empId}</span>
                ) : null}
              </span>
            </span>

            <ChevronDown
              size={15}
              className={`hidden text-gray-400 transition-transform duration-200 sm:block ${panelOpen ? "rotate-180 text-red-500" : ""}`}
            />
          </motion.button>
        </div>
      </div>

      {/* ============ ACCOUNT PANEL ============ */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            ref={panelRef}
            role="menu"
            {...panelMotion}
            style={{ transformOrigin: "top right" }}
            className="absolute right-3 top-full z-[100] mt-2 w-[calc(100vw-1.5rem)] max-w-[350px] overflow-hidden rounded-3xl bg-white shadow-[0_30px_70px_-20px_rgba(127,29,29,0.38)] ring-1 ring-red-100 sm:right-8"
          >
            {/* header */}
            <div className="relative overflow-hidden bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 px-6 py-6 text-white">
              <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/15 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-12 left-6 h-28 w-28 rounded-full bg-orange-300/25 blur-2xl" />

              <button
                onClick={() => setPanelOpen(false)}
                aria-label="Close account menu"
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:rotate-90 hover:bg-white/25"
              >
                <X size={15} />
              </button>

              <p className="relative mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">Signed in as</p>
              <div className="relative flex items-center gap-4">
                <motion.span
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.05 }}
                  className="rounded-full bg-white/30 p-[3px]"
                >
                  {avatar("h-16 w-16", "text-xl")}
                </motion.span>
                <div className="min-w-0">
                  <p className="truncate text-lg font-extrabold leading-tight">{user?.name}</p>
                  <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur">
                    <BadgeCheck size={12} /> {role}
                  </span>
                </div>
              </div>
            </div>

            {/* details */}
            <motion.div
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } } }}
              className="space-y-1 p-3"
            >
              {isAdmin ? (
                <InfoRow
                  icon={Mail}
                  label="Admin email"
                  value={user?.email || "Not provided"}
                  onCopy={user?.email ? () => copy(user.email, "email") : null}
                  copied={copied === "email"}
                />
              ) : isClient ? (
                <InfoRow
                  icon={IdCard}
                  label="Client ID"
                  value={clientCode || "Not assigned"}
                  mono
                  onCopy={clientCode ? () => copy(clientCode, "id") : null}
                  copied={copied === "id"}
                />
              ) : (
                <>
                  <InfoRow
                    icon={Mail}
                    label="Official email"
                    value={user?.email || "Not provided"}
                    onCopy={user?.email ? () => copy(user.email, "email") : null}
                    copied={copied === "email"}
                  />
                  <InfoRow
                    icon={IdCard}
                    label="Employee ID"
                    value={empId || "Not assigned"}
                    mono
                    onCopy={empId ? () => copy(empId, "id") : null}
                    copied={copied === "id"}
                  />
                </>
              )}
            </motion.div>

            {/* logout */}
            <div className="border-t border-red-50 p-3">
              <button
                onClick={logout}
                className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 py-3.5 text-sm font-bold text-white transition hover:bg-gradient-to-r hover:from-red-600 hover:to-rose-600 hover:shadow-lg hover:shadow-red-600/30 active:scale-[0.99]"
              >
                <LogOut size={16} className="transition-transform group-hover:-translate-x-0.5" />
                Log out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
};

/* ================= PIECES ================= */
const InfoRow = ({ icon: Icon, label, value, mono, onCopy, copied }) => (
  <motion.div
    variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } }}
    className="group flex items-center gap-3 rounded-2xl p-3 transition hover:bg-red-50/60"
  >
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 transition group-hover:bg-white group-hover:shadow-sm">
      <Icon size={17} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[11px] font-medium text-gray-400">{label}</p>
      <p className={`truncate text-sm font-semibold text-gray-900 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
    {onCopy && (
      <button
        onClick={onCopy}
        aria-label={`Copy ${label}`}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition ${
          copied
            ? "bg-emerald-50 text-emerald-600"
            : "text-gray-400 hover:bg-white hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
        }`}
      >
        {copied ? <Check size={15} /> : <Copy size={14} />}
      </button>
    )}
  </motion.div>
);

export default Navbar;
