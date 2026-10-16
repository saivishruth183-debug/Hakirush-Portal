import React, { useEffect } from "react";
import Logo from "/favicon.png";
import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  X,
  LayoutDashboard,
  Building,
  User,
  UserSquare,
  UserCheck,
  CalendarCheck,
  PartyPopper,
  BadgeDollarSign,
  Store,
  Briefcase,
  Receipt,
} from "lucide-react";
import { useSidebar } from "../../context/sidebarContext";

/* Same links as before, grouped so the menu is easier to scan */
const sidebarSections = [
  {
    title: "Overview",
    links: [{ link: "/admin-dashboard", icon: LayoutDashboard, title: "Dashboard", end: true }],
  },
  {
    title: "People",
    links: [
      { link: "/admin-dashboard/departments", icon: Building, title: "Departments" },
      { link: "/admin-dashboard/employees", icon: User, title: "Employees" },
      { link: "/admin-dashboard/clients", icon: UserSquare, title: "Clients" },
    ],
  },
  {
    title: "Partners",
    links: [
      { link: "/admin-dashboard/sponsors", icon: BadgeDollarSign, title: "Sponsors" },
      { link: "/admin-dashboard/stalls", icon: Store, title: "Stalls" },
    ],
  },
  {
    title: "Workforce",
    links: [
      { link: "/admin-dashboard/attendance", icon: UserCheck, title: "Attendance" },
      { link: "/admin-dashboard/leaves", icon: CalendarCheck, title: "Leaves" },
      { link: "/admin-dashboard/holidays", icon: PartyPopper, title: "Holidays" },
    ],
  },
  {
    title: "Finance",
    links: [
      { link: "/admin-dashboard/expenses", icon: Receipt, title: "Expenses" },
      { link: "/admin-dashboard/assets", icon: Briefcase, title: "Assets" },
    ],
  },
  {
    title: "Updates",
    links: [{ link: "/admin-dashboard/announcement", icon: Bell, title: "Announcement" }],
  },
];

/* Labels are always visible in the mobile drawer; on desktop they appear when the rail is hovered. */
const reveal =
  "whitespace-nowrap transition-all duration-300 md:-translate-x-2 md:opacity-0 md:group-hover/sidebar:translate-x-0 md:group-hover/sidebar:opacity-100";

const AdminSidebar = () => {
  const { open, setOpen } = useSidebar();
  const location = useLocation();

  // mobile drawer: close on Esc and stop the page behind it from scrolling
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const isMobile = window.innerWidth < 768;
    if (isMobile) document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, setOpen]);

  // close the mobile drawer whenever the page changes
  useEffect(() => {
    if (window.innerWidth < 768) setOpen(false);
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* ============ MOBILE OVERLAY ============ */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="sidebar-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-gray-900/30 backdrop-blur-sm md:hidden"
          />
        )}
      </AnimatePresence>

      <aside
        className={`group/sidebar fixed left-0 top-0 z-50 flex h-screen w-72 flex-col overflow-hidden font-sans
          bg-white/85 backdrop-blur-2xl
          shadow-[18px_0_50px_-20px_rgba(127,29,29,0.18)] ring-1 ring-red-100
          transition-[transform,width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]
          ${open ? "translate-x-0" : "-translate-x-full"}
          md:sticky md:w-[88px] md:translate-x-0 md:hover:w-72`}
        aria-label="Admin navigation"
      >
        {/* top brand strip — matches the navbar */}
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-red-600 via-rose-500 to-orange-400" />

        {/* ============ BRAND ============ */}
        <div className="relative flex h-[74px] shrink-0 items-center gap-3 px-5">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 shadow-lg shadow-red-600/30">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white">
              <img src={Logo} className="h-6 w-6 object-contain" alt="Hakirush" />
            </span>
          </div>

          <div className={`flex min-w-0 flex-col ${reveal}`}>
            <span className="text-lg font-extrabold leading-none tracking-tight text-gray-900">
              Haki<span className="text-red-600">rush</span>
            </span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-gray-400">Admin Portal</span>
          </div>

          <button
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-xl bg-white text-gray-500 shadow-sm ring-1 ring-red-100 transition hover:rotate-90 hover:text-red-600 md:hidden"
          >
            <X size={17} />
          </button>
        </div>

        <div className="mx-5 h-px shrink-0 bg-gradient-to-r from-transparent via-red-200 to-transparent" />

        {/* ============ NAVIGATION ============ */}
        <nav className="no-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-4 pb-6 pt-4">
          {sidebarSections.map((section, si) => (
            <div key={section.title} className={si > 0 ? "mt-3" : ""}>
              {/* section label (expanded) / thin divider (collapsed) */}
              <div className="relative mb-1.5 flex h-5 items-center px-3">
                <span className={`text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 ${reveal}`}>
                  {section.title}
                </span>
                {si > 0 && (
                  <span className="absolute left-1/2 top-1/2 hidden h-px w-6 -translate-x-1/2 bg-red-100 transition-opacity duration-300 md:block md:group-hover/sidebar:opacity-0" />
                )}
              </div>

              <div className="space-y-1">
                {section.links.map((item) => (
                  <NavLink
                    key={item.link}
                    to={item.link}
                    end={item.end}
                    onClick={() => {
                      if (window.innerWidth < 768) setOpen(false);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    title={item.title}
                    className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                  >
                    {({ isActive }) => (
                      <div
                        className={`group/item relative flex items-center gap-3 rounded-2xl py-2 pl-2 pr-3 text-sm font-semibold transition-colors duration-200 ${
                          isActive ? "text-white" : "text-gray-500 hover:bg-red-50/70 hover:text-gray-900"
                        }`}
                      >
                        {/* sliding active pill */}
                        {isActive && (
                          <motion.span
                            layoutId="sidebar-active"
                            transition={{ type: "spring", stiffness: 420, damping: 34 }}
                            className="absolute inset-0 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 shadow-lg shadow-red-600/25"
                          />
                        )}

                        <span
                          className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
                            isActive
                              ? "bg-white/20"
                              : "bg-white text-gray-400 shadow-sm ring-1 ring-gray-100 group-hover/item:text-red-600 group-hover/item:ring-red-100"
                          }`}
                        >
                          <item.icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                        </span>

                        <span className={`relative ${reveal}`}>{item.title}</span>

                        {isActive && (
                          <span className={`relative ml-auto h-1.5 w-1.5 rounded-full bg-white ${reveal}`} />
                        )}
                      </div>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* ============ FOOTER ============ */}
        <div className="shrink-0 p-4">
          <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-red-50 to-rose-50 p-3 ring-1 ring-red-100">
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
            </span>
            <div className={`min-w-0 leading-tight ${reveal}`}>
              <p className="text-xs font-bold text-gray-900">System online</p>
              <p className="text-[10px] text-gray-400">© {new Date().getFullYear()} Hakirush</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;
