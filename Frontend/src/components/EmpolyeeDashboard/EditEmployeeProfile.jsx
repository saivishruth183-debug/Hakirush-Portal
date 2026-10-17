import axios from "axios";
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiErrorCode, apiErrorMessage } from "../../utils/apiError";
import {
  User, Calendar, Briefcase, Heart, Droplets,
  Fingerprint, CreditCard, PiggyBank, Camera, Check, X, Globe
} from "lucide-react";

/* ================= DESIGN TOKENS ================= */
/* Same palette + type system as EmployeeProfile.jsx, so this page
   reads as the same product, not a third visual identity. */
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

const MAX_FILE_SIZE = 5 * 1024 * 1024; // matches server limit (5MB)

/* ================= CONFIRMATION DIALOG ================= */
const ConfirmDialog = ({ onClose }) => (
  <>
    <div className="fixed inset-0 z-50" style={{ backgroundColor: "rgba(28,26,23,0.55)", backdropFilter: "blur(6px)" }} />
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-[1.75rem] border bg-white/95 text-center shadow-[0_40px_90px_-32px_rgba(28,26,23,0.4)] backdrop-blur-md"
        style={{ borderColor: HAIRLINE }}
      >
        <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${GARNET}, ${GOLD} 45%, ${GARNET})` }} />
        <CornerTicks />
        <div className="px-10 pb-12 pt-10">
          <div
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border-2"
            style={{ borderColor: `${GOLD}55`, color: GOLD }}
          >
            <Check size={26} strokeWidth={1.75} />
          </div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.32em]" style={{ color: GOLD }}>
            HAKIRUSH · Record Synced
          </p>
          <h3 className="mt-3 text-3xl leading-none" style={{ ...displayFont, fontWeight: 700, color: INK }}>
            Profile Updated
          </h3>
          <p className="mt-3 text-xs leading-relaxed" style={{ color: "#8A8378" }}>
            Your details have been saved successfully.
          </p>
          <button
            onClick={onClose}
            className="mt-8 w-full cursor-pointer rounded-full py-3.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-white transition-colors"
            style={{ backgroundColor: INK }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = GARNET)}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = INK)}
          >
            Return to Profile
          </button>
        </div>
      </div>
    </div>
  </>
);

const EditEmployeeProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState(null);
  const [name, setName] = useState("");
  const [experience, setExperience] = useState("");
  const [dob, setDob] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("");

  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState("/default-avatar.png");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAlert, setShowAlert] = useState(false);
  const [aadharcard, setAadharcard] = useState("");
  const [pancard, setPancard] = useState("");
  const [pfNumber, setPfNumber] = useState("");
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/api/employee/${id}`,
          { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
        );

        const emp = res.data.employee;
        setEmployee(emp);
        setName(emp?.userId?.name || "");
        setExperience(emp?.experience || "");
        setDob(emp?.dob ? emp.dob.split("T")[0] : "");
        setBloodGroup(emp?.bloodGroup || "");
        setMaritalStatus(emp?.maritalStatus || "");
        setAadharcard(emp?.aadharcard || "");
        setPancard(emp?.pancard || "");
        setPfNumber(emp?.pfNumber || "");

        const profileImg = emp?.userId?.profileImage;
        if (profileImg) {
          setPreview(
            profileImg.startsWith("http")
              ? profileImg
              : `${import.meta.env.VITE_BACKEND_URL}/${profileImg}`
          );
        }
      } catch (err) {
        console.error("Failed to load employee");
        setLoadError(apiErrorMessage(err, "Couldn't load your profile."));
      } finally {
        setLoading(false);
      }
    };

    fetchEmployee();
  }, [id]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      alert("Image must be under 5MB");
      return;
    }
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  // Self-service allowlist only: name, experience, dob, bloodGroup,
  // maritalStatus, aadharcard, pancard, pfNumber (+ profileImage).
  // Salary, department and designation are admin-managed and never sent.
  const handleSave = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaveError("");
    try {
      setSaving(true);
      const fd = new FormData();
      fd.append("name", name);
      fd.append("experience", experience);
      fd.append("dob", dob);
      fd.append("bloodGroup", bloodGroup);
      fd.append("maritalStatus", maritalStatus);
      fd.append("aadharcard", aadharcard);
      fd.append("pancard", pancard);
      fd.append("pfNumber", pfNumber);
      if (image) fd.append("profileImage", image);

      await axios.put(
        `${import.meta.env.VITE_BACKEND_URL}/api/employee/update-profile/${id}`,
        fd,
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );

      setShowAlert(true);
    } catch (err) {
      if (apiErrorCode(err) === "FIELD_NOT_EDITABLE") {
        setSaveError(
          `${apiErrorMessage(err, "Some of these fields can only be changed by an administrator.")} ` +
            "Contact HR to change salary, department or designation."
        );
      } else {
        setSaveError(apiErrorMessage(err, "Update failed"));
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingPulse />;

  if (!employee) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBF8F3] p-6" style={bodyFont}>
        <div className="max-w-sm rounded-[1.5rem] border bg-white p-8 text-center" style={{ borderColor: HAIRLINE }}>
          <p className="text-sm font-semibold" style={{ color: GARNET }}>{loadError || "Profile not found."}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-6 cursor-pointer rounded-full px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-white"
            style={{ backgroundColor: INK }}
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

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

      {showAlert && (
        <ConfirmDialog onClose={() => navigate(`/employee-dashboard/profile/${employee._id}`)} />
      )}

      <div className="relative z-10 mx-auto max-w-3xl">

        <button
          onClick={() => navigate(-1)}
          className="mb-8 flex cursor-pointer items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] transition-colors hover:text-[#7A2233]"
          style={{ color: "#8A8378" }}
        >
          <X size={14} strokeWidth={1.75} /> Discard
        </button>

        <form onSubmit={handleSave}>
          <div
            className="relative overflow-hidden rounded-[1.75rem] border bg-white/70 shadow-[0_1px_2px_rgba(28,26,23,0.04),0_40px_90px_-32px_rgba(28,26,23,0.24)] backdrop-blur-md"
            style={{ borderColor: HAIRLINE }}
          >
            {/* masthead rule, matching Admin & Employee dashboards */}
            <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${GARNET}, ${GOLD} 45%, ${GARNET})` }} />
            <CornerTicks />

            {/* ============ PORTRAIT + IDENTITY ============ */}
            <div className="flex flex-col items-center px-8 pb-10 pt-12 text-center sm:px-14">
              <div className="relative">
                <div
                  className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2"
                  style={{ borderColor: `${GOLD}55` }}
                >
                  <img src={preview} alt="preview" className="h-full w-full object-cover" />
                </div>
                <label
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-white shadow-[0_8px_20px_-6px_rgba(28,26,23,0.5)] transition-colors"
                  style={{ backgroundColor: INK }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = GARNET)}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = INK)}
                >
                  <Camera size={14} strokeWidth={1.75} />
                  <input type="file" hidden accept="image/*" onChange={handleImageChange} />
                </label>
              </div>

              <p className="mt-6 text-[9px] font-semibold uppercase tracking-[0.32em]" style={{ color: GOLD }}>
                HAKIRUSH · Editing Record
              </p>

              <div className="mt-3 w-full max-w-sm">
                <input
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter full name"
                  required
                  className="w-full border-b bg-transparent pb-2 text-center text-4xl leading-none outline-none transition-colors sm:text-5xl"
                  style={{ ...displayFont, fontWeight: 700, borderColor: HAIRLINE, color: INK }}
                  onFocus={(e) => (e.target.style.borderColor = GOLD)}
                  onBlur={(e) => (e.target.style.borderColor = HAIRLINE)}
                />
              </div>

              <p className="mt-3 text-xs uppercase tracking-[0.18em]" style={{ color: "#8A8378" }}>
                {employee?.designation || "Executive Member"} &nbsp;·&nbsp; {employee?.department?.dep_name}
              </p>
            </div>

            <GoldRule />

            {/* ============ REGISTRY FIELDS ============ */}
            <div className="grid grid-cols-1 gap-x-10 gap-y-8 px-8 py-10 sm:grid-cols-2 sm:px-14">
              <StaticField icon={<Fingerprint size={14} strokeWidth={1.5} />} label="Employee ID" value={employee?.employeeId} />
              <StaticField icon={<Globe size={14} strokeWidth={1.5} />} label="Department" value={employee?.department?.dep_name} />
              <StaticField icon={<Briefcase size={14} strokeWidth={1.5} />} label="Designation" value={employee?.designation} />
              <p className="self-end text-[11px] leading-relaxed sm:col-span-1" style={{ color: "#8A8378" }}>
                Employee ID, department, designation and salary are managed by HR and are read-only here.
              </p>

              <EditField
                icon={<Calendar size={14} strokeWidth={1.5} />}
                label="Date of Birth"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
              <EditField
                icon={<Briefcase size={14} strokeWidth={1.5} />}
                label="Prior Experience (Years)"
                type="number"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
              />

              <EditField
                icon={<CreditCard size={14} strokeWidth={1.5} />}
                label="Aadhar Card"
                value={aadharcard}
                onChange={(e) => setAadharcard(e.target.value)}
                placeholder="Aadhar number"
              />
              <EditField
                icon={<CreditCard size={14} strokeWidth={1.5} />}
                label="PAN Card"
                value={pancard}
                onChange={(e) => setPancard(e.target.value)}
                placeholder="PAN number"
              />
              <EditField
                icon={<PiggyBank size={14} strokeWidth={1.5} />}
                label="PF Number"
                value={pfNumber}
                onChange={(e) => setPfNumber(e.target.value)}
                placeholder="PF number"
              />

              <EditSelect
                icon={<Heart size={14} strokeWidth={1.5} />}
                label="Marital Status"
                value={maritalStatus}
                onChange={(e) => setMaritalStatus(e.target.value)}
                options={[
                  { label: "Single", value: "Single" },
                  { label: "Married", value: "Married" },
                  { label: "Divorced", value: "Divorced" },
                ]}
              />
              <EditSelect
                icon={<Droplets size={14} strokeWidth={1.5} />}
                label="Blood Group"
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => ({ label: g, value: g }))}
              />
            </div>
          </div>

          {/* ============ ACTIONS ============ */}
          {saveError && (
            <div
              role="alert"
              className="mt-6 rounded-2xl border px-5 py-3 text-[12px] font-medium"
              style={{ borderColor: `${GARNET}40`, backgroundColor: `${GARNET}0A`, color: GARNET }}
            >
              {saveError}
            </div>
          )}
          <button
            type="submit"
            disabled={saving}
            className="mt-6 w-full cursor-pointer rounded-full py-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: INK }}
            onMouseEnter={(e) => !saving && (e.currentTarget.style.backgroundColor = GARNET)}
            onMouseLeave={(e) => !saving && (e.currentTarget.style.backgroundColor = INK)}
          >
            {saving ? "Synchronizing…" : "Save Changes"}
          </button>
        </form>

        <p className="mt-6 text-center text-[9px] font-semibold uppercase tracking-[0.28em]" style={{ color: "#8A8378" }}>
          Verified &nbsp;·&nbsp; Active &nbsp;·&nbsp; On-Site
        </p>
      </div>
    </div>
  );
};

/* ===== SUPPORTING COMPONENTS ===== */

const GoldRule = () => (
  <div className="px-8 sm:px-14">
    <div className="h-px" style={{ backgroundColor: `${GOLD}45` }} />
  </div>
);

const StaticField = ({ icon, label, value }) => (
  <div>
    <div className="flex items-center gap-2" style={{ color: GOLD }}>
      {icon}
      <span className="text-[9px] font-semibold uppercase tracking-[0.2em]" style={{ color: "#8A8378" }}>{label}</span>
    </div>
    <p className="mt-1.5 truncate border-b pb-2 text-base tracking-tight" style={{ ...displayFont, fontWeight: 700, borderColor: HAIRLINE, color: "#8A8378" }}>
      {value || "—"}
    </p>
  </div>
);

const EditField = ({ icon, label, ...props }) => (
  <div>
    <div className="flex items-center gap-2" style={{ color: GOLD }}>
      {icon}
      <span className="text-[9px] font-semibold uppercase tracking-[0.2em]" style={{ color: "#8A8378" }}>{label}</span>
    </div>
    <input
      {...props}
      className="mt-1.5 w-full border-b bg-transparent pb-2 text-base tracking-tight outline-none transition-colors"
      style={{ ...displayFont, fontWeight: 700, borderColor: HAIRLINE, color: INK }}
      onFocus={(e) => (e.target.style.borderColor = GOLD)}
      onBlur={(e) => (e.target.style.borderColor = HAIRLINE)}
    />
  </div>
);

const EditSelect = ({ icon, label, options, ...props }) => (
  <div>
    <div className="flex items-center gap-2" style={{ color: GOLD }}>
      {icon}
      <span className="text-[9px] font-semibold uppercase tracking-[0.2em]" style={{ color: "#8A8378" }}>{label}</span>
    </div>
    <select
      {...props}
      className="mt-1.5 w-full cursor-pointer border-b bg-transparent pb-2 text-base tracking-tight outline-none transition-colors"
      style={{ ...displayFont, fontWeight: 700, borderColor: HAIRLINE, color: INK }}
      onFocus={(e) => (e.target.style.borderColor = GOLD)}
      onBlur={(e) => (e.target.style.borderColor = HAIRLINE)}
    >
      <option value="">Select</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

const LoadingPulse = () => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-br from-[#FBF8F3] via-white to-[#F3EDE0]">
    <div className="h-9 w-9 animate-spin rounded-full border-2 border-[#E7DFD2] border-t-[#7A2233]"></div>
    <p className="text-[9px] font-semibold uppercase tracking-[0.32em]" style={{ color: "#8A8378", ...bodyFont }}>Opening Record</p>
  </div>
);

export default EditEmployeeProfile;
