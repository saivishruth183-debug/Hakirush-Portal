import React, { useEffect, useState } from "react";
import Logo from "/favicon.png";
import { NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  CalendarCheck,
  Settings,
  X,
  FileText,
  UserCircle,
  Receipt,
  Clock,
  Users,
} from "lucide-react";
import { useAuth } from "../../context/authContext";
import { useSidebar } from "../../context/sidebarContext";

/* ---------- helpers (UI only) ---------- */
const AVATAR_BG = ["from-red-500 to-rose-400", "from-violet-500 to-fuchsia-400", "from-sky-500 to-cyan-400", "from-amber-500 to-orange-400", "from-emerald-500 to-teal-400"];
const colorFor = (s = "") => AVATAR_BG[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_BG.length];
const initials = (name = "") => String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
const imageUrl = (p) => {
  if (!p) return null;
  if (/^(https?:|data:|blob:)/.test(p)) return p;
  return `${import.meta.env.VITE_BACKEND_URL}/${String(p).replace(/^\/+/, "")}`;
};

/* label that hides when the desktop rail is collapsed and slides in on hover */
const railText =
  "whitespace-nowrap transition-all duration-300 md:-translate-x-2 md:opacity-0 md:group-hover/sidebar:translate-x-0 md:group-hover/sidebar:opacity-100";

const EmployeeSidebar = () => {
  const { user } = useAuth();
  const { open, setOpen } = useSidebar();
  const [imgFailed, setImgFailed] = useState(false);

  const sidebarLinks = [
    { link: "/employee-dashboard", icon: LayoutDashboard, title: "Dashboard", group: "Overview" },
    { link: `/employee-dashboard/profile/${user?._id}`, icon: UserCircle, title: "My Profile", group: "Overview" },
    { link: `/employee-dashboard/leaves/${user?._id}`, icon: CalendarCheck, title: "Leaves", group: "Time & pay" },
    { link: "/employee-dashboard/overtime", icon: Clock, title: "Overtime & OT", group: "Time & pay" },
    { link: "/employee-dashboard/expenses", icon: Receipt, title: "Expenses", group: "Time & pay" },
    { link: `/employee-dashboard/payslips/${user?._id}`, icon: FileText, title: "Payslips", group: "Time & pay" },
    ...(user?.isManager ? [{ link: "/employee-dashboard/team-requests", icon: Users, title: "Team Requests", group: "Team" }] : []),
    { link: "/employee-dashboard/setting", icon: Settings, title: "Settings", group: "Account" },
  ];

  // keep link order, group consecutive items
  const groups = sidebarLinks.reduce((acc, item) => {
    const last = acc[acc.length - 1];
    if (last && last.name === item.group) last.items.push(item);
    else acc.push({ name: item.group, items: [item] });
    return acc;
  }, []);

  // mobile: Esc closes, and the page behind doesn't scroll while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const isMobile = window.innerWidth < 768;
    const prev = document.body.style.overflow;
    if (isMobile) document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, setOpen]);

  const name = user?.name || "Employee";
  const photo = imageUrl(user?.profileImage);

  return (
    <>
      {/* MOBILE OVERLAY */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm md:hidden"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        aria-label="Employee navigation"
        className={`
          group/sidebar fixed left-0 top-0 z-50 flex h-screen w-72 flex-col overflow-hidden
          bg-white/90 shadow-[20px_0_60px_-20px_rgba(127,29,29,0.25)] ring-1 ring-red-100/60 backdrop-blur-2xl
          transition-[transform,width] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]
          ${open ? "translate-x-0" : "-translate-x-full"}
          md:sticky md:w-24 md:translate-x-0 md:hover:w-72
        `}
      >
        {/* soft red glow */}
        <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-red-200/40 blur-3xl" />

        {/* ============ BRAND ============ */}
        <div className="relative shrink-0 p-4">
          <div className="relative flex h-16 items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 px-3 shadow-lg shadow-red-600/30">
            <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/20 blur-xl" />
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
              <img src={Logo} className="h-7 w-7 rounded-lg object-contain" alt="Hakirush logo" />
            </div>
            <div className={`relative min-w-0 ${railText}`}>
              <p className="text-base font-extrabold leading-none tracking-tight text-white">Hakirush</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/75">Employee hub</p>
            </div>
            <button
              className="relative ml-auto rounded-xl bg-white/15 p-1.5 text-white ring-1 ring-white/25 transition hover:bg-white/25 md:hidden"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ============ NAVIGATION ============ */}
        <nav className="no-scrollbar relative flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4">
          {groups.map((g, gi) => (
            <div key={g.name} className={gi ? "mt-5" : "mt-1"}>
              <div className="relative mb-2 flex h-4 items-center px-3">
                {/* collapsed rail shows a short rule instead of the heading */}
                <span className="absolute left-1/2 hidden h-px w-6 -translate-x-1/2 bg-gray-200 transition-opacity md:block md:group-hover/sidebar:opacity-0" />
                <p className={`text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400 ${railText}`}>{g.name}</p>
              </div>
              <div className="space-y-1">
                {g.items.map((item) => (
                  <NavLink
                    key={item.link}
                    to={item.link}
                    title={item.title}
                    onClick={() => {
                      if (window.innerWidth < 768) setOpen(false);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    end
                    className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                  >
                    {({ isActive }) => (
                      <div
                        className={`group/item relative flex h-12 items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition-colors duration-200 ${
                          isActive ? "text-white" : "text-gray-500 hover:bg-red-50/70 hover:text-red-700"
                        }`}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="emp-sidebar-active"
                            className="absolute inset-0 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 shadow-lg shadow-red-600/30"
                            transition={{ type: "spring", stiffness: 380, damping: 32 }}
                          />
                        )}
                        <span
                          className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                            isActive ? "bg-white/20" : "bg-gray-50 ring-1 ring-gray-100 group-hover/item:bg-white group-hover/item:ring-red-100"
                          } md:mx-[0.125rem]`}
                        >
                          <item.icon size={18} strokeWidth={isActive ? 2.25 : 1.9} />
                        </span>
                        <span className={`relative ${railText}`}>{item.title}</span>
                      </div>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* ============ USER CARD ============ */}
        <div className="relative shrink-0 border-t border-gray-100 p-4">
          <NavLink
            to={`/employee-dashboard/profile/${user?._id}`}
            onClick={() => { if (window.innerWidth < 768) setOpen(false); }}
            className="flex items-center gap-3 rounded-2xl p-1.5 transition hover:bg-red-50/70"
            title={name}
          >
            <div className="relative shrink-0 md:mx-[0.375rem]">
              {photo && !imgFailed ? (
                <img src={photo} alt={name} onError={() => setImgFailed(true)} className="h-10 w-10 rounded-xl object-cover ring-2 ring-white" />
              ) : (
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${colorFor(name)} text-sm font-bold text-white ring-2 ring-white`}>
                  {initials(name)}
                </div>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>
            <div className={`min-w-0 ${railText}`}>
              <p className="truncate text-sm font-bold text-gray-900">{name}</p>
              <p className="truncate text-xs text-gray-400">{user?.isManager ? "Manager" : "Employee"}</p>
            </div>
          </NavLink>
        </div>
      </aside>
    </>
  );
};

export default EmployeeSidebar;