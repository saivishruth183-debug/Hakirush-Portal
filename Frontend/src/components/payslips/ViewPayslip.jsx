import axios from "axios";
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  Eye,
  Loader2,
  EyeOff,
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  Wallet,
  CalendarRange,
  AlertTriangle,
  X,
  FileX2,
  Sparkles,
} from "lucide-react";
import { apiErrorMessage } from "../../utils/apiError";
import { downloadPayslip, openPayslip, payslipHasFile } from "../../utils/payslipFiles";

const PAGE_BG =
  "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const CARD =
  "rounded-3xl bg-white/90 ring-1 ring-white/70 shadow-[0_10px_40px_-12px_rgba(127,29,29,0.18)] backdrop-blur";

const monthLabel = (raw) => {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};

const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const compact = (n) => {
  const v = Number(n || 0);
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(v >= 1e6 ? 0 : 1)}L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)}K`;
  return `₹${v}`;
};
const yearOf = (raw) => {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? "Other" : String(d.getFullYear());
};
const hasNum = (v) => v !== undefined && v !== null && v !== "" && !Number.isNaN(Number(v));

const ViewPayslip = () => {
  const { id } = useParams();
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(null); // `${payslipId}:view|download`
  const [actionError, setActionError] = useState("");
  // UI-only
  const [hidden, setHidden] = useState(false);
  const [year, setYear] = useState("All");

  const runAction = async (payslipId, kind, fn) => {
    if (busy) return;
    setBusy(`${payslipId}:${kind}`);
    setActionError("");
    try {
      await fn();
    } catch (err) {
      setActionError(apiErrorMessage(err, "Couldn't open this payslip. Try again."));
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const fetchPayslips = async () => {
      try {
        const token = localStorage.getItem("token");
        const empRes = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/api/employee/${id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const employeeId = empRes?.data?.employee?._id;
        if (employeeId) {
          const res = await axios.get(
            `${import.meta.env.VITE_BACKEND_URL}/api/payslip/employee/${employeeId}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const sorted = (res.data.payslips || []).sort(
            (a, b) => new Date(b.month) - new Date(a.month)
          );
          if (!cancelled) setPayslips(sorted);
        }
      } catch (err) {
        console.error("Fetch Error:", err);
        if (!cancelled) setLoadError(apiErrorMessage(err, "Couldn't load your payslips."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchPayslips();
    return () => {
      cancelled = true;
    };
  }, [id]);

  /* ---------- derived (UI only) ---------- */
  const money = (n) => (hidden ? "₹ ••••" : rupees(n));
  const latest = payslips[0];
  const prev = payslips[1];
  const delta = latest && prev ? Number(latest.netSalary || 0) - Number(prev.netSalary || 0) : null;
  const deltaPct = delta !== null && Number(prev.netSalary) ? (delta / Number(prev.netSalary)) * 100 : null;
  const thisYear = String(new Date().getFullYear());
  const ytd = payslips.filter((p) => yearOf(p.month) === thisYear).reduce((s, p) => s + Number(p.netSalary || 0), 0);
  const ytdCount = payslips.filter((p) => yearOf(p.month) === thisYear).length;
  const avg = payslips.length ? payslips.reduce((s, p) => s + Number(p.netSalary || 0), 0) / payslips.length : 0;
  const years = useMemo(() => ["All", ...Array.from(new Set(payslips.map((p) => yearOf(p.month))))], [payslips]);
  const chart = [...payslips].slice(0, 12).reverse();
  const maxNet = Math.max(1, ...chart.map((p) => Number(p.netSalary || 0)));
  const shown = payslips.filter((p) => year === "All" || yearOf(p.month) === year);
  const groups = shown.reduce((acc, p) => {
    const y = yearOf(p.month);
    (acc[y] = acc[y] || []).push(p);
    return acc;
  }, {});
  const groupKeys = Object.keys(groups).sort((a, b) => (b === "Other" ? -1 : a === "Other" ? 1 : Number(b) - Number(a)));
  const indexOf = (p) => payslips.findIndex((x) => x._id === p._id);

  return (
    <div className={`min-h-screen ${PAGE_BG}`}>
      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">

        {/* ================= HERO ================= */}
        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 p-6 text-white shadow-2xl shadow-red-600/30 sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/4 h-60 w-60 rounded-full bg-orange-300/25 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(white_1px,transparent_1px),linear-gradient(90deg,white_1px,transparent_1px)] [background-size:28px_28px]" />

          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/25"><Wallet size={13} /> My payslips</p>
              <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">Your earnings, on record</h1>
            </div>
            <button onClick={() => setHidden((v) => !v)} aria-label={hidden ? "Show amounts" : "Hide amounts"}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-xs font-bold ring-1 ring-white/25 transition hover:bg-white/25">
              {hidden ? <Eye size={14} /> : <EyeOff size={14} />} {hidden ? "Show" : "Hide"}
            </button>
          </div>

          <div className="relative mt-6 grid gap-6 lg:grid-cols-5 lg:items-end">
            <div className="lg:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/75">
                {latest ? `Latest · ${monthLabel(latest.month)}` : "Latest net pay"}
              </p>
              {loading ? (
                <div className="mt-2 h-12 w-48 animate-pulse rounded-xl bg-white/20" />
              ) : (
                <p className="mt-1 text-5xl font-extrabold leading-none tabular-nums tracking-tight">{latest ? money(latest.netSalary) : "—"}</p>
              )}
              {delta !== null && !hidden && (
                <span className={`mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${delta > 0 ? "bg-white text-emerald-700" : delta < 0 ? "bg-white text-red-600" : "bg-white/20"}`}>
                  {delta > 0 ? <TrendingUp size={13} /> : delta < 0 ? <TrendingDown size={13} /> : <Minus size={13} />}
                  {delta === 0 ? "Same as last month" : `${delta > 0 ? "+" : "−"}${rupees(Math.abs(delta))}${deltaPct !== null ? ` (${Math.abs(deltaPct).toFixed(1)}%)` : ""} vs last month`}
                </span>
              )}
              <div className="mt-5 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-white/15 p-3 ring-1 ring-white/20">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">{thisYear} so far</p>
                  <p className="mt-0.5 text-lg font-extrabold tabular-nums">{hidden ? "••••" : compact(ytd)}</p>
                  <p className="text-[10px] text-white/70">{ytdCount} payslip{ytdCount === 1 ? "" : "s"}</p>
                </div>
                <div className="rounded-2xl bg-white/15 p-3 ring-1 ring-white/20">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">Monthly average</p>
                  <p className="mt-0.5 text-lg font-extrabold tabular-nums">{hidden ? "••••" : compact(avg)}</p>
                  <p className="text-[10px] text-white/70">{payslips.length} total</p>
                </div>
              </div>
            </div>

            {/* chart */}
            <div className="lg:col-span-3">
              {chart.length > 1 ? (
                <div className="rounded-2xl bg-black/10 p-4 ring-1 ring-white/15">
                  <div className="flex h-36 items-end gap-1.5">
                    {chart.map((p, i) => {
                      const h = Number(p.netSalary || 0) / maxNet;
                      const isLatest = p._id === latest?._id;
                      const d = new Date(p.month);
                      return (
                        <div key={p._id} className="group relative flex h-full flex-1 flex-col items-center justify-end">
                          <span className="pointer-events-none absolute -top-1 z-10 -translate-y-full whitespace-nowrap rounded-md bg-gray-900 px-1.5 py-0.5 text-[10px] font-bold opacity-0 transition group-hover:opacity-100">
                            {hidden ? "••••" : rupees(p.netSalary)}
                          </span>
                          <motion.div initial={{ height: 0 }} animate={{ height: `${Math.max(4, h * 100)}%` }} transition={{ duration: 0.6, delay: i * 0.04 }}
                            className={`w-full rounded-t-lg transition ${isLatest ? "bg-white" : "bg-white/40 group-hover:bg-white/70"}`} />
                          <span className={`mt-1.5 text-[9px] font-bold uppercase ${isLatest ? "text-white" : "text-white/60"}`}>
                            {Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { month: "short" }).slice(0, 3)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-center text-[11px] text-white/70">Net pay · last {chart.length} months</p>
                </div>
              ) : (
                <div className="flex h-full min-h-[8rem] items-center justify-center rounded-2xl bg-black/10 p-4 text-center text-sm text-white/75 ring-1 ring-white/15">
                  <Sparkles size={15} className="mr-1.5" /> Your pay trend will appear after two payslips.
                </div>
              )}
            </div>
          </div>
        </motion.section>

        {/* ================= LIST ================= */}
        <div>
          <div className="mb-3 flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <CalendarRange size={16} className="text-red-500" />
              <h2 className="text-base font-bold text-gray-900">Statement history</h2>
              {!loading && payslips.length > 0 && (
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-gray-500 ring-1 ring-gray-200">
                  {payslips.length} {payslips.length === 1 ? "entry" : "entries"}
                </span>
              )}
            </div>
            {years.length > 2 && (
              <div className="-mx-1 overflow-x-auto px-1">
                <div className="flex w-max gap-1 rounded-2xl bg-white/80 p-1 ring-1 ring-gray-200">
                  {years.map((y) => (
                    <button key={y} onClick={() => setYear(y)}
                      className={`relative rounded-xl px-3 py-1.5 text-xs font-bold transition ${year === y ? "text-white" : "text-gray-500 hover:text-gray-800"}`}>
                      {year === y && <motion.span layoutId="ps-year" className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 shadow" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                      <span className="relative">{y}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <AnimatePresence>
            {actionError && (
              <motion.div role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="mb-3 flex items-center gap-3 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700 ring-1 ring-red-100">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span className="flex-1">{actionError}</span>
                  <button onClick={() => setActionError("")} aria-label="Dismiss" className="rounded-lg p-1 hover:bg-red-100"><X size={15} /></button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className={`${CARD} overflow-hidden`}>
            {loading ? (
              <div className="divide-y divide-gray-50">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex animate-pulse items-center gap-4 px-5 py-4">
                    <div className="h-12 w-12 rounded-xl bg-gray-100" />
                    <div className="flex-1 space-y-2"><div className="h-4 w-1/3 rounded bg-gray-100" /><div className="h-3 w-1/5 rounded bg-gray-50" /></div>
                    <div className="h-5 w-20 rounded bg-gray-100" />
                    <div className="hidden h-9 w-40 rounded-xl bg-gray-100 sm:block" />
                  </div>
                ))}
              </div>
            ) : loadError ? (
              <div className="flex flex-col items-center px-8 py-16 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100"><AlertTriangle size={28} /></div>
                <p className="text-base font-bold text-gray-900">Couldn't load payslips</p>
                <p className="mt-1 text-sm text-gray-500">{loadError}</p>
              </div>
            ) : payslips.length > 0 ? (
              groupKeys.map((y) => (
                <div key={y}>
                  {(year === "All" && groupKeys.length > 1) && (
                    <div className="flex items-center justify-between bg-gray-50/80 px-5 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      <span>{y}</span>
                      <span className="tabular-nums">{hidden ? "••••" : rupees(groups[y].reduce((s, p) => s + Number(p.netSalary || 0), 0))}</span>
                    </div>
                  )}
                  <div className="divide-y divide-gray-50">
                    {groups[y].map((p, i) => {
                      const hasFile = payslipHasFile(p);
                      const viewing = busy === `${p._id}:view`;
                      const downloading = busy === `${p._id}:download`;
                      const d = new Date(p.month);
                      const okDate = !Number.isNaN(d.getTime());
                      const older = payslips[indexOf(p) + 1];
                      const diff = older ? Number(p.netSalary || 0) - Number(older.netSalary || 0) : null;
                      const isLatest = p._id === latest?._id;
                      return (
                        <motion.div
                          key={p._id}
                          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                          className="group flex flex-col gap-3 px-5 py-4 transition hover:bg-red-50/40 sm:flex-row sm:items-center"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className={`flex h-12 w-12 shrink-0 flex-col overflow-hidden rounded-xl text-center leading-none shadow-sm ring-1 ${isLatest ? "ring-red-200" : "ring-gray-100"} bg-white`}>
                              <span className={`py-0.5 text-[9px] font-bold uppercase text-white ${isLatest ? "bg-gradient-to-r from-red-600 to-rose-500" : "bg-gray-400"}`}>{okDate ? d.getFullYear() : "—"}</span>
                              <span className="flex flex-1 items-center justify-center text-sm font-extrabold uppercase text-gray-900">{okDate ? d.toLocaleDateString("en-IN", { month: "short" }) : "?"}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="flex items-center gap-2 truncate font-bold text-gray-900">
                                {monthLabel(p.month)}
                                {isLatest && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 ring-1 ring-red-100">Latest</span>}
                              </p>
                              <p className="flex flex-wrap items-center gap-x-3 text-xs text-gray-400">
                                {hasNum(p.basicSalary) && <span>Basic {money(p.basicSalary)}</span>}
                                {hasNum(p.allowances) && Number(p.allowances) > 0 && <span>+ {money(p.allowances)}</span>}
                                {hasNum(p.deductions) && Number(p.deductions) > 0 && <span>− {money(p.deductions)}</span>}
                                {!hasFile && <span className="inline-flex items-center gap-1 text-amber-600"><FileX2 size={11} /> No PDF yet</span>}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-4 sm:justify-end">
                            <div className="text-left sm:text-right">
                              <p className="text-lg font-extrabold tabular-nums tracking-tight text-gray-900">{money(p.netSalary)}</p>
                              {diff !== null && diff !== 0 && !hidden && (
                                <p className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${diff > 0 ? "text-emerald-600" : "text-red-600"}`}>
                                  {diff > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{diff > 0 ? "+" : "−"}{rupees(Math.abs(diff))}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={!hasFile || Boolean(busy)}
                                aria-label={`View statement for ${monthLabel(p.month)}`}
                                title={hasFile ? "View PDF" : "No PDF on file"}
                                onClick={() => runAction(p._id, "view", () => openPayslip(p._id))}
                                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-bold text-gray-700 ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {viewing ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
                                <span className="hidden sm:inline">View</span>
                              </button>
                              <button
                                type="button"
                                disabled={!hasFile || Boolean(busy)}
                                aria-label={`Download statement for ${monthLabel(p.month)}`}
                                title={hasFile ? "Download PDF" : "No PDF on file"}
                                onClick={() => runAction(p._id, "download", () => downloadPayslip(p._id, `payslip-${p.month}`))}
                                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 px-3 text-sm font-bold text-white shadow shadow-red-600/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                              >
                                {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                <span className="hidden sm:inline">{downloading ? "Saving…" : "Download"}</span>
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center px-8 py-16 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500 ring-1 ring-red-100"><FileText size={28} /></div>
                <p className="text-base font-bold text-gray-900">No statements on file yet</p>
                <p className="mt-1 text-sm text-gray-500">Your first payslip will appear here once it's processed.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewPayslip;