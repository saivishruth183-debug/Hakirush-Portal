import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ChevronLeft, ChevronRight, Clock3, CheckCircle2, XCircle, Hash, Briefcase,
  CalendarDays, ArrowRight, X, MessageSquareText, Inbox, Loader2, AlertTriangle, ListFilter,
  Quote, RefreshCw, ArrowLeft,
} from "lucide-react";
import { apiErrorMessage } from "../../utils/apiError";

const ITEMS_PER_PAGE = 8;

const PAGE_BG =
  "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const CARD =
  "rounded-3xl bg-white/90 ring-1 ring-white/70 shadow-[0_10px_40px_-12px_rgba(127,29,29,0.18)] backdrop-blur";

const TABS = ["Pending", "Approved", "Rejected", "All"];
const TAB_ICON = { Pending: Clock3, Approved: CheckCircle2, Rejected: XCircle, All: ListFilter };

const statusStyle = {
  Pending: { chip: "bg-amber-50 text-amber-700 ring-amber-200", bar: "bg-amber-400", Icon: Clock3 },
  Approved: { chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", bar: "bg-emerald-500", Icon: CheckCircle2 },
  Rejected: { chip: "bg-red-50 text-red-700 ring-red-200", bar: "bg-red-500", Icon: XCircle },
};

/* colours for attendance values shown in the "change" column */
const attTone = (s = "") => {
  const k = String(s).toLowerCase().replace(/\s+/g, "");
  if (k === "present") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (k === "absent") return "bg-red-50 text-red-700 ring-red-100";
  if (k === "leave") return "bg-amber-50 text-amber-700 ring-amber-100";
  if (k === "halfday") return "bg-sky-50 text-sky-700 ring-sky-100";
  return "bg-gray-100 text-gray-600 ring-gray-200";
};

const formatDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });

const ago = (d) => {
  if (!d) return "";
  const s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const days = Math.floor(s / 86400);
  return days === 1 ? "yesterday" : `${days} days ago`;
};

const AVATAR_BG = ["from-red-500 to-rose-400", "from-violet-500 to-fuchsia-400", "from-sky-500 to-cyan-400", "from-amber-500 to-orange-400", "from-emerald-500 to-teal-400"];
const colorFor = (s = "") => AVATAR_BG[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_BG.length];
const initials = (name = "") => String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

const pageList = (totalPages, current) => {
  const t = totalPages || 1;
  if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1);
  const arr = [...new Set([1, t, current - 1, current, current + 1])].filter((p) => p >= 1 && p <= t).sort((a, b) => a - b);
  const out = [];
  arr.forEach((p, i) => { if (i && p - arr[i - 1] > 1) out.push("…" + i); out.push(p); });
  return out;
};

const ChangePills = ({ from, to, small }) => (
  <div className={`flex flex-wrap items-center gap-1.5 ${small ? "text-[11px]" : "text-xs"} font-semibold`}>
    <span className={`rounded-full px-2.5 py-1 ring-1 line-through decoration-1 opacity-80 ${attTone(from)}`}>{from || "—"}</span>
    <ArrowRight size={13} className="text-gray-300" />
    <span className={`rounded-full px-2.5 py-1 ring-1 ${attTone(to)}`}>{to || "—"}</span>
  </div>
);

const QUICK_REMARKS = {
  Approved: ["Verified with manager", "Corrected as requested", "Approved — thanks for flagging"],
  Rejected: ["No supporting record", "Please raise with your manager", "Request is outside the allowed window"],
};

