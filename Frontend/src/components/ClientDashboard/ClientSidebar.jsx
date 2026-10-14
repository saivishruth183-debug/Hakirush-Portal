import React from "react";
import Logo from "/favicon.png";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Shirt,
  Settings,
  X,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../../context/authContext";
import { useSidebar } from "../../context/sidebarContext";

const CHARCOAL = "#1A1A1D";
const SLATE = "#7A756C";
const HAIRLINE = "rgba(26,26,29,0.10)";

/* Accent — matches the red used on checkout / profile / admin & employee sidebars */
const RED = "#C0362C";
const RED_DEEP = "#9C2B23";
const RED_HAIRLINE = "rgba(192,54,44,0.35)";
const RED_WASH = "rgba(192,54,44,0.08)";

const displayFont = { fontFamily: "'Cormorant Garamond', 'Georgia', serif" };
const bodyFont = { fontFamily: "'Inter', 'Helvetica Neue', sans-serif" };

const ClientSidebar = () => {
  const { user } = useAuth();
  const { open, setOpen } = useSidebar();

  const sidebarLinks = [
    { link: "/client-dashboard", icon: LayoutDashboard, title: "Dashboard" },
    {
      link: `/client-dashboard/ourrelationship/${user?._id}`,
      icon: Shirt,
      title: "Roster",
    },
    { link: "/client-dashboard/setting", icon: Settings, title: "Settings" },
  ];

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
        <div className="relative flex h-16 items-center gap-4 px-5" style={{ backgroundColor: CHARCOAL }}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border" style={{ borderColor: RED_HAIRLINE }}>
            <img src={Logo} className="h-6 w-6 rounded-full object-contain" alt="Logo" />
          </div>

          <div className="flex flex-col opacity-0 transition-opacity duration-300 md:group-hover/sidebar:opacity-100">
            <span className="text-lg leading-none text-white" style={{ ...displayFont, fontWeight: 500 }}>
              Hakirush
            </span>
            <span className="mt-1 text-[8.5px] font-semibold uppercase tracking-[0.28em]" style={{ color: RED }}>
              Client Terminal
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
            Partnership Portal
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
            <ShieldCheck size={12} style={{ color: RED }} />
            <span className="text-[8.5px] font-semibold uppercase tracking-[0.22em]">Secure Connection</span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default ClientSidebar;
