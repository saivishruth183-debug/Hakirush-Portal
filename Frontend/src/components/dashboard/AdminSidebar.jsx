import React from "react";
import Logo from "/favicon.png";
import { NavLink } from "react-router-dom";
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
} from "lucide-react";
import { useSidebar } from "../../context/sidebarContext";

const CHARCOAL = "#1A1A1D";
const GOLD = "#AD8A56";
const IVORY = "#F6F2EA";
const SLATE = "#7A756C";
const HAIRLINE = "rgba(26,26,29,0.10)";
const GOLD_HAIRLINE = "rgba(173,138,86,0.35)";

/* Accent — matches the red used on checkout / profile */
const RED = "#C0362C";
const RED_DEEP = "#9C2B23";
const RED_HAIRLINE = "rgba(192,54,44,0.35)";
const RED_WASH = "rgba(192,54,44,0.08)";

const displayFont = { fontFamily: "'Cormorant Garamond', 'Georgia', serif" };
const bodyFont = { fontFamily: "'Inter', 'Helvetica Neue', sans-serif" };

const sidebarLinks = [
  { link: "/admin-dashboard", icon: LayoutDashboard, title: "Dashboard" },
  { link: "/admin-dashboard/departments", icon: Building, title: "Departments" },
  { link: "/admin-dashboard/employees", icon: User, title: "Employees" },
  { link: "/admin-dashboard/clients", icon: UserSquare, title: "Clients" },
  { link: "/admin-dashboard/sponsors", icon: BadgeDollarSign, title: "Sponsors" },
  { link: "/admin-dashboard/stalls", icon: Store, title: "Stalls" },
  { link: "/admin-dashboard/attendance", icon: UserCheck, title: "Attendance" },
  { link: "/admin-dashboard/leaves", icon: CalendarCheck, title: "Leaves" },
  { link: "/admin-dashboard/holidays", icon: PartyPopper, title: "Holidays" },
  { link: "/admin-dashboard/announcement", icon: Bell, title: "Announcement" },
  { link: "/admin-dashboard/assets", icon: Briefcase, title: "Assets" },
];

const AdminSidebar = () => {
  const { open, setOpen } = useSidebar();

  return (
    <>
      {/* MOBILE OVERLAY */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-[#1A1A1D]/30 backdrop-blur-md duration-300 animate-in fade-in md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`
          fixed md:sticky top-0 left-0 z-50 h-screen
          bg-white/85 backdrop-blur-2xl
          border-r
          shadow-[20px_0_60px_rgba(26,26,29,0.06)]
          transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]
          ${open ? "translate-x-0 w-72" : "-translate-x-full w-72"}
          md:translate-x-0 md:w-24 md:hover:w-72
          overflow-hidden group/sidebar
        `}
        style={{ borderColor: HAIRLINE, ...bodyFont }}
      >
        {/* ============ WORDMARK ============ */}
        <div className="relative flex h-18 items-center gap-4 px-5" style={{ backgroundColor: CHARCOAL }}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: GOLD_HAIRLINE }}>
            <img src={Logo} className="h-6 w-6 rounded-full object-contain" alt="Logo" />
          </div>

          <div className="flex flex-col opacity-0 transition-opacity duration-300 md:group-hover/sidebar:opacity-100">
            <span className="text-lg leading-none text-white" style={{ ...displayFont, fontWeight: 500 }}>
              Hakirush
            </span>
            <span className="mt-1 text-[8.5px] font-semibold uppercase tracking-[0.28em]" style={{ color: GOLD }}>
              Admin Portal
            </span>
          </div>

          <button
            className="relative z-10 ml-auto rounded-full p-2 text-white/70 transition-colors hover:text-white md:hidden"
            onClick={() => setOpen(false)}
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* ============ NAVIGATION ============ */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-4 pb-10 pt-6 no-scrollbar">
          <p
            className="mb-4 ml-3 text-[9px] font-semibold uppercase tracking-[0.28em] opacity-0 transition-opacity md:group-hover/sidebar:opacity-100"
            style={{ color: SLATE }}
          >
            Navigation
          </p>

          {sidebarLinks.map((item, i) => (
            <NavLink
              key={i}
              to={item.link}
              onClick={() => {
                if (window.innerWidth < 768) setOpen(false);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              end
            >
              {({ isActive }) => (
                <div
                  className="group/item relative flex items-center gap-4 rounded-xl py-3 pl-3 pr-4 text-[11px] font-semibold uppercase tracking-widest transition-colors duration-300"
                  style={{
                    color: isActive ? CHARCOAL : SLATE,
                    backgroundColor: isActive ? RED_WASH : "transparent",
                  }}
                >
                  {/* active rule */}
                  <span
                    className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full transition-opacity"
                    style={{ backgroundColor: RED, opacity: isActive ? 1 : 0 }}
                  />

                  <div className="flex w-7 shrink-0 justify-center" style={{ color: isActive ? RED_DEEP : "inherit" }}>
                    <item.icon size={19} strokeWidth={isActive ? 2 : 1.5} />
                  </div>

                  <span className="translate-x-0 whitespace-nowrap opacity-100 transition-all duration-300 md:-translate-x-3 md:opacity-0 md:group-hover/sidebar:translate-x-0 md:group-hover/sidebar:opacity-100">
                    {item.title}
                  </span>
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* ============ FOOTER ============ */}
        <div className="absolute bottom-4 left-0 w-full px-7 opacity-0 transition-all duration-500 md:group-hover/sidebar:opacity-100">
          <div className="mb-4 h-px" style={{ backgroundColor: RED_HAIRLINE }} />
          <div className="flex items-center gap-2.5" style={{ color: SLATE }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: RED }} />
            <span className="text-[8.5px] font-semibold uppercase tracking-[0.22em]">Node Online</span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;