const AdminAttendanceRequests = () => {
  const [requests, setRequests] = useState([]);
  const [tab, setTab] = useState("Pending");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [reviewTarget, setReviewTarget] = useState(null); // { request, decision }
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // UI-only
  const [reviewError, setReviewError] = useState("");
  const [toast, setToast] = useState(null); // { tone, text }
  const [expanded, setExpanded] = useState({});
  const navigate = useNavigate();

  const fetchRequests = async (status) => {
    try {
      setLoading(true);
      const params = status && status !== "All" ? { status } : {};
      const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/attendance-request`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        params,
      });
      if (res.data.success) {
        setRequests(res.data.requests || []);
        setCurrentPage(1);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(tab); }, [tab]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const openReview = (request, decision) => {
    setReviewTarget({ request, decision });
    setRemarks("");
    setReviewError("");
  };

  const submitReview = async () => {
    if (!reviewTarget) return;
    setSubmitting(true);
    setReviewError("");
    const who = reviewTarget.request.employeeId?.userId?.name || "the employee";
    const decision = reviewTarget.decision;
    try {
      await axios.put(
        `${import.meta.env.VITE_BACKEND_URL}/api/attendance-request/${reviewTarget.request._id}/review`,
        { decision: reviewTarget.decision, remarks },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      setReviewTarget(null);
      setToast({ tone: decision === "Approved" ? "ok" : "warn", text: `Request from ${who} ${decision.toLowerCase()}.` });
      await fetchRequests(tab);
    } catch (err) {
      // e.g. 409 ALREADY_REVIEWED when another admin got there first
      const msg = apiErrorMessage(err, "Failed to update the request.");
      if (err?.response?.status === 409) {
        setReviewTarget(null);
        setToast({ tone: "error", text: msg });
        await fetchRequests(tab);
      } else {
        setReviewError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return requests
      .filter((r) =>
        (r.employeeId?.userId?.name || "").toLowerCase().includes(q) ||
        String(r.employeeId?.employeeId || "").toLowerCase().includes(q)
      )
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [requests, search]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filtered, currentPage]
  );

  const pendingCount = requests.filter((r) => r.status === "Pending").length;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

  const emptyText = search ? "No requests match this search." : tab === "Pending" ? "You're all caught up — no pending requests." : `No ${tab.toLowerCase()} requests found.`;

  const Actions = ({ r, full }) =>
    r.status === "Pending" ? (
      <div className={`flex gap-2 ${full ? "" : "justify-end"}`}>
        <button
          onClick={() => openReview(r, "Approved")}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-emerald-600/25 transition hover:-translate-y-0.5 hover:brightness-110 active:scale-95 ${full ? "flex-1" : ""}`}
        >
          <CheckCircle2 size={14} /> Approve
        </button>
        <button
          onClick={() => openReview(r, "Rejected")}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-red-600 ring-1 ring-red-200 transition hover:bg-red-50 active:scale-95 ${full ? "flex-1" : ""}`}
        >
          <XCircle size={14} /> Reject
        </button>
      </div>
    ) : (
      <span className="text-xs text-gray-400">{r.reviewedAt ? `Reviewed ${formatDate(r.reviewedAt)}` : "—"}</span>
    );

  return (
    <div className={`min-h-screen ${PAGE_BG} pb-20 text-gray-900`}>
      {/* Toast */}
      {createPortal(
        <AnimatePresence>
          {toast && (
            <motion.div key="toast" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className="fixed inset-x-0 bottom-6 z-[310] mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-2.5 rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white shadow-2xl">
              {toast.tone === "ok" ? <CheckCircle2 size={16} className="text-emerald-400" /> : toast.tone === "warn" ? <XCircle size={16} className="text-red-400" /> : <AlertTriangle size={16} className="text-amber-400" />}
              {toast.text}
              <button onClick={() => setToast(null)} aria-label="Dismiss" className="ml-1 rounded p-0.5 text-white/50 hover:text-white"><X size={14} /></button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <div className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">

        {/* HEADER */}
        <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <button onClick={() => navigate(-1)}
            className="group mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-gray-500 ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200">
            <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" /> Back
          </button>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/30">
                <MessageSquareText size={24} />
                {tab !== "All" && pendingCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-amber-950 ring-2 ring-white">
                    {pendingCount}
                  </span>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-500">Attendance</p>
                <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                  Correction <span className="bg-gradient-to-r from-red-600 to-rose-500 bg-clip-text text-transparent">Requests</span>
                </h1>
                <p className="text-sm text-gray-500">
                  {pendingCount > 0 ? <><b className="text-amber-600">{pendingCount}</b> awaiting your review</> : "Review employees' attendance corrections"}
                </p>
              </div>
            </div>
            <button type="button" onClick={() => fetchRequests(tab)} disabled={loading}
              className="inline-flex items-center justify-center gap-2 self-start rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-gray-600 shadow-sm ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200 disabled:opacity-60 sm:self-auto">
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </motion.header>

        {/* MAIN CARD */}
        <div className={`${CARD} overflow-hidden`}>
          {/* Tabs + search */}
          <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:p-5 lg:flex-row lg:items-center">
            <div className="flex gap-1 rounded-2xl bg-gray-100/80 p-1" role="tablist">
              {TABS.map((t) => {
                const Icon = TAB_ICON[t];
                const active = tab === t;
                return (
                  <button key={t} role="tab" aria-selected={active} onClick={() => setTab(t)}
                    className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors sm:flex-none sm:px-4 ${active ? "text-red-600" : "text-gray-500 hover:text-gray-800"}`}>
                    {active && <motion.span layoutId="req-tab" className="absolute inset-0 rounded-xl bg-white shadow-sm" transition={{ type: "spring", stiffness: 420, damping: 32 }} />}
                    <Icon size={15} className="relative" />
                    <span className="relative">{t}</span>
                    {t === "Pending" && tab === "Pending" && pendingCount > 0 && (
                      <span className="relative rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-700">{pendingCount}</span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="group relative flex flex-1 items-center rounded-2xl bg-gray-50 px-4 ring-1 ring-gray-200 transition focus-within:bg-white focus-within:ring-2 focus-within:ring-red-400">
              <Search size={17} className="text-gray-400 transition group-focus-within:text-red-500" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                placeholder="Search by employee name or ID…"
                className="w-full bg-transparent py-3 pl-3 text-sm font-medium text-gray-900 outline-none placeholder:text-gray-400"
              />
              {search && (
                <button onClick={() => { setSearch(""); setCurrentPage(1); }} aria-label="Clear search" className="rounded-full p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-4 rounded-2xl p-3">
                  <div className="h-10 w-10 rounded-2xl bg-gray-200" />
                  <div className="flex-1 space-y-2"><div className="h-3 w-40 rounded bg-gray-200" /><div className="h-2.5 w-24 rounded bg-gray-100" /></div>
                  <div className="hidden h-6 w-40 rounded-full bg-gray-100 sm:block" />
                  <div className="h-8 w-40 rounded-xl bg-gray-100" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* DESKTOP */}
              <div className="hidden md:block">
                <table className="w-full table-auto border-collapse text-left">
                  <thead>
                    <tr className="bg-gray-50/70 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      <th className="py-3 pl-5 pr-3 font-bold lg:pl-6">Employee</th>
                      <th className="px-3 py-3 font-bold">Date</th>
                      <th className="px-3 py-3 font-bold">Change</th>
                      <th className="px-3 py-3 font-bold">Reason</th>
                      <th className="px-3 py-3 font-bold">Status</th>
                      <th className="w-px whitespace-nowrap py-3 pl-3 pr-5 text-right font-bold lg:pr-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginated.length > 0 ? paginated.map((r, i) => {
                      const emp = r.employeeId;
                      const st = statusStyle[r.status] || statusStyle.Pending;
                      const name = emp?.userId?.name || "Unknown";
                      const isOpen = !!expanded[r._id];
                      const long = (r.reason || "").length > 90;
                      return (
                        <motion.tr key={r._id}
                          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}
                          className="group align-top transition-colors hover:bg-red-50/40">
                          <td className="relative max-w-0 py-4 pl-5 pr-3 lg:pl-6">
                            <span className={`absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full ${st.bar}`} />
                            <div className="flex items-center gap-3">
                              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${colorFor(name)} text-xs font-bold text-white shadow-md`}>
                                {initials(name)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-gray-900 transition group-hover:text-red-700">{name}</p>
                                <p className="flex items-center gap-2 truncate text-xs text-gray-400">
                                  <span className="inline-flex items-center gap-0.5 font-mono"><Hash size={10} />{emp?.employeeId || "N/A"}</span>
                                  <span className="inline-flex items-center gap-1 truncate"><Briefcase size={10} />{emp?.department?.dep_name || "N/A"}</span>
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4">
                            <p className="text-sm font-semibold text-gray-800">{formatDate(r.date)}</p>
                            {r.createdAt && <p className="text-[11px] text-gray-400">Requested {ago(r.createdAt)}</p>}
                          </td>
                          <td className="px-3 py-4">
                            <ChangePills from={r.currentStatus} to={r.requestedStatus} />
                          </td>
                          <td className="max-w-[18rem] px-3 py-4">
                            <p className={`text-sm text-gray-600 ${isOpen ? "" : "line-clamp-2"}`} title={r.reason}>{r.reason || <span className="text-gray-300">No reason given</span>}</p>
                            {long && (
                              <button onClick={() => setExpanded((e) => ({ ...e, [r._id]: !isOpen }))} className="mt-0.5 text-[11px] font-semibold text-red-600 hover:underline">
                                {isOpen ? "Show less" : "Read more"}
                              </button>
                            )}
                            {r.remarks && r.status !== "Pending" && (
                              <p className="mt-1.5 flex items-start gap-1 text-[11px] italic text-gray-400"><Quote size={10} className="mt-0.5 shrink-0" /> {r.remarks}</p>
                            )}
                          </td>
                          <td className="px-3 py-4">
                            <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${st.chip}`}>
                              <st.Icon size={12} /> {r.status}
                            </span>
                          </td>
                          <td className="w-px whitespace-nowrap py-4 pl-3 pr-5 text-right lg:pr-6">
                            <Actions r={r} />
                          </td>
                        </motion.tr>
                      );
                    }) : (
                      <tr><td colSpan="6"><EmptyState text={emptyText} pending={tab === "Pending" && !search} /></td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* MOBILE */}
              <div className="space-y-3 p-4 md:hidden">
                {paginated.length > 0 ? paginated.map((r, i) => {
                  const emp = r.employeeId;
                  const st = statusStyle[r.status] || statusStyle.Pending;
                  const name = emp?.userId?.name || "Unknown";
                  return (
                    <motion.div key={r._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04 }}
                      className="relative overflow-hidden rounded-3xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                      <span className={`absolute inset-y-0 left-0 w-1.5 ${st.bar}`} />
                      <div className="flex items-start justify-between gap-3 pl-2">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${colorFor(name)} text-xs font-bold text-white shadow-md`}>
                            {initials(name)}
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate font-bold text-gray-900">{name}</h3>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span className="inline-flex items-center gap-0.5 rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-gray-500"><Hash size={9} />{emp?.employeeId || "N/A"}</span>
                              <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500"><Briefcase size={9} />{emp?.department?.dep_name || "N/A"}</span>
                            </div>
                          </div>
                        </div>
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${st.chip}`}>
                          <st.Icon size={11} /> {r.status}
                        </span>
                      </div>
                      <div className="mt-3 space-y-2 pl-2">
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                          <CalendarDays size={13} className="text-gray-400" /> {formatDate(r.date)}
                          {r.createdAt && <span className="font-normal text-gray-400">· {ago(r.createdAt)}</span>}
                        </p>
                        <ChangePills from={r.currentStatus} to={r.requestedStatus} small />
                        {r.reason && (
                          <p className="rounded-2xl bg-gray-50 p-3 text-sm text-gray-600 ring-1 ring-gray-100">{r.reason}</p>
                        )}
                        {r.remarks && r.status !== "Pending" && (
                          <p className="flex items-start gap-1 text-[11px] italic text-gray-400"><Quote size={10} className="mt-0.5 shrink-0" /> {r.remarks}</p>
                        )}
                      </div>
                      <div className="mt-3 border-t border-gray-100 pl-2 pt-3">
                        <Actions r={r} full />
                      </div>
                    </motion.div>
                  );
                }) : (
                  <EmptyState text={emptyText} pending={tab === "Pending" && !search} />
                )}
              </div>

              {/* PAGINATION */}
              {totalPages > 1 && (
                <div className="flex flex-col items-center gap-3 border-t border-gray-100 bg-gray-50/50 p-4 sm:flex-row sm:justify-between sm:px-6">
                  <p className="text-xs text-gray-500">
                    Showing <b className="text-gray-900">{startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, filtered.length)}</b> of <b className="text-gray-900">{filtered.length}</b>
                  </p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1} aria-label="Previous page"
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-gray-500 ring-1 ring-gray-200 transition enabled:hover:text-red-600 enabled:hover:ring-red-200 disabled:opacity-40">
                      <ChevronLeft size={16} />
                    </button>
                    {pageList(totalPages, currentPage).map((p) =>
                      typeof p === "string" ? <span key={p} className="px-1 text-gray-400">…</span> : (
                        <button key={p} onClick={() => setCurrentPage(p)}
                          className={`relative h-9 min-w-9 rounded-xl px-2 text-sm font-semibold transition ${p === currentPage ? "text-white" : "text-gray-600 hover:bg-white hover:text-red-600"}`}>
                          {p === currentPage && <motion.span layoutId="req-page" className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 shadow shadow-red-600/30" />}
                          <span className="relative">{p}</span>
                        </button>
                      )
                    )}
                    <button onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} aria-label="Next page"
                      className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-gray-500 ring-1 ring-gray-200 transition enabled:hover:text-red-600 enabled:hover:ring-red-200 disabled:opacity-40">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* REVIEW CONFIRMATION MODAL */}
      <AnimatePresence>
        {reviewTarget && (
          <ReviewModal
            key="review"
            target={reviewTarget}
            remarks={remarks}
            setRemarks={setRemarks}
            submitting={submitting}
            error={reviewError}
            onClose={() => !submitting && setReviewTarget(null)}
            onSubmit={submitReview}
            onSwitch={(d) => { setReviewTarget((t) => ({ ...t, decision: d })); setReviewError(""); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

/* ================= REVIEW MODAL ================= */
const ReviewModal = ({ target, remarks, setRemarks, submitting, error, onClose, onSubmit, onSwitch }) => {
  const approve = target.decision === "Approved";
  const r = target.request;
  const name = r.employeeId?.userId?.name || "Unknown";

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <motion.div className="fixed inset-0 z-[300] flex items-end justify-center p-4 sm:items-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div role="dialog" aria-modal="true"
        initial={{ y: 40, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 30, opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-gray-100">
        <div className={`h-1.5 ${approve ? "bg-gradient-to-r from-emerald-500 to-teal-400" : "bg-gradient-to-r from-red-600 to-rose-400"}`} />
        <button onClick={onClose} disabled={submitting} aria-label="Close"
          className="absolute right-4 top-5 rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40">
          <X size={18} />
        </button>

        <div className="p-6 sm:p-7">
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${approve ? "bg-emerald-50 text-emerald-600 ring-emerald-100" : "bg-red-50 text-red-600 ring-red-100"}`}>
              {approve ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
            </div>
            <div className="min-w-0">
              <p className={`text-xs font-semibold uppercase tracking-wider ${approve ? "text-emerald-600" : "text-red-600"}`}>{approve ? "Approve request" : "Reject request"}</p>
              <h3 className="truncate text-lg font-extrabold tracking-tight text-gray-900">{name}</h3>
            </div>
          </div>

          {/* decision switch */}
          <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-gray-100 p-1">
            {["Approved", "Rejected"].map((d) => (
              <button key={d} type="button" onClick={() => onSwitch(d)} disabled={submitting}
                className={`relative rounded-xl py-2 text-sm font-semibold transition-colors ${target.decision === d ? (d === "Approved" ? "text-emerald-700" : "text-red-700") : "text-gray-500"}`}>
                {target.decision === d && <motion.span layoutId="decision-pill" className="absolute inset-0 rounded-xl bg-white shadow-sm" />}
                <span className="relative">{d === "Approved" ? "Approve" : "Reject"}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-2 rounded-2xl bg-gray-50 p-4 ring-1 ring-gray-100">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-700"><CalendarDays size={14} className="text-gray-400" /> {formatDate(r.date)}</p>
            <ChangePills from={r.currentStatus} to={r.requestedStatus} />
            {r.reason && <p className="flex items-start gap-1.5 text-sm text-gray-600"><Quote size={12} className="mt-1 shrink-0 text-gray-300" /> {r.reason}</p>}
            <p className="text-[11px] text-gray-400">
              {approve ? `Their attendance for this day will be changed to “${r.requestedStatus}”.` : `Their attendance stays “${r.currentStatus}”.`}
            </p>
          </div>

          <label htmlFor="review-remarks" className="mt-5 block text-xs font-semibold text-gray-600">
            Remarks <span className="font-normal text-gray-400">(optional, the employee will see this)</span>
          </label>
          <textarea
            id="review-remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
            placeholder="Add a note for the employee..."
            className="mt-1.5 w-full resize-none rounded-2xl bg-white p-3 text-sm text-gray-900 outline-none ring-1 ring-gray-200 transition placeholder:text-gray-300 focus:ring-2 focus:ring-red-400"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_REMARKS[target.decision].map((q) => (
              <button key={q} type="button" onClick={() => setRemarks(q)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${remarks === q ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"}`}>
                {q}
              </button>
            ))}
          </div>

          <AnimatePresence>
            {error && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-4 flex items-start gap-2 rounded-2xl bg-red-50 p-3 text-xs font-medium text-red-700 ring-1 ring-red-100">
                <AlertTriangle size={14} className="mt-px shrink-0" /> {error}
              </motion.p>
            )}
          </AnimatePresence>

          <div className="mt-6 grid grid-cols-2 gap-2">
            <button type="button" onClick={onClose} disabled={submitting}
              className="rounded-2xl bg-gray-100 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-200 disabled:opacity-50">
              Cancel
            </button>
            <button
              onClick={onSubmit}
              disabled={submitting}
              className={`flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60 ${
                approve ? "bg-gradient-to-r from-emerald-600 to-teal-500 shadow-emerald-600/30" : "bg-gradient-to-r from-red-600 to-rose-500 shadow-red-600/30"
              }`}
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : approve ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              {submitting ? "Submitting…" : `Confirm ${approve ? "approval" : "rejection"}`}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
};

const EmptyState = ({ text, pending }) => (
  <div className="flex flex-col items-center py-14 text-center">
    <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ring-1 ${pending ? "bg-emerald-50 text-emerald-500 ring-emerald-100" : "bg-gray-50 text-gray-300 ring-gray-100"}`}>
      {pending ? <CheckCircle2 size={22} /> : <Inbox size={22} />}
    </div>
    <p className="text-sm font-bold text-gray-700">{text}</p>
  </div>
);

export default AdminAttendanceRequests;
