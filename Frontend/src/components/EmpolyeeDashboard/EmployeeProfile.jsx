import axios from "axios";
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { formatTotalExperience } from "../../utils/employeeExperience";
import {
  Calendar, ChevronLeft, Fingerprint, Mail,
  Droplets, Briefcase, IdCard, CreditCard,
  PiggyBank, Heart, User, Edit, Globe, X
} from "lucide-react";

/* ================= DESIGN TOKENS ================= */
/* Same palette + type system as the Admin and Employee dashboards,
   so this page reads as the same product, not a third visual identity. */
const INK = "#1C1A17";
const GARNET = "#7A2233";
const GOLD = "#C6A15B";
const HAIRLINE = "#E7DFD2";
const CREAM = "#FBF8F3";
const SAGE = "#3F5B54";
const SLATE = "#4A5A6B";

const displayFont = { fontFamily: "'Playfair Display', 'Georgia', serif" };
const bodyFont = { fontFamily: "'Inter', 'Helvetica Neue', sans-serif" };

const GRAIN_URI =
  "data:image/svg+xml;utf8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='140'%20height='140'%3E%3Cfilter%20id='n'%3E%3CfeTurbulence%20type='fractalNoise'%20baseFrequency='0.85'%20numOctaves='2'%20stitchTiles='stitch'/%3E%3C/filter%3E%3Crect%20width='100%25'%20height='100%25'%20filter='url(%23n)'%20opacity='0.5'/%3E%3C/svg%3E";

const CornerTicks = ({ color = GOLD }) => (
  <>
    <span className="pointer-events-none absolute top-4 left-4 h-2.5 w-2.5 border-t border-l opacity-70" style={{ borderColor: color }} />
    <span className="pointer-events-none absolute top-4 right-4 h-2.5 w-2.5 border-t border-r opacity-70" style={{ borderColor: color }} />
  </>
);

const EmployeeProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isImageOpen, setIsImageOpen] = useState(false);

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/employee/${id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        if (res.data?.success) setEmployee(res.data.employee);
      } catch {
        console.error("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };
    fetchEmployee();
  }, [id]);

  // Close lightbox on Escape key
  useEffect(() => {
    if (!isImageOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setIsImageOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isImageOpen]);

  const getImageUrl = (imagePath) => {
    if (!imagePath) return "/default-avatar.png";
    if (imagePath.startsWith("http")) return imagePath;
    return `${import.meta.env.VITE_BACKEND_URL}/${imagePath.replace(/^\/+/, "")}`;
  };

  const initials = React.useMemo(() => {
    const name = employee?.userId?.name || "";
    return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  }, [employee]);

  if (loading) return <LoadingPulse />;
  if (!employee) return <ErrorView />;

  const hasProfileImage = Boolean(employee?.userId?.profileImage);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#FBF8F3] via-white to-[#F3EDE0] p-4 text-[#1C1A17] lg:p-10" style={bodyFont}>
      {/* soft ambient glow + grain, matching the rest of the dashboard */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[420px] opacity-70"
        style={{
          background:
            "radial-gradient(60% 60% at 15% 0%, rgba(198,161,91,0.10), transparent 70%), radial-gradient(50% 50% at 100% 0%, rgba(122,34,51,0.06), transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.035] mix-blend-multiply"
        style={{ backgroundImage: `url("${GRAIN_URI}")` }}
      />

      <div className="relative z-10 mx-auto max-w-3xl">

        <div
          className="relative overflow-hidden rounded-[1.75rem] border bg-white/70 shadow-[0_1px_2px_rgba(28,26,23,0.04),0_40px_90px_-32px_rgba(28,26,23,0.24)] backdrop-blur-md"
          style={{ borderColor: HAIRLINE }}
        >
          {/* masthead rule, matching Admin & Employee dashboards */}
          <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${GARNET}, ${GOLD} 45%, ${GARNET})` }} />
          <CornerTicks />

          {/* ============ NAMEPLATE ============ */}
          <div className="flex flex-col items-center px-8 pb-10 pt-12 text-center sm:px-14">
            <div
              onClick={() => hasProfileImage && setIsImageOpen(true)}
              className={`flex h-20 w-20 items-center justify-center rounded-full border-2 transition-transform ${hasProfileImage ? "cursor-pointer hover:scale-105" : ""}`}
              style={{ borderColor: `${GOLD}55`, color: GOLD }}
            >
              {hasProfileImage ? (
                <img
                  src={getImageUrl(employee.userId.profileImage)}
                  className="h-full w-full rounded-full object-cover"
                  alt="Profile"
                  onError={(e) => { e.target.style.display = "none"; }}
                />
              ) : (
                <span className="text-lg" style={{ ...displayFont, fontWeight: 700 }}>{initials}</span>
              )}
            </div>

            <p className="mt-6 text-[9px] font-semibold uppercase tracking-[0.32em]" style={{ color: GOLD }}>
              HAKIRUSH · Member Since {new Date(employee.dateOfJoining).getFullYear()}
            </p>
            <h1 className="mt-3 text-4xl leading-none sm:text-5xl tracking-tight" style={{ ...displayFont, fontWeight: 700 }}>
              {employee?.userId?.name}
            </h1>
            <p className="mt-3 text-xs uppercase tracking-[0.18em]" style={{ color: "#8A8378" }}>
              {employee?.designation || "Executive Member"} &nbsp;·&nbsp; {employee?.department?.dep_name}
            </p>

            <button
              onClick={() => navigate(`/employee-dashboard/profile/${employee._id}/edit`)}
              className="mt-7 flex cursor-pointer items-center gap-2 rounded-full border px-7 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] transition-colors"
              style={{ borderColor: INK, color: INK }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = GARNET;
                e.currentTarget.style.borderColor = GARNET;
                e.currentTarget.style.color = "#FFFFFF";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.borderColor = INK;
                e.currentTarget.style.color = INK;
              }}
            >
              <Edit size={13} strokeWidth={1.75} /> Edit Profile
            </button>
          </div>

          <GoldRule />

          {/* ============ DOSSIER ============ */}
          <div className="grid grid-cols-1 gap-x-10 gap-y-8 px-8 py-10 sm:grid-cols-2 sm:px-14">
            <Field icon={<Fingerprint size={14} strokeWidth={1.5} />} label="Employee ID" value={employee.employeeId} />
            <Field icon={<Mail size={14} strokeWidth={1.5} />} label="Email Address" value={employee.userId?.email} />
            <Field icon={<Globe size={14} strokeWidth={1.5} />} label="Department" value={employee.department?.dep_name} />
            <Field
              icon={<Calendar size={14} strokeWidth={1.5} />}
              label="Date of Birth"
              value={new Date(employee.dob).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
            />
            <Field icon={<User size={14} strokeWidth={1.5} />} label="Gender" value={employee.gender} />
            <Field icon={<Heart size={14} strokeWidth={1.5} />} label="Marital Status" value={employee.maritalStatus} />
            <Field icon={<Droplets size={14} strokeWidth={1.5} />} label="Blood Group" value={employee.bloodGroup} />
            <Field
              icon={<Briefcase size={14} strokeWidth={1.5} />}
              label="Total Experience"
              value={formatTotalExperience(employee.experience, employee.dateOfJoining, {
                isActive: employee.isActive ?? employee.userId?.isActive,
                inactiveSince: employee.inactiveSince,
                inactiveDurationMs: employee.inactiveDurationMs,
              })}
            />
            <Field
              icon={<Calendar size={14} strokeWidth={1.5} />}
              label="Official Join Date"
              value={new Date(employee.dateOfJoining).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
            />
            <Field icon={<IdCard size={14} strokeWidth={1.5} />} label="Aadhar Card" value={employee.aadharcard} />
            <Field icon={<CreditCard size={14} strokeWidth={1.5} />} label="PAN Card" value={employee.pancard} />
            <Field icon={<PiggyBank size={14} strokeWidth={1.5} />} label="PF Number" value={employee.pfNumber} />
          </div>

          <GoldRule />

          {/* ============ COMPENSATION ============ */}
          <div className="flex flex-col items-center justify-between gap-6 px-8 py-10 sm:flex-row sm:px-14">
            <div className="text-center sm:text-left">
              <p className="text-[9px] font-semibold uppercase tracking-[0.32em]" style={{ color: GOLD }}>
                Annual Compensation
              </p>
              <h2 className="mt-2 text-3xl leading-none tracking-tight" style={{ ...displayFont, fontWeight: 700 }}>
                ₹{Number(employee.salary || 0).toLocaleString('en-IN')}
              </h2>
            </div>
            <div
              className="flex items-center gap-2.5 rounded-full px-6 py-3 text-[9px] font-semibold uppercase tracking-[0.24em]"
              style={{ backgroundColor: CREAM, color: "#8A8378", border: `1px solid ${HAIRLINE}` }}
            >
              <CreditCard size={14} strokeWidth={1.5} style={{ color: GOLD }} />
              Paid Annually
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-[9px] font-semibold uppercase tracking-[0.28em]" style={{ color: "#8A8378" }}>
          Verified &nbsp;·&nbsp; Active &nbsp;·&nbsp; On-Site
        </p>
      </div>

      {/* ============ IMAGE LIGHTBOX ============ */}
      {isImageOpen && hasProfileImage && (
        <div
          onClick={() => setIsImageOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-sm"
          style={{ backgroundColor: "rgba(28,26,23,0.82)" }}
        >
          <button
            onClick={() => setIsImageOpen(false)}
            className="absolute right-5 top-5 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/20 text-white transition-colors hover:bg-white/10"
            aria-label="Close"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
          <img
            src={getImageUrl(employee.userId.profileImage)}
            alt="Profile enlarged"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};

// --- SUPPORTING COMPONENTS ---

const GoldRule = () => (
  <div className="px-8 sm:px-14">
    <div className="h-px" style={{ backgroundColor: `${GOLD}45` }} />
  </div>
);

const Field = ({ icon, label, value }) => (
  <div>
    <div className="flex items-center gap-2" style={{ color: GOLD }}>
      {icon}
      <span className="text-[9px] font-semibold uppercase tracking-[0.2em]" style={{ color: "#8A8378" }}>{label}</span>
    </div>
    <p className="mt-1.5 truncate text-base tracking-tight" style={{ ...displayFont, fontWeight: 700 }}>
      {value || "—"}
    </p>
  </div>
);

const LoadingPulse = () => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-br from-[#FBF8F3] via-white to-[#F3EDE0]">
    <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#E7DFD2] border-t-[#7A2233]"></div>
    <p className="text-[9px] font-semibold uppercase tracking-[0.32em]" style={{ color: "#8A8378", ...bodyFont }}>Preparing Dossier</p>
  </div>
);

const ErrorView = () => (
  <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#FBF8F3] via-white to-[#F3EDE0] p-6 text-center">
    <div className="rounded-[1.75rem] border bg-white/80 px-12 py-14 shadow-[0_40px_90px_-32px_rgba(28,26,23,0.24)] backdrop-blur-md" style={{ borderColor: HAIRLINE }}>
      <h2 className="text-3xl leading-none tracking-tight" style={{ ...displayFont, fontWeight: 700 }}>
        Not Found
      </h2>
      <button
        onClick={() => window.history.back()}
        className="mt-6 cursor-pointer rounded-full px-8 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white transition-colors"
        style={{ backgroundColor: INK, ...bodyFont }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = GARNET)}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = INK)}
      >
        Go Back
      </button>
    </div>
  </div>
);

export default EmployeeProfile;
