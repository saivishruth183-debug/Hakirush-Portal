import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, CheckCircle, Plus, Calendar, DollarSign, Award, XCircle, Trash2, X, Loader2, Palmtree,
  Banknote, Timer, TrendingUp, Clock3, CheckCircle2, AlertTriangle, Minus, Info, Inbox, Sparkles,
} from "lucide-react";
import { apiErrorMessage, authHeaders } from "../../utils/apiError";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "";

const PAGE_BG =
  "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const CARD =
  "rounded-3xl bg-white/90 ring-1 ring-white/70 shadow-[0_10px_40px_-12px_rgba(127,29,29,0.18)] backdrop-blur";
const DAY_HOURS = 8;

const STATUS = {
  Approved: { chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", strip: "bg-emerald-500", Icon: CheckCircle2 },
  Rejected: { chip: "bg-red-50 text-red-700 ring-red-200", strip: "bg-red-500", Icon: XCircle },
  Pending: { chip: "bg-amber-50 text-amber-700 ring-amber-200", strip: "bg-amber-400", Icon: Clock3 },
};
const statusFor = (s) => STATUS[s] || STATUS.Pending;
const num = (v) => Math.round((Number(v) || 0) * 10) / 10;
const fmtDay = (d) => {
  const x = new Date(d);
  return isNaN(x) ? String(d || "—") : x.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
};

/* ---------- modal shell ---------- */
const Modal = ({ children, onClose, dismissable = true, size = "max-w-md" }) => {
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
        className={`relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-gray-100 ${size}`}>
        {children}
      </motion.div>
    </motion.div>,
    document.body
  );
};

