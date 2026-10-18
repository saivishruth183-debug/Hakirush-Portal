import axios from "axios";
import React, { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, CheckCircle2, XCircle, Loader2, CalendarClock, Wallet, Mail, Briefcase, Hash,
  Building2, Quote, AlertTriangle, X, CalendarDays, ArrowRight, Clock3, SearchX, Info, ShieldCheck,
} from "lucide-react";

const PAGE_BG =
  "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const CARD =
  "rounded-3xl bg-white/90 ring-1 ring-white/70 shadow-[0_10px_40px_-12px_rgba(127,29,29,0.18)] backdrop-blur";

const STATUS = {
  approved: { label: "Approved", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", Icon: CheckCircle2 },
  rejected: { label: "Rejected", chip: "bg-red-50 text-red-700 ring-red-200", Icon: XCircle },
  pending: { label: "Pending", chip: "bg-amber-50 text-amber-700 ring-amber-200", Icon: Clock3 },
};

const AVATAR_BG = ["from-red-500 to-rose-400", "from-violet-500 to-fuchsia-400", "from-sky-500 to-cyan-400", "from-amber-500 to-orange-400", "from-emerald-500 to-teal-400"];
const colorFor = (s = "") => AVATAR_BG[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_BG.length];
const initialsOf = (name = "") => String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
const longDate = (d) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/* ================= MODAL SHELL ================= */
const Modal = ({ children, onClose, dismissable = true }) => {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && dismissable && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, dismissable]);
  return createPortal(
    <motion.div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" onClick={() => dismissable && onClose?.()} />
      <motion.div role="dialog" aria-modal="true"
        initial={{ y: 40, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 30, opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-gray-100">
        {children}
      </motion.div>
    </motion.div>,
    document.body
  );
};

/* ================= STATUS ALERT (after success) ================= */
const StatusAlert = ({ type, onClose }) => {
  const isApproved = type === "approved";
  return (
    <Modal dismissable={false}>
      <div className={`h-1.5 ${isApproved ? "bg-gradient-to-r from-emerald-500 to-teal-400" : "bg-gradient-to-r from-red-600 to-rose-400"}`} />
      <div className="p-7 text-center">
        <motion.div initial={{ scale: 0.4, rotate: -15 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}
          className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ring-1 ${isApproved ? "bg-emerald-50 text-emerald-600 ring-emerald-100" : "bg-red-50 text-red-600 ring-red-100"}`}>
          {isApproved ? <CheckCircle2 size={32} /> : <XCircle size={32} />}
        </motion.div>
        <h3 className="text-xl font-extrabold tracking-tight text-gray-900">{isApproved ? "Leave approved" : "Leave rejected"}</h3>
        <p className="mt-2 text-sm text-gray-500">
          {isApproved
            ? "The employee's leave balance has been updated successfully."
            : "The leave request has been marked as rejected."}
        </p>
        <button
          onClick={onClose}
          className={`mt-6 w-full rounded-2xl py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98] ${
            isApproved ? "bg-gradient-to-r from-emerald-600 to-teal-500 shadow-emerald-600/30" : "bg-gradient-to-r from-red-600 to-rose-500 shadow-red-600/30"
          }`}
        >
          Back to leave list
        </button>
      </div>
    </Modal>
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
  // UI-only
  const [confirm, setConfirm] = useState(null); // "Approved" | "Rejected"
  const [errorMsg, setErrorMsg] = useState("");
  const [imgFailed, setImgFailed] = useState(false);
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
        setConfirm(null);
        setAlertType(status.toLowerCase());
      }
    } catch (error) {
      setConfirm(null);
      setErrorMsg(error?.response?.data?.error || "Failed to update status");
    } finally {
      setActionLoading(false);
    }
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return "/default-avatar.png";
    if (imagePath.startsWith("http")) return imagePath;
    return `${import.meta.env.VITE_BACKEND_URL}/${imagePath.replace(/^\/+/, "")}`;
  };

  if (loading) return <LoadingSkeleton />;

  if (!leave) return (
    <div className={`flex min-h-screen items-center justify-center p-6 ${PAGE_BG}`}>
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className={`${CARD} w-full max-w-sm p-8 text-center`}>
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 ring-1 ring-gray-100"><SearchX size={28} /></div>
        <h2 className="text-xl font-extrabold tracking-tight text-gray-900">Leave request not found.</h2>
        <p className="mt-2 text-sm text-gray-500">It may have been removed, or the link is wrong.</p>
        <button onClick={() => navigate("/admin-dashboard/leaves")}
          className="mt-6 w-full rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 hover:brightness-110">
          Back to leave list
        </button>
      </motion.div>
    </div>
  );

  const status = (leave?.status || "").toLowerCase();
  const isPending = status === "pending";
  const netDays = calculateNetDays(leave.startDate, leave.endDate, holidays);
  const st = STATUS[status] || STATUS.pending;

  /* ---------- UI-only derived values ---------- */
  const emp = leave?.employeeId;
  const name = emp?.userId?.name || "Employee";
  const photo = emp?.userId?.profileImage;
  const holidayMap = Object.fromEntries((holidays || []).map((h) => [toLocalYMD(h.date), h.name || h.title || "Holiday"]));
  const dayStrip = (() => {
    const out = [];
    const s = new Date(leave.startDate), e = new Date(leave.endDate);
    let cur = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const last = new Date(e.getFullYear(), e.getMonth(), e.getDate());
    while (cur <= last && out.length < 62) {
      const ymd = toLocalYMD(cur);
      const dow = cur.getDay();
      out.push({ date: new Date(cur), weekend: dow === 0 || dow === 6, holiday: holidayMap[ymd] });
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  })();
  const calDays = dayStrip.length;
  const typeKey = String(leave.leaveType || "").toLowerCase();
  const balanceKey = typeKey.includes("sick") ? "sick" : typeKey.includes("casual") ? "casual" : null;
  const affected = balance && balanceKey ? balance[balanceKey] : null;
  const afterApproval = affected ? Number(affected.balance) - netDays : null;
  const startsIn = (() => {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const s = new Date(leave.startDate); s.setHours(0, 0, 0, 0);
    const d = Math.round((s - t) / 86400000);
    if (d === 0) return "Starts today";
    if (d > 0) return d === 1 ? "Starts tomorrow" : `Starts in ${d} days`;
    const e = new Date(leave.endDate); e.setHours(0, 0, 0, 0);
    return e >= t ? "In progress" : `Ended ${Math.round((t - e) / 86400000)} days ago`;
  })();

  return (
    <>
      <AnimatePresence>
        {alertType && (
          <StatusAlert key="done" type={alertType} onClose={() => navigate("/admin-dashboard/leaves")} />
        )}
        {confirm && (
          <ConfirmModal
            key="confirm"
            decision={confirm}
            name={name}
            leave={leave}
            netDays={netDays}
            balanceKey={balanceKey}
            affected={affected}
            afterApproval={afterApproval}
            busy={actionLoading}
            onCancel={() => !actionLoading && setConfirm(null)}
            onConfirm={() => changeStatus(leave._id, confirm)}
          />
        )}
        {errorMsg && (
          <Modal key="err" onClose={() => setErrorMsg("")}>
            <div className="h-1.5 bg-gradient-to-r from-red-600 to-rose-400" />
            <div className="p-7 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100"><AlertTriangle size={28} /></div>
              <h3 className="text-xl font-extrabold tracking-tight text-gray-900">Couldn't update leave</h3>
              <p className="mt-2 text-sm text-gray-500">{errorMsg}</p>
              <button onClick={() => setErrorMsg("")}
                className="mt-6 w-full rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 hover:brightness-110">
                Got it
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      <div className={`min-h-screen ${PAGE_BG} p-4 pb-32 sm:p-6 lg:p-8 ${isPending ? "lg:pb-32" : "lg:pb-12"}`}>
        <div className="mx-auto max-w-5xl">

          {/* TOP NAV */}
          <button
            onClick={() => navigate("/admin-dashboard/leaves")}
            className="group mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-gray-500 ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200"
          >
            <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" /> Back to leave list
          </button>

          {/* HERO */}
          <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className={`${CARD} overflow-hidden`}>
            <div className="relative h-28 bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 sm:h-32">
              <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/15 blur-2xl" />
              <div className="absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-orange-300/25 blur-2xl" />
              <span className={`absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold shadow ${status === "approved" ? "text-emerald-700" : status === "rejected" ? "text-red-700" : "text-amber-700"}`}>
                <st.Icon size={13} /> {leave?.status}
              </span>
            </div>
            <div className="px-5 pb-6 sm:px-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:gap-5">
                  <div className="relative z-10 -mt-12 h-24 w-24 shrink-0 overflow-hidden rounded-3xl bg-white shadow-xl ring-4 ring-white sm:-mt-14 sm:h-28 sm:w-28">
                    {photo && !imgFailed ? (
                      <img src={getImageUrl(photo)} alt="profile" className="h-full w-full object-cover" onError={() => setImgFailed(true)} />
                    ) : (
                      <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${colorFor(name)} text-3xl font-extrabold text-white`}>{initialsOf(name)}</div>
                    )}
                  </div>
                  <div className="min-w-0 sm:pt-4">
                    <h1 className="break-words text-2xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-3xl">{name}</h1>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-2.5 py-1 font-mono text-xs font-semibold text-white"><Hash size={11} />{emp?.employeeId}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-100"><Building2 size={11} />{emp?.department?.dep_name || "Staff"}</span>
                      {emp?.designation && <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600"><Briefcase size={11} />{emp.designation}</span>}
                    </div>
                  </div>
                </div>
                {emp?.userId?.email && (
                  <a href={`mailto:${emp.userId.email}`}
                    className="inline-flex shrink-0 items-center gap-2 self-start rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-gray-700 ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200 lg:mt-4">
                    <Mail size={15} /> Email
                  </a>
                )}
              </div>
            </div>
          </motion.section>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
            {/* LEFT: request */}
            <div className="space-y-6 lg:col-span-3">
              <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className={`${CARD} p-5 sm:p-6`}>
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600"><CalendarClock size={16} /></div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">Leave request</h2>
                    <p className="text-xs text-gray-500">{startsIn}</p>
                  </div>
                  <span className="ml-auto rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700 ring-1 ring-violet-100">{leave?.leaveType || "—"}</span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                  <DateTile label="From" date={leave.startDate} />
                  <ArrowRight className="mx-auto hidden text-gray-300 sm:block" size={18} />
                  <DateTile label="To" date={leave.endDate} />
                </div>

                <div className="mt-4 flex items-center justify-between rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 p-4 text-white shadow-lg shadow-red-600/25">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">Counted as</p>
                    <p className="text-3xl font-extrabold leading-none tabular-nums">{netDays} <span className="text-base font-bold">work day{netDays === 1 ? "" : "s"}</span></p>
                  </div>
                  <p className="max-w-[10rem] text-right text-[11px] leading-snug text-white/80">
                    {calDays} calendar day{calDays === 1 ? "" : "s"} · excludes weekends &amp; holidays
                  </p>
                </div>

                {/* day strip */}
                {dayStrip.length > 0 && (
                  <div className="mt-4">
                    <div className="flex flex-wrap gap-1.5">
                      {dayStrip.map((d) => {
                        const counted = !d.weekend && !d.holiday;
                        return (
                          <div key={d.date.toISOString()} title={d.holiday ? `Holiday: ${d.holiday}` : d.weekend ? "Weekend — not counted" : "Counted"}
                            className={`flex w-11 flex-col items-center rounded-xl py-1.5 text-center leading-none ring-1 ${
                              counted ? "bg-red-50 text-red-700 ring-red-100" : d.holiday ? "bg-amber-50 text-amber-700 ring-amber-100" : "bg-gray-50 text-gray-300 ring-gray-100"
                            }`}>
                            <span className="text-[9px] font-bold uppercase">{d.date.toLocaleDateString("en-IN", { weekday: "short" }).slice(0, 2)}</span>
                            <span className={`mt-0.5 text-sm font-extrabold ${counted ? "" : "line-through decoration-1"}`}>{d.date.getDate()}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-gray-500">
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-200" /> Counted</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gray-200" /> Weekend</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-200" /> Holiday</span>
                    </div>
                  </div>
                )}
              </motion.section>

              <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`${CARD} p-5 sm:p-6`}>
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400"><Quote size={12} /> Reason</p>
                <p className="text-base leading-relaxed text-gray-800">
                  {leave?.reason ? <>“{leave.reason}”</> : <span className="text-gray-400">No description provided.</span>}
                </p>
              </motion.section>
            </div>

            {/* RIGHT: balance */}
            <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className={`${CARD} p-5 sm:p-6 lg:col-span-2`}>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600"><Wallet size={16} /></div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Leave balance</h2>
                  <p className="text-xs text-gray-500">This year</p>
                </div>
              </div>
              {balanceLoading ? (
                <div className="space-y-3">
                  {[0, 1].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100" />)}
                </div>
              ) : balance ? (
                <div className="space-y-3">
                  <BalanceCard
                    label="Casual leave"
                    total={balance.casual.total}
                    used={balance.casual.used}
                    remaining={balance.casual.balance}
                    tone="emerald"
                    impact={isPending && balanceKey === "casual" ? netDays : 0}
                  />
                  <BalanceCard
                    label="Sick leave"
                    total={balance.sick.total}
                    used={balance.sick.used}
                    remaining={balance.sick.balance}
                    tone="rose"
                    impact={isPending && balanceKey === "sick" ? netDays : 0}
                  />
                  {isPending && affected && (
                    <p className={`flex items-start gap-1.5 rounded-2xl p-3 text-xs ring-1 ${afterApproval < 0 ? "bg-red-50 text-red-700 ring-red-100" : "bg-gray-50 text-gray-600 ring-gray-100"}`}>
                      {afterApproval < 0 ? <AlertTriangle size={14} className="mt-px shrink-0" /> : <Info size={14} className="mt-px shrink-0" />}
                      <span>
                        If approved, {balanceKey} leave goes from <b>{affected.balance}</b> to <b>{afterApproval}</b> day{Math.abs(afterApproval) === 1 ? "" : "s"}.
                        {afterApproval < 0 && " This is more than they have left."}
                      </span>
                    </p>
                  )}
                </div>
              ) : (
                <p className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-400 ring-1 ring-gray-100">Balance unavailable.</p>
              )}
            </motion.section>
          </div>

          {!isPending && (
            <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-gray-400">
              <ShieldCheck size={13} /> This request has already been {status}.
            </p>
          )}
        </div>
      </div>

      {/* STICKY ACTIONS */}
      {isPending && (
        <div className="fixed inset-x-0 bottom-0 z-30 p-3 sm:p-4">
          <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
            className={`${CARD} mx-auto flex max-w-5xl flex-col gap-2 p-3 sm:flex-row sm:items-center`}>
            <p className="hidden flex-1 px-2 text-sm text-gray-500 sm:block">
              <b className="text-gray-900">{name}</b> wants <b className="text-gray-900">{netDays}</b> day{netDays === 1 ? "" : "s"} of {leave?.leaveType?.toLowerCase() || "leave"}.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setConfirm("Rejected")}
                disabled={actionLoading}
                className="flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-red-600 ring-1 ring-red-200 transition hover:bg-red-50 active:scale-[0.98] disabled:opacity-50"
              >
                <XCircle size={17} /> Reject
              </button>
              <button
                onClick={() => setConfirm("Approved")}
                disabled={actionLoading}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              >
                <CheckCircle2 size={17} /> Approve
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

/* ================= CONFIRM MODAL ================= */
const ConfirmModal = ({ decision, name, leave, netDays, balanceKey, affected, afterApproval, busy, onCancel, onConfirm }) => {
  const approve = decision === "Approved";
  return (
    <Modal onClose={onCancel} dismissable={!busy}>
      <div className={`h-1.5 ${approve ? "bg-gradient-to-r from-emerald-500 to-teal-400" : "bg-gradient-to-r from-red-600 to-rose-400"}`} />
      <button onClick={onCancel} disabled={busy} aria-label="Close"
        className="absolute right-4 top-5 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-40"><X size={17} /></button>
      <div className="p-6 sm:p-7">
        <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ring-1 ${approve ? "bg-emerald-50 text-emerald-600 ring-emerald-100" : "bg-red-50 text-red-600 ring-red-100"}`}>
          {approve ? <CheckCircle2 size={28} /> : <XCircle size={28} />}
        </div>
        <h3 className="text-xl font-extrabold tracking-tight text-gray-900">{approve ? "Approve" : "Reject"} this leave?</h3>
        <p className="mt-1 text-sm text-gray-500">{name} · {leave?.leaveType}</p>

        <div className="mt-4 space-y-2 rounded-2xl bg-gray-50 p-4 ring-1 ring-gray-100">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
            <CalendarDays size={14} className="text-gray-400" />
            {new Date(leave.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            <ArrowRight size={12} className="text-gray-300" />
            {new Date(leave.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-bold text-gray-700 ring-1 ring-gray-200">{netDays} day{netDays === 1 ? "" : "s"}</span>
          </p>
          {approve && affected && (
            <p className={`text-xs ${afterApproval < 0 ? "font-semibold text-red-600" : "text-gray-500"}`}>
              {balanceKey === "sick" ? "Sick" : "Casual"} balance: {affected.balance} → {afterApproval} day{Math.abs(afterApproval) === 1 ? "" : "s"}
              {afterApproval < 0 && " (over their allowance)"}
            </p>
          )}
          {!approve && <p className="text-xs text-gray-500">Their balance won't change.</p>}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button onClick={onCancel} disabled={busy}
            className="rounded-2xl bg-gray-100 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-200 disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={busy}
            className={`flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60 ${
              approve ? "bg-gradient-to-r from-emerald-600 to-teal-500 shadow-emerald-600/30" : "bg-gradient-to-r from-red-600 to-rose-500 shadow-red-600/30"
            }`}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : approve ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {busy ? "Saving…" : approve ? "Approve" : "Reject"}
          </button>
        </div>
      </div>
    </Modal>
  );
};

/* ================= PIECES ================= */
const DateTile = ({ label, date }) => {
  const d = new Date(date);
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-100">
      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-white leading-none shadow-sm ring-1 ring-gray-100">
        <span className="text-[9px] font-bold uppercase text-red-500">{d.toLocaleDateString("en-IN", { month: "short" })}</span>
        <span className="text-lg font-extrabold text-gray-900">{d.getDate()}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
        <p className="truncate text-sm font-bold text-gray-900">{longDate(date)}</p>
        <p className="text-xs text-gray-400">{d.toLocaleDateString("en-IN", { weekday: "long" })}</p>
      </div>
    </div>
  );
};

const BalanceCard = ({ label, total, used, remaining, tone, impact = 0 }) => {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const impactPct = total > 0 ? Math.min(100 - pct, Math.round((impact / total) * 100)) : 0;
  const t = tone === "emerald"
    ? { bg: "bg-emerald-50/70 ring-emerald-100", text: "text-emerald-700", bar: "bg-emerald-500" }
    : { bg: "bg-rose-50/70 ring-rose-100", text: "text-rose-700", bar: "bg-rose-500" };
  return (
    <div className={`rounded-2xl p-4 ring-1 ${t.bg} ${impact ? "ring-2" : ""}`}>
      <div className="flex items-center justify-between">
        <p className={`text-sm font-bold ${t.text}`}>{label}</p>
        <p className="text-sm text-gray-500"><b className="text-lg font-extrabold text-gray-900 tabular-nums">{remaining}</b> / {total} left</p>
      </div>
      <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-white">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }} className={`h-full ${t.bar}`} />
        {impact > 0 && (
          <motion.div initial={{ width: 0 }} animate={{ width: `${impactPct}%` }} transition={{ duration: 0.8, delay: 0.3 }}
            className={`h-full ${t.bar} opacity-40 [background-image:repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(255,255,255,.6)_3px,rgba(255,255,255,.6)_6px)]`} />
        )}
      </div>
      <p className="mt-2 text-xs text-gray-500">
        {used} used this year{impact > 0 && <span className="font-semibold text-gray-700"> · +{impact} if approved</span>}
      </p>
    </div>
  );
};

const LoadingSkeleton = () => (
  <div className={`min-h-screen ${PAGE_BG} p-4 sm:p-6 lg:p-8`}>
    <div className="mx-auto max-w-5xl animate-pulse">
      <div className="mb-4 h-7 w-36 rounded-full bg-white/80" />
      <div className={`${CARD} overflow-hidden`}>
        <div className="h-28 bg-red-200/60 sm:h-32" />
        <div className="flex items-start gap-5 px-5 pb-6 sm:px-8">
          <div className="-mt-12 h-24 w-24 rounded-3xl bg-gray-200 ring-4 ring-white sm:h-28 sm:w-28" />
          <div className="space-y-2 pt-4"><div className="h-6 w-48 rounded bg-gray-200" /><div className="h-4 w-32 rounded bg-gray-100" /></div>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className={`${CARD} h-80 lg:col-span-3`} />
        <div className={`${CARD} h-80 lg:col-span-2`} />
      </div>
    </div>
  </div>
);

export default LeaveDetails;