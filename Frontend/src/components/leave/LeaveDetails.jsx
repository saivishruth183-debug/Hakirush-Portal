import axios from "axios";
import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle, XCircle, Loader2, CalendarClock, Wallet } from "lucide-react";

const INK = "#1C1A17";
const GARNET = "#7A2233";
const GOLD = "#B8912E";
const SAGE = "#3F6B52";
const RUST = "#A24A32";

/* ================= PREMIUM STATUS ALERT ================= */
const StatusAlert = ({ type, onClose }) => {
  const isApproved = type === "approved";

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" />
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#E7E1D3] p-8 animate-pop">
          <div className="flex flex-col items-center text-center">
            <div className={`p-4 rounded-full ${isApproved ? "bg-[#EEF3EE]" : "bg-[#FAF1EA]"}`}>
              {isApproved
                ? <CheckCircle size={48} style={{ color: SAGE }} />
                : <XCircle size={48} style={{ color: RUST }} />
              }
            </div>

            <h3 className="text-3xl font-black uppercase tracking-tighter mt-6"
              style={{ color: isApproved ? SAGE : RUST }}
            >
              {isApproved ? "Leave Approved" : "Leave Rejected"}
            </h3>

            <p className="text-[#8A8478] mt-2 font-medium max-w-sm">
              {isApproved
                ? "The employee's leave balance has been updated successfully."
                : "The leave request has been marked as rejected."}
            </p>

            <button
              onClick={onClose}
              className="w-full mt-8 py-4 rounded-2xl text-[#F6F3EC] font-black uppercase tracking-widest shadow-md transition active:scale-95 hover:opacity-90"
              style={{ backgroundColor: isApproved ? SAGE : RUST }}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

/* ================= MAIN COMPONENT ================= */
const LeaveDetails = () => {
  const { id } = useParams();
  const [leave, setLeave] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [balance, setBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [alertType, setAlertType] = useState(null);
  const navigate = useNavigate();

  // Memoized fetch to prevent unnecessary re-renders
  const fetchDetails = useCallback(async () => {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };

      const [leaveRes, holidayRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/leave/detail/${id}`, { headers }),
        axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/holiday/all`, { headers })
      ]);

      if (leaveRes.data?.success) setLeave(leaveRes.data.leave);
      if (holidayRes.data?.success) setHolidays(holidayRes.data.holidays);
    } catch (error) {
      console.error("Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchDetails(); }, [fetchDetails]);

  // Fetch the employee's leave balance once we know which employee this request belongs to
  const fetchBalance = useCallback(async (employeeId) => {
    if (!employeeId) return;
    try {
      setBalanceLoading(true);
      const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };
      const res = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/api/leave/balance/${employeeId}`,
        { headers }
      );
      if (res.data?.success) setBalance(res.data);
    } catch (error) {
      console.error("Balance Fetch Error:", error);
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  useEffect(() => {
    const employeeId = leave?.employeeId?._id;
    if (employeeId) fetchBalance(employeeId);
  }, [leave, fetchBalance]);

  /* --- NET DAYS CALCULATION (Excluding Sat, Sun & Holidays) --- */
  const toLocalYMD = (dateInput) => {
    const d = new Date(dateInput);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const calculateNetDays = useCallback((start, end, holidayList) => {
    if (!start || !end) return 0;
    let count = 0;
    const s = new Date(start);
    const e = new Date(end);
    let current = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const last = new Date(e.getFullYear(), e.getMonth(), e.getDate());
    const holidayStrings = holidayList.map(h => toLocalYMD(h.date));
    while (current <= last) {
      const dateStr = toLocalYMD(current);
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayStrings.includes(dateStr)) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    return count;
  }, []);

  const changeStatus = async (leaveId, status) => {
    try {
      setActionLoading(true);
      const response = await axios.put(
        `${import.meta.env.VITE_BACKEND_URL}/api/leave/${leaveId}`,
        { status },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );

      if (response.data?.success) {
        setLeave(response.data.leave);
        setAlertType(status.toLowerCase());
      } else {
        throw new Error(response.data?.message || "Failed to update status");
      }
    } catch (error) {
      alert(error?.response?.data?.error || "Failed to update status");
    } finally {
      setActionLoading(false);
    }
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return "/default-avatar.png";
    if (imagePath.startsWith("http")) return imagePath;
    return `${import.meta.env.VITE_BACKEND_URL}/${imagePath.replace(/^\/+/, "")}`;
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-[#B8912E] gap-4 bg-[#F6F3EC]">
      <Loader2 size={48} className="animate-spin" />
      <p className="font-black uppercase tracking-widest text-sm text-[#1C1A17]">Syncing Details...</p>
    </div>
  );

  if (!leave) return (
    <div className="min-h-screen flex items-center justify-center text-[#8A8478] font-bold bg-[#F6F3EC]">
      Leave request not found.
    </div>
  );

  const status = (leave?.status || "").toLowerCase();
  const isPending = status === "pending";
  const netDays = calculateNetDays(leave.startDate, leave.endDate, holidays);

  const statusStyle =
    status === "approved"
      ? "bg-[#EEF3EE] text-[#3F6B52] border-[#D7E4D9]"
      : status === "rejected"
      ? "bg-[#FAF1EA] text-[#A24A32] border-[#EAD9CC]"
      : "bg-[#FBF3E3] text-[#9C7A22] border-[#EFE1BF]";

  return (
    <>
      {alertType && (
        <StatusAlert
          type={alertType}
          onClose={() => navigate("/admin-dashboard/leaves")}
        />
      )}

      <div className="min-h-screen bg-[#F6F3EC] p-4 md:p-8">
        <div className="max-w-4xl mx-auto">

          {/* TOP NAV */}
          <button
            onClick={() => navigate("/admin-dashboard/leaves")}
            className="flex items-center gap-2 text-[#8A8478] hover:text-[#B8912E] mb-6 group cursor-pointer transition-colors"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            <span className="font-bold text-xs uppercase tracking-widest">Back to List</span>
          </button>

          <div className="bg-white rounded-[2.5rem] shadow-sm p-6 md:p-10 border border-[#E7E1D3] relative overflow-hidden">

            {/* Header Section */}
            <div className="flex flex-col md:flex-row items-center gap-6 pb-8 border-b border-[#F1EFE8]">
              <div className="w-32 h-32 rounded-3xl border-4 border-white shadow-md overflow-hidden ring-1 ring-[#E7E1D3]">
                <img
                  src={getImageUrl(leave?.employeeId?.userId?.profileImage)}
                  alt="profile"
                  className="w-full h-full object-cover"
                  onError={(e) => (e.target.src = "/default-avatar.png")}
                />
              </div>

              <div className="flex-1 text-center md:text-left">
                <h2 className="text-4xl font-black text-[#1C1A17] tracking-tighter">
                  {leave?.employeeId?.userId?.name || "Employee"}
                </h2>
                <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-3">
                  <span className="px-4 py-1.5 rounded-full bg-[#1C1A17] text-[#F6F3EC] text-[10px] font-black uppercase tracking-widest">
                    ID: {leave?.employeeId?.employeeId}
                  </span>
                  <span className="px-4 py-1.5 rounded-full bg-[#FBF3E3] text-[#9C7A22] text-[10px] font-black uppercase tracking-widest border border-[#EFE1BF]">
                    {leave?.employeeId?.department?.dep_name || "Staff"}
                  </span>
                </div>
              </div>

              <div className={`px-6 py-2 rounded-full border font-black uppercase tracking-widest text-xs ${statusStyle}`}>
                {leave?.status}
              </div>
            </div>

            {/* Leave Balance Section */}
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-3">
                <Wallet size={16} className="text-[#B8912E]" />
                <p className="text-[10px] uppercase tracking-widest text-[#8A8478] font-black">
                  Leave Balance
                </p>
              </div>

              {balanceLoading ? (
                <div className="flex items-center gap-2 text-[#8A8478] text-xs font-bold uppercase tracking-widest py-4">
                  <Loader2 size={16} className="animate-spin" />
                  Loading balance...
                </div>
              ) : balance ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <BalanceCard
                    label="Casual Leave"
                    total={balance.casual.total}
                    used={balance.casual.used}
                    remaining={balance.casual.balance}
                    color={SAGE}
                    bg="#EEF3EE"
                  />
                  <BalanceCard
                    label="Sick Leave"
                    total={balance.sick.total}
                    used={balance.sick.used}
                    remaining={balance.sick.balance}
                    color={GARNET}
                    bg="#FAEDEF"
                  />
                </div>
              ) : (
                <p className="text-[#8A8478] text-xs font-bold uppercase tracking-widest py-4">
                  Balance unavailable.
                </p>
              )}
            </div>

            {/* Details Grid */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Info label="Email Address" value={leave?.employeeId?.userId?.email} />
              <Info label="Leave Type" value={leave?.leaveType} highlight />
              <Info
                label="Duration"
                value={`${netDays} Work Days`}
                subValue="Excludes weekends & holidays"
                icon={<CalendarClock size={16}/>}
                accent
              />
              <Info label="From Date" value={new Date(leave.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric'})} />
              <Info label="To Date" value={new Date(leave.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric'})} />
              <Info label="Designation" value={leave?.employeeId?.designation} />

              <div className="sm:col-span-2 lg:col-span-3">
                <div className="bg-[#FBFAF6] rounded-2xl p-6 border border-[#E7E1D3]">
                  <p className="text-[10px] uppercase tracking-widest text-[#8A8478] font-black mb-2">Reason</p>
                  <p className="text-[#1C1A17] font-medium leading-relaxed">
                    "{leave?.reason || "No description provided."}"
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            {isPending && (
              <div className="mt-10 pt-8 border-t border-[#F1EFE8]">
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => changeStatus(leave._id, "Approved")}
                    disabled={actionLoading}
                    className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-[#F6F3EC] font-black uppercase tracking-widest shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50 hover:opacity-90"
                    style={{ backgroundColor: SAGE }}
                  >
                    {actionLoading ? <Loader2 className="animate-spin" size={20}/> : <CheckCircle size={20}/>}
                    Approve Request
                  </button>
                  <button
                    onClick={() => changeStatus(leave._id, "Rejected")}
                    disabled={actionLoading}
                    className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-[#F6F3EC] font-black uppercase tracking-widest shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50 hover:opacity-90"
                    style={{ backgroundColor: RUST }}
                  >
                     {actionLoading ? <Loader2 className="animate-spin" size={20}/> : <XCircle size={20}/>}
                    Reject Request
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

const Info = ({ label, value, subValue, highlight, accent, icon }) => (
  <div className={`rounded-2xl p-5 border transition-all ${
    accent ? "bg-[#FBF3E3]/60 border-[#EFE1BF]" : "bg-white border-[#E7E1D3]"
  }`}>
    <div className={`flex items-center gap-2 text-[10px] uppercase tracking-widest font-black ${accent ? "text-[#B8912E]" : "text-[#8A8478]"}`}>
        {icon}
        {label}
    </div>
    <p className={`text-lg font-bold mt-1.5 tracking-tight ${
      highlight ? "text-[#B8912E]" : accent ? "text-[#9C7A22]" : "text-[#1C1A17]"
    }`}>
      {value ?? "—"}
    </p>
    {subValue && <p className="text-[10px] font-bold text-[#B8912E] uppercase mt-0.5">{subValue}</p>}
  </div>
);

const BalanceCard = ({ label, total, used, remaining, color, bg }) => {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

  return (
    <div className="rounded-2xl p-5 border border-[#E7E1D3]" style={{ backgroundColor: bg }}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-widest font-black" style={{ color }}>
          {label}
        </p>
        <p className="text-xs font-black" style={{ color }}>
          {remaining} / {total} left
        </p>
      </div>

      <div className="mt-3 h-2 w-full rounded-full bg-white/70 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>

      <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-[#8A8478]">
        {used} used this year
      </p>
    </div>
  );
};

export default LeaveDetails;