const EmployeeOvertime = () => {
  const [data, setData] = useState({
    totalEarnedHours: 0,
    claimedHours: 0,
    availableHours: 0,
    recentOvertimeDays: [],
    requests: [],
  });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    type: "Comp-Off",
    hours: "8",
    reason: "",
  });

  // UI-only
  const [withdrawTarget, setWithdrawTarget] = useState(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [reqFilter, setReqFilter] = useState("All");

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${BACKEND}/api/overtime/summary/me`, {
        headers: authHeaders(),
      });
      if (res.data.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error("Failed to load overtime data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 3500);
    return () => clearTimeout(t);
  }, [msg]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");
    setSubmitting(true);

    try {
      const res = await axios.post(`${BACKEND}/api/overtime/apply`, formData, {
        headers: authHeaders(),
      });
      if (res.data.success) {
        setMsg(res.data.message || `Successfully applied for overtime ${formData.type}!`);
        setIsModalOpen(false);
        setFormData({ type: "Comp-Off", hours: "8", reason: "" });
        fetchData();
      }
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to submit request"));
    } finally {
      setSubmitting(false);
    }
  };

  // confirmation now happens in the styled modal before this runs
  const handleDelete = async (requestId) => {
    try {
      setWithdrawing(true);
      const res = await axios.delete(`${BACKEND}/api/overtime/${requestId}`, {
        headers: authHeaders(),
      });
      if (res.data.success) {
        setMsg("Overtime request withdrawn successfully.");
        setWithdrawTarget(null);
        fetchData();
      }
    } catch (err) {
      setWithdrawTarget(null);
      setErrorMsg(apiErrorMessage(err, "Failed to withdraw overtime request"));
    } finally {
      setWithdrawing(false);
    }
  };

  /* ---------- derived (UI only) ---------- */
  const earned = num(data.totalEarnedHours);
  const claimed = num(data.claimedHours);
  const available = num(data.availableHours);
  const claimedPct = earned > 0 ? Math.min(100, (claimed / earned) * 100) : 0;
  const compOffDays = Math.floor(available / DAY_HOURS);
  const days = data.recentOvertimeDays || [];
  const maxOT = Math.max(1, ...days.map((d) => Number(d.overtimeHours) || 0));
  const chartDays = [...days].slice(0, 14).reverse();
  const reqs = data.requests || [];
  const reqCounts = {
    All: reqs.length,
    Pending: reqs.filter((r) => r.status !== "Approved" && r.status !== "Rejected").length,
    Approved: reqs.filter((r) => r.status === "Approved").length,
    Rejected: reqs.filter((r) => r.status === "Rejected").length,
  };
  const shownReqs = reqs.filter((r) => reqFilter === "All" || (reqFilter === "Pending" ? r.status !== "Approved" && r.status !== "Rejected" : r.status === reqFilter));
  const pendingHours = num(reqs.filter((r) => r.status !== "Approved" && r.status !== "Rejected").reduce((s, r) => s + (Number(r.hours) || 0), 0));

  const hoursNum = Number(formData.hours) || 0;
  const overLimit = hoursNum > available;
  const tooLow = hoursNum < 0.5;
  const setHours = (h) => setFormData((f) => ({ ...f, hours: String(Math.max(0, Math.round(h * 2) / 2)) }));
  const openModal = () => {
    setError("");
    if (Number(formData.hours) > available) setFormData((f) => ({ ...f, hours: String(Math.min(DAY_HOURS, available)) }));
    setIsModalOpen(true);
  };
  const quickHours = [...new Set([2, 4, DAY_HOURS, DAY_HOURS * 2, available].filter((h) => h > 0 && h <= available))].sort((a, b) => a - b);

  return (
    <div className={`min-h-screen ${PAGE_BG}`}>
      {/* ---------- toast ---------- */}
      {createPortal(
        <AnimatePresence>
          {msg && (
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
              className="fixed inset-x-0 bottom-5 z-[110] flex justify-center px-4">
              <div className="flex items-center gap-3 rounded-2xl bg-gray-900 py-3 pl-4 pr-2 text-sm font-semibold text-white shadow-2xl">
                <CheckCircle2 size={18} className="text-emerald-400" /> {msg}
                <button onClick={() => setMsg("")} aria-label="Dismiss" className="rounded-lg p-1 text-white/60 hover:bg-white/10 hover:text-white"><X size={15} /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">
        {/* HEADER */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/30">
              <Timer size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">Overtime & comp-off</h1>
              <p className="text-sm text-gray-500">Hours beyond your 8-hour day are counted automatically.</p>
            </div>
          </div>
          <button
            onClick={openModal}
            disabled={data.availableHours <= 0}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <Plus size={17} strokeWidth={2.5} /> Claim overtime
          </button>
        </header>

        {/* ================= BALANCE ================= */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 p-6 text-white shadow-xl shadow-red-600/25 lg:col-span-2">
            <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-white/15 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-14 left-10 h-40 w-40 rounded-full bg-orange-300/25 blur-2xl" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">Available balance</p>
                <p className="mt-1 text-6xl font-extrabold leading-none tabular-nums">{loading ? "–" : available}<span className="ml-1 text-2xl font-bold text-white/80">hrs</span></p>
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/25">
                  <Sparkles size={12} />
                  {loading ? "…" : compOffDays >= 1 ? `Enough for ${compOffDays} comp-off day${compOffDays > 1 ? "s" : ""}` : `${num(DAY_HOURS - available)}h more for a full comp-off day`}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:w-80">
                {[["Earned", earned, TrendingUp], ["Claimed", claimed, Award], ["Pending", pendingHours, Clock3]].map(([l, v, Icon]) => (
                  <div key={l} className="rounded-2xl bg-white/15 p-3 ring-1 ring-white/20">
                    <Icon size={14} className="text-white/80" />
                    <p className="mt-1 text-lg font-extrabold tabular-nums">{loading ? "–" : v}h</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">{l}</p>
                  </div>
                ))}
              </div>
            </div>
            {/* earned bar */}
            <div className="relative mt-6">
              <div className="flex h-3 overflow-hidden rounded-full bg-white/20">
                <motion.div initial={{ width: 0 }} animate={{ width: `${claimedPct}%` }} transition={{ duration: 0.8 }} className="h-full bg-white/50" />
                <motion.div initial={{ width: 0 }} animate={{ width: `${100 - claimedPct}%` }} transition={{ duration: 0.8, delay: 0.1 }} className={`h-full ${earned > 0 ? "bg-white" : ""}`} />
              </div>
              <div className="mt-2 flex justify-between text-[11px] font-semibold text-white/80">
                <span>{claimed}h claimed</span>
                <span>{available}h available of {earned}h earned</span>
              </div>
            </div>
          </motion.div>

          {/* how it works */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={`${CARD} p-5 sm:p-6`}>
            <p className="text-sm font-bold text-gray-900">Two ways to use your hours</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Palmtree size={18} /></span>
                <div>
                  <p className="text-sm font-bold text-gray-900">Comp-off leave</p>
                  <p className="text-xs text-gray-500">Every {DAY_HOURS} hours = one paid day off.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600"><Banknote size={18} /></span>
                <div>
                  <p className="text-sm font-bold text-gray-900">Cash payout</p>
                  <p className="text-xs text-gray-500">Paid with your next payslip once approved.</p>
                </div>
              </div>
            </div>
            <p className="mt-4 flex items-start gap-1.5 rounded-2xl bg-gray-50 p-3 text-xs text-gray-500 ring-1 ring-gray-100">
              <Info size={13} className="mt-px shrink-0" /> Overtime shows up after you check out past {DAY_HOURS} hours.
            </p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* ================= OT DAYS ================= */}
          <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className={`${CARD} overflow-hidden`}>
            <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600"><Calendar size={16} /></div>
              <div className="flex-1">
                <h2 className="text-base font-bold text-gray-900">Days with overtime</h2>
                <p className="text-xs text-gray-400">{days.length} record{days.length === 1 ? "" : "s"}</p>
              </div>
            </div>

            {loading ? (
              <div className="space-y-3 p-5">{[0, 1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-2xl bg-gray-100" />)}</div>
            ) : days.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-14 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-400 ring-1 ring-red-100"><Clock size={24} /></div>
                <p className="text-sm font-bold text-gray-900">No overtime yet</p>
                <p className="mt-1 max-w-xs text-xs text-gray-500">Extra hours will appear here automatically when you check out past {DAY_HOURS} hours.</p>
              </div>
            ) : (
              <>
                {/* mini chart */}
                {chartDays.length > 1 && (
                  <div className="border-b border-gray-50 px-5 pb-3 pt-5">
                    <div className="flex h-24 items-end gap-1.5">
                      {chartDays.map((d, i) => {
                        const h = (Number(d.overtimeHours) || 0) / maxOT;
                        return (
                          <div key={d._id || i} className="group relative flex flex-1 flex-col items-center justify-end" title={`${fmtDay(d.date)} · +${d.overtimeHours}h`}>
                            <motion.div initial={{ height: 0 }} animate={{ height: `${Math.max(6, h * 100)}%` }} transition={{ duration: 0.6, delay: i * 0.03 }}
                              className="w-full rounded-t-lg bg-gradient-to-t from-red-500 to-rose-400 opacity-80 transition group-hover:opacity-100" />
                            <span className="pointer-events-none absolute -top-6 whitespace-nowrap rounded-md bg-gray-900 px-1.5 py-0.5 text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100">+{d.overtimeHours}h</span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-center text-[11px] text-gray-400">Last {chartDays.length} overtime days</p>
                  </div>
                )}
                <div className="no-scrollbar max-h-80 divide-y divide-gray-50 overflow-y-auto">
                  {days.map((d) => {
                    const x = new Date(d.date);
                    const ok = !isNaN(x);
                    return (
                      <div key={d._id} className="flex items-center gap-3 px-5 py-3 transition hover:bg-red-50/40">
                        <div className="flex h-11 w-11 shrink-0 flex-col overflow-hidden rounded-xl bg-white text-center leading-none shadow-sm ring-1 ring-gray-100">
                          <span className="bg-gradient-to-r from-red-600 to-rose-500 py-0.5 text-[8px] font-bold uppercase text-white">{ok ? x.toLocaleDateString("en-IN", { month: "short" }) : "OT"}</span>
                          <span className="flex flex-1 items-center justify-center text-base font-extrabold text-gray-900">{ok ? x.getDate() : "•"}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900">{fmtDay(d.date)}</p>
                          <p className="text-xs text-gray-400">Worked {d.workedHours}h</p>
                        </div>
                        <div className="hidden w-24 sm:block">
                          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                            <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-rose-400" style={{ width: `${((Number(d.overtimeHours) || 0) / maxOT) * 100}%` }} />
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold tabular-nums text-emerald-700 ring-1 ring-emerald-100">+{d.overtimeHours}h</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </motion.section>

          {/* ================= REQUESTS ================= */}
          <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`${CARD} overflow-hidden`}>
            <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-600"><Award size={16} /></div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">My requests</h2>
                  <p className="text-xs text-gray-400">{reqs.length} request{reqs.length === 1 ? "" : "s"}</p>
                </div>
              </div>
              <div className="-mx-1 overflow-x-auto px-1">
                <div className="flex w-max gap-1 rounded-2xl bg-gray-100/80 p-1">
                  {["All", "Pending", "Approved", "Rejected"].map((s) => (
                    <button key={s} onClick={() => setReqFilter(s)}
                      className={`relative flex items-center gap-1 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-xs font-semibold transition ${reqFilter === s ? "text-white" : "text-gray-500 hover:text-gray-800"}`}>
                      {reqFilter === s && <motion.span layoutId="ot-filter" className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 shadow" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                      <span className="relative">{s}</span>
                      <span className={`relative rounded-full px-1 text-[10px] font-bold ${reqFilter === s ? "bg-white/25" : "bg-white text-gray-500"}`}>{reqCounts[s]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {loading ? (
              <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-gray-100" />)}</div>
            ) : shownReqs.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-14 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-400 ring-1 ring-red-100"><Inbox size={24} /></div>
                <p className="text-sm font-bold text-gray-900">{reqs.length ? `No ${reqFilter.toLowerCase()} requests` : "No requests submitted yet."}</p>
                {!reqs.length && available > 0 && (
                  <button onClick={openModal} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-red-600/30"><Plus size={14} /> Claim your {available}h</button>
                )}
              </div>
            ) : (
              <div className="no-scrollbar max-h-[26rem] space-y-2 overflow-y-auto p-4">
                <AnimatePresence initial={false}>
                  {shownReqs.map((r) => {
                    const st = statusFor(r.status);
                    const comp = r.type === "Comp-Off";
                    return (
                      <motion.div key={r._id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
                        className="relative flex items-center gap-3 overflow-hidden rounded-2xl bg-white p-3 ring-1 ring-gray-100 transition hover:ring-red-200">
                        <span className={`absolute inset-y-0 left-0 w-1 ${st.strip}`} />
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${comp ? "bg-emerald-50 text-emerald-600" : "bg-sky-50 text-sky-600"}`}>
                          {comp ? <Palmtree size={18} /> : <Banknote size={18} />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 text-sm font-bold text-gray-900">
                            {comp ? "Comp-off" : "Cash payout"}
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-gray-600">{r.hours}h</span>
                            {comp && Number(r.hours) >= DAY_HOURS && <span className="text-[11px] font-semibold text-gray-400">≈ {num(Number(r.hours) / DAY_HOURS)} day{Number(r.hours) / DAY_HOURS === 1 ? "" : "s"}</span>}
                          </p>
                          {r.reason && <p className="truncate text-xs text-gray-500" title={r.reason}>{r.reason}</p>}
                          {r.createdAt && <p className="text-[11px] text-gray-400">{fmtDay(r.createdAt)}</p>}
                        </div>
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${st.chip}`}>
                          <st.Icon size={12} /> {r.status}
                        </span>
                        <button
                          onClick={() => setWithdrawTarget(r)}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-gray-400 ring-1 ring-gray-200 transition hover:bg-red-600 hover:text-white hover:ring-red-600"
                          title="Withdraw this request" aria-label="Withdraw this request"
                        >
                          <Trash2 size={14} />
                        </button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </motion.section>
        </div>
      </div>

      <AnimatePresence>
        {/* ================= APPLY MODAL ================= */}
        {isModalOpen && (
          <Modal key="apply" onClose={() => !submitting && setIsModalOpen(false)} dismissable={!submitting}>
            <div className="relative shrink-0 bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 px-6 pb-5 pt-6 text-white">
              <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
              <button onClick={() => setIsModalOpen(false)} disabled={submitting} aria-label="Close"
                className="absolute right-4 top-4 rounded-full bg-white/15 p-1.5 ring-1 ring-white/25 hover:bg-white/25 disabled:opacity-40"><X size={16} /></button>
              <p className="relative text-lg font-extrabold">Convert overtime hours</p>
              <p className="relative text-sm text-white/80">{available}h available to claim</p>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="space-y-5 overflow-y-auto p-6">
                {error && (
                  <p className="flex items-start gap-2 rounded-2xl bg-red-50 p-3 text-xs font-semibold text-red-700 ring-1 ring-red-100">
                    <AlertTriangle size={14} className="mt-px shrink-0" />{error}
                  </p>
                )}

                <div>
                  <p className="mb-2 text-xs font-semibold text-gray-600">Convert to</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { v: "Comp-Off", label: "Comp-off leave", sub: "Paid day off", Icon: Palmtree, on: "bg-emerald-50 text-emerald-700 ring-2 ring-emerald-400", ic: "bg-emerald-500" },
                      { v: "Payout", label: "Cash payout", sub: "With next payslip", Icon: Banknote, on: "bg-sky-50 text-sky-700 ring-2 ring-sky-400", ic: "bg-sky-500" },
                    ].map((o) => {
                      const sel = formData.type === o.v;
                      return (
                        <label key={o.v} className={`relative flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl p-4 text-center transition ${sel ? o.on : "bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-red-200"}`}>
                          <input type="radio" name="type" value={o.v} className="hidden" checked={sel} onChange={() => setFormData({ ...formData, type: o.v })} />
                          {sel && <span className={`absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full text-white ${o.ic}`}><CheckCircle2 size={11} /></span>}
                          <o.Icon size={22} />
                          <span className="text-sm font-bold">{o.label}</span>
                          <span className="text-[11px] opacity-70">{o.sub}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor="ot-hours" className="text-xs font-semibold text-gray-600">Hours to claim</label>
                    <span className="text-[11px] font-semibold text-gray-400">Available: {available}h</span>
                  </div>
                  <div className={`flex items-center gap-2 rounded-2xl bg-white p-1.5 ring-1 ${overLimit ? "ring-red-300" : "ring-gray-200"}`}>
                    <button type="button" onClick={() => setHours(hoursNum - 0.5)} disabled={hoursNum <= 0.5} aria-label="Less"
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-gray-700 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"><Minus size={16} /></button>
                    <input
                      id="ot-hours"
                      type="number"
                      step="0.5"
                      min="0.5"
                      max={data.availableHours}
                      required
                      value={formData.hours}
                      onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-full flex-1 bg-transparent text-center text-3xl font-extrabold tabular-nums text-gray-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button type="button" onClick={() => setHours(hoursNum + 0.5)} disabled={hoursNum + 0.5 > available} aria-label="More"
                      className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-100 text-gray-700 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"><Plus size={16} /></button>
                  </div>
                  {quickHours.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {quickHours.map((h) => (
                        <button key={h} type="button" onClick={() => setHours(h)}
                          className={`rounded-full px-3 py-1 text-xs font-bold transition ${hoursNum === h ? "bg-red-600 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:text-red-600 hover:ring-red-200"}`}>
                          {h === available ? `All (${h}h)` : h === DAY_HOURS ? "1 day (8h)" : h === DAY_HOURS * 2 ? "2 days (16h)" : `${h}h`}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className={`mt-2 text-xs font-semibold ${overLimit ? "text-red-600" : "text-gray-500"}`}>
                    {overLimit ? `You only have ${available}h available.` : tooLow ? "Minimum is 0.5h." :
                      formData.type === "Comp-Off" ? `≈ ${num(hoursNum / DAY_HOURS)} day${hoursNum / DAY_HOURS === 1 ? "" : "s"} off · ${num(available - hoursNum)}h left after this` : `${num(available - hoursNum)}h left after this`}
                  </p>
                </div>

                <div>
                  <label htmlFor="ot-reason" className="mb-1.5 block text-xs font-semibold text-gray-600">Reason / notes <span className="font-normal text-gray-400">(optional)</span></label>
                  <textarea
                    id="ot-reason"
                    rows="3"
                    placeholder="e.g. Weekend sprint deployment coverage"
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    className="w-full resize-none rounded-2xl border-0 bg-white p-3 text-sm text-gray-900 ring-1 ring-gray-200 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-400"
                  />
                </div>
              </div>

              <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-gray-100 bg-gray-50/60 p-4">
                <button type="button" onClick={() => setIsModalOpen(false)} disabled={submitting}
                  className="rounded-2xl bg-white py-3 text-sm font-bold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100 disabled:opacity-50">
                  Cancel
                </button>
                <button type="submit" disabled={submitting || overLimit || tooLow}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  {submitting ? "Submitting…" : "Confirm request"}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* ================= WITHDRAW CONFIRM ================= */}
        {withdrawTarget && (
          <Modal key="withdraw" onClose={() => !withdrawing && setWithdrawTarget(null)} dismissable={!withdrawing} size="max-w-sm">
            <div className="h-1.5 bg-gradient-to-r from-red-600 to-rose-400" />
            <div className="p-7 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100"><Trash2 size={28} /></div>
              <h3 className="text-xl font-extrabold tracking-tight text-gray-900">Withdraw this request?</h3>
              <div className="mx-auto mt-4 flex items-center justify-center gap-2 rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-100">
                {withdrawTarget.type === "Comp-Off" ? <Palmtree size={16} className="text-emerald-600" /> : <Banknote size={16} className="text-sky-600" />}
                <span className="text-sm font-bold text-gray-900">{withdrawTarget.type === "Comp-Off" ? "Comp-off" : "Cash payout"} · {withdrawTarget.hours}h</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${statusFor(withdrawTarget.status).chip}`}>{withdrawTarget.status}</span>
              </div>
              <p className="mt-3 text-sm text-gray-500">This cannot be undone.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 px-7 pb-7">
              <button onClick={() => setWithdrawTarget(null)} disabled={withdrawing}
                className="rounded-2xl bg-gray-100 py-3 text-sm font-bold text-gray-700 hover:bg-gray-200 disabled:opacity-50">Keep it</button>
              <button onClick={() => handleDelete(withdrawTarget._id)} disabled={withdrawing}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 hover:brightness-110 disabled:opacity-60">
                {withdrawing ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} {withdrawing ? "Withdrawing…" : "Withdraw"}
              </button>
            </div>
          </Modal>
        )}

        {/* ================= ERROR ================= */}
        {errorMsg && (
          <Modal key="err" onClose={() => setErrorMsg("")} size="max-w-sm">
            <div className="h-1.5 bg-gradient-to-r from-red-600 to-rose-400" />
            <div className="p-7 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100"><AlertTriangle size={28} /></div>
              <h3 className="text-xl font-extrabold tracking-tight text-gray-900">Something went wrong</h3>
              <p className="mt-2 text-sm text-gray-500">{errorMsg}</p>
              <button onClick={() => setErrorMsg("")} className="mt-6 w-full rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 hover:brightness-110">Got it</button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EmployeeOvertime;