import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  Receipt, Check, X, Clock, CheckCircle2, XCircle, Image as ImageIcon, Trash2, Search, Loader2,
  Wallet, BadgeIndianRupee, Lock, AlertTriangle, FileText, ExternalLink, Plane, UtensilsCrossed,
  Fuel, Package, Wifi, Car, Hotel, Stethoscope, GraduationCap, ChevronLeft, ChevronRight, ArrowUpDown,
  CalendarDays, Hash, Building2, Inbox,
} from "lucide-react";
import { apiErrorMessage, authHeaders } from "../../utils/apiError";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "";

const PAGE_BG =
  "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const CARD =
  "rounded-3xl bg-white/90 ring-1 ring-white/70 shadow-[0_10px_40px_-12px_rgba(127,29,29,0.18)] backdrop-blur";
const PAGE_SIZE_OPTIONS = [5, 8, 10, 15, 20];
const STATUSES = ["All", "Pending", "Approved", "Reimbursed", "Rejected"];

const STATUS_META = {
  Pending: { chip: "bg-amber-50 text-amber-700 ring-amber-200", strip: "bg-amber-400", Icon: Clock },
  Approved: { chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", strip: "bg-emerald-500", Icon: CheckCircle2 },
  Reimbursed: { chip: "bg-sky-50 text-sky-700 ring-sky-200", strip: "bg-sky-500", Icon: Wallet },
  Rejected: { chip: "bg-red-50 text-red-700 ring-red-200", strip: "bg-red-400", Icon: XCircle },
};

/* ---------- helpers (UI only) ---------- */
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const compactINR = (n) => {
  const v = Number(n || 0);
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(v >= 1e8 ? 0 : 1)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(v >= 1e6 ? 0 : 1)}L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(v >= 1e4 ? 0 : 1)}K`;
  return `₹${v}`;
};
const AVATAR_BG = ["from-red-500 to-rose-400", "from-violet-500 to-fuchsia-400", "from-sky-500 to-cyan-400", "from-amber-500 to-orange-400", "from-emerald-500 to-teal-400"];
const colorFor = (s = "") => AVATAR_BG[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_BG.length];
const initials = (name = "") => String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
const fmtDate = (d) => {
  if (!d) return "—";
  const x = new Date(d);
  return isNaN(x) ? String(d) : x.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};
const isImage = (url = "") => /\.(png|jpe?g|webp|gif|avif|bmp)(\?|#|$)/i.test(url) || /\/image\/upload\//.test(url);
const isPdf = (url = "") => /\.pdf(\?|#|$)/i.test(url);
const categoryIcon = (cat = "") => {
  const c = cat.toLowerCase();
  if (/travel|flight|train|air/.test(c)) return Plane;
  if (/food|meal|lunch|dinner|snack/.test(c)) return UtensilsCrossed;
  if (/fuel|petrol|diesel/.test(c)) return Fuel;
  if (/cab|taxi|transport|conveyance|uber|ola/.test(c)) return Car;
  if (/hotel|stay|lodg|accom/.test(c)) return Hotel;
  if (/internet|phone|mobile|wifi|telecom/.test(c)) return Wifi;
  if (/medic|health/.test(c)) return Stethoscope;
  if (/train|course|learn|education/.test(c)) return GraduationCap;
  if (/office|suppl|equip|station/.test(c)) return Package;
  return Receipt;
};
const pageList = (total, cur) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out = [1];
  const s = Math.max(2, cur - 1), e = Math.min(total - 1, cur + 1);
  if (s > 2) out.push("…");
  for (let i = s; i <= e; i++) out.push(i);
  if (e < total - 1) out.push("…");
  out.push(total);
  return out;
};
const Highlight = ({ text = "", q }) => {
  const t = String(text ?? "");
  if (!q) return <>{t}</>;
  const i = t.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{t}</>;
  return <>{t.slice(0, i)}<mark className="rounded bg-red-100 px-0.5 text-red-700">{t.slice(i, i + q.length)}</mark>{t.slice(i + q.length)}</>;
};

/* ================= MODAL SHELL ================= */
const Modal = ({ children, onClose, dismissable = true, wide = false }) => {
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
        className={`relative w-full overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-gray-100 ${wide ? "max-w-3xl" : "max-w-md"}`}>
        {children}
      </motion.div>
    </motion.div>,
    document.body
  );
};

/* ================= SMALL PIECES ================= */
const StatusChip = ({ status }) => {
  const m = STATUS_META[status] || STATUS_META.Pending;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${m.chip}`}>
      <m.Icon size={12} /> {status}
    </span>
  );
};

const CategoryChip = ({ category }) => {
  const Icon = categoryIcon(category);
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
      <Icon size={12} className="shrink-0" /> <span className="truncate">{category || "Other"}</span>
    </span>
  );
};

const Avatar = ({ name, size = "h-10 w-10 text-sm" }) => (
  <div className={`flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${colorFor(name)} font-bold text-white shadow-sm ${size}`}>
    {initials(name)}
  </div>
);

const ReceiptThumb = ({ url, onOpen }) => {
  const [failed, setFailed] = useState(false);
  if (!url) return <span className="inline-flex items-center gap-1 text-xs text-gray-300"><FileText size={13} /> None</span>;
  const img = isImage(url) && !failed;
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }} title="View receipt"
      className="group/r relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gray-50 ring-1 ring-gray-200 transition hover:ring-red-300">
      {img ? (
        <img src={url} alt="receipt" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span className="text-[9px] font-extrabold uppercase text-red-600">{isPdf(url) ? "PDF" : <ImageIcon size={15} />}</span>
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 transition group-hover/r:opacity-100"><ExternalLink size={13} /></span>
    </button>
  );
};

/* ================= MAIN ================= */
const AdminExpenses = () => {
  const [claims, setClaims] = useState([]);
  const [filterStatus, setFilterStatus] = useState("All");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [msg, setMsg] = useState("");
  // UI-only
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(8);
  const [confirm, setConfirm] = useState(null); // { type: "Approved"|"Rejected"|"delete", claim }
  const [errorMsg, setErrorMsg] = useState("");
  const [detail, setDetail] = useState(null);
  const [receipt, setReceipt] = useState(null); // url

  const fetchClaims = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${BACKEND}/api/expenses`, {
        headers: authHeaders(),
      });
      if (res.data.success) {
        setClaims(res.data.claims || []);
      }
    } catch (err) {
      console.error("Failed to load claims:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, []);

  // auto-dismiss the success toast
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 3500);
    return () => clearTimeout(t);
  }, [msg]);

  const handleReview = async (claimId, decision) => {
    try {
      setActionLoading(claimId);
      const res = await axios.put(
        `${BACKEND}/api/expenses/${claimId}/review`,
        { decision },
        { headers: authHeaders() }
      );
      if (res.data.success) {
        setMsg(`Claim successfully ${decision.toLowerCase()}!`);
        setConfirm(null);
        setDetail(null);
        fetchClaims();
      }
    } catch (err) {
      setConfirm(null);
      setErrorMsg(apiErrorMessage(err, `Failed to ${decision.toLowerCase()} claim`));
    } finally {
      setActionLoading(null);
    }
  };

  // confirmation now happens in the styled modal before this runs
  const handleDelete = async (claimId) => {
    try {
      setActionLoading(claimId);
      const res = await axios.delete(`${BACKEND}/api/expenses/${claimId}`, {
        headers: authHeaders(),
      });
      if (res.data.success) {
        setMsg("Expense claim deleted successfully.");
        setConfirm(null);
        setDetail(null);
        fetchClaims();
      }
    } catch (err) {
      setConfirm(null);
      setErrorMsg(apiErrorMessage(err, "Failed to delete expense claim"));
    } finally {
      setActionLoading(null);
    }
  };

  /* ---------- derived ---------- */
  const pendingCount = claims.filter((c) => c.status === "Pending").length;
  const approvedTotal = claims
    .filter((c) => c.status === "Approved")
    .reduce((s, c) => s + (c.amount || 0), 0);
  const pendingTotal = claims.filter((c) => c.status === "Pending").reduce((s, c) => s + (c.amount || 0), 0);
  const reimbursedTotal = claims.filter((c) => c.status === "Reimbursed").reduce((s, c) => s + (c.amount || 0), 0);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, s === "All" ? claims.length : claims.filter((c) => c.status === s).length]));
  const categories = useMemo(() => ["All", ...Array.from(new Set(claims.map((c) => c.category).filter(Boolean))).sort()], [claims]);

  const q = query.trim().toLowerCase();
  const filteredClaims = claims
    .filter((c) => {
      if (filterStatus === "All") return true;
      return c.status === filterStatus;
    })
    .filter((c) => category === "All" || c.category === category)
    .filter((c) => {
      if (!q) return true;
      const e = c.employeeId;
      return [e?.userId?.name, e?.employeeId, e?.department?.dep_name, c.title, c.description, c.category]
        .some((v) => String(v || "").toLowerCase().includes(q));
    })
    .sort((a, b) => {
      if (sort === "amount-high") return (b.amount || 0) - (a.amount || 0);
      if (sort === "amount-low") return (a.amount || 0) - (b.amount || 0);
      const da = new Date(a.date || a.createdAt), db = new Date(b.date || b.createdAt);
      return sort === "oldest" ? da - db : db - da;
    });
  const shownTotal = filteredClaims.reduce((s, c) => s + (c.amount || 0), 0);

  const totalPages = Math.max(1, Math.ceil(filteredClaims.length / perPage));
  const cur = Math.min(page, totalPages);
  const start = (cur - 1) * perPage;
  const pageItems = filteredClaims.slice(start, start + perPage);
  const resetPage = () => setPage(1);

  const busy = (id) => actionLoading === id;

  /* ---------- row actions ---------- */
  const Actions = ({ c, stacked = false }) => {
    if (c.status === "Reimbursed") {
      return <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-400"><Lock size={11} /> Locked</span>;
    }
    return (
      <div className={`flex items-center gap-1.5 ${stacked ? "" : "justify-end"}`} onClick={(e) => e.stopPropagation()}>
        {c.status === "Pending" && (
          <>
            <button disabled={busy(c._id)} onClick={() => setConfirm({ type: "Approved", claim: c })}
              className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-3 py-2 text-xs font-bold text-white shadow shadow-emerald-600/25 transition hover:brightness-110 active:scale-95 disabled:opacity-50">
              {busy(c._id) && confirm?.type === "Approved" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Approve
            </button>
            <button disabled={busy(c._id)} onClick={() => setConfirm({ type: "Rejected", claim: c })}
              className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-bold text-red-600 ring-1 ring-red-200 transition hover:bg-red-50 active:scale-95 disabled:opacity-50">
              <X size={13} /> Reject
            </button>
          </>
        )}
        <button disabled={busy(c._id)} onClick={() => setConfirm({ type: "delete", claim: c })} title="Delete claim" aria-label="Delete claim"
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white text-gray-400 ring-1 ring-gray-200 transition hover:bg-red-600 hover:text-white hover:ring-red-600 active:scale-90 disabled:opacity-50">
          {busy(c._id) && confirm?.type === "delete" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
      </div>
    );
  };

  return (
    <div className={`min-h-screen ${PAGE_BG}`}>
      {/* ---------- overlays ---------- */}
      <AnimatePresence>
        {confirm && (
          <ConfirmModal key="confirm" confirm={confirm} busy={busy(confirm.claim._id)}
            onCancel={() => !busy(confirm.claim._id) && setConfirm(null)}
            onConfirm={() => confirm.type === "delete" ? handleDelete(confirm.claim._id) : handleReview(confirm.claim._id, confirm.type)} />
        )}
        {errorMsg && (
          <Modal key="err" onClose={() => setErrorMsg("")}>
            <div className="h-1.5 bg-gradient-to-r from-red-600 to-rose-400" />
            <div className="p-7 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100"><AlertTriangle size={28} /></div>
              <h3 className="text-xl font-extrabold tracking-tight text-gray-900">Something went wrong</h3>
              <p className="mt-2 text-sm text-gray-500">{errorMsg}</p>
              <button onClick={() => setErrorMsg("")} className="mt-6 w-full rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 hover:brightness-110">Got it</button>
            </div>
          </Modal>
        )}
        {detail && !confirm && (
          <DetailModal key="detail" claim={claims.find((c) => c._id === detail) || null} onClose={() => setDetail(null)}
            onReceipt={(u) => setReceipt(u)} actions={(c) => <Actions c={c} stacked />} />
        )}
        {receipt && <ReceiptViewer key="receipt" url={receipt} onClose={() => setReceipt(null)} />}
      </AnimatePresence>

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
        <header className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/30">
            <Receipt size={26} />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">Expense claims</h1>
            <p className="text-sm text-gray-500">Approved amounts are added to the employee's next payslip automatically.</p>
          </div>
        </header>

        {/* STATS */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <motion.button type="button" onClick={() => { setFilterStatus("Pending"); resetPage(); }}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="relative col-span-2 overflow-hidden rounded-3xl bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 p-5 text-left text-white shadow-xl shadow-red-600/25 transition hover:-translate-y-0.5 lg:col-span-1">
            <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/15 blur-2xl" />
            <p className="relative flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/80"><Clock size={13} /> Waiting for review</p>
            <p className="relative mt-2 text-3xl font-extrabold tabular-nums">{loading ? "–" : pendingCount} <span className="text-base font-bold">claim{pendingCount === 1 ? "" : "s"}</span></p>
            <p className="relative mt-1 text-sm text-white/85">{loading ? "" : `${inr(pendingTotal)} requested`}</p>
          </motion.button>
          {[
            { label: "Approved · next payroll", value: approvedTotal, Icon: BadgeIndianRupee, tone: "bg-emerald-50 text-emerald-600", status: "Approved" },
            { label: "Reimbursed", value: reimbursedTotal, Icon: Wallet, tone: "bg-sky-50 text-sky-600", status: "Reimbursed" },
            { label: "Rejected", value: counts.Rejected, Icon: XCircle, tone: "bg-red-50 text-red-600", status: "Rejected", count: true },
          ].map((s, i) => (
            <motion.button type="button" key={s.label} onClick={() => { setFilterStatus(s.status); resetPage(); }}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * (i + 1) }}
              className={`${CARD} p-4 text-left transition hover:-translate-y-0.5 sm:p-5 ${filterStatus === s.status ? "ring-2 ring-red-300" : ""}`}>
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.tone}`}><s.Icon size={17} /></div>
              <p className="mt-3 text-2xl font-extrabold tabular-nums text-gray-900" title={s.count ? undefined : inr(s.value)}>
                {loading ? "–" : s.count ? s.value : compactINR(s.value)}
              </p>
              <p className="text-xs font-semibold text-gray-500">{s.label}</p>
            </motion.button>
          ))}
        </div>

        {/* LIST */}
        <div className={`${CARD} overflow-hidden`}>
          {/* toolbar */}
          <div className="space-y-3 border-b border-gray-100 p-4 sm:p-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 xl:pb-0">
                <div className="flex gap-1 rounded-2xl bg-gray-100/80 p-1">
                  {STATUSES.map((st) => (
                    <button key={st} onClick={() => { setFilterStatus(st); resetPage(); }}
                      className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition ${filterStatus === st ? "text-white" : "text-gray-500 hover:text-gray-800"}`}>
                      {filterStatus === st && (
                        <motion.span layoutId="exp-tab" className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 shadow-md shadow-red-600/25"
                          transition={{ type: "spring", stiffness: 400, damping: 32 }} />
                      )}
                      <span className="relative">{st}</span>
                      <span className={`relative rounded-full px-1.5 text-[11px] font-bold ${filterStatus === st ? "bg-white/25" : st === "Pending" && counts.Pending ? "bg-amber-400 text-white" : "bg-white text-gray-500"}`}>{counts[st]}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative sm:w-72">
                  <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={query} onChange={(e) => { setQuery(e.target.value); resetPage(); }}
                    placeholder="Search employee, ID or expense…"
                    className="w-full rounded-2xl border-0 bg-gray-50 py-2.5 pl-10 pr-9 text-sm text-gray-900 ring-1 ring-gray-200 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-400" />
                  {query && (
                    <button onClick={() => { setQuery(""); resetPage(); }} aria-label="Clear search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X size={15} /></button>
                  )}
                </div>
                <div className="relative">
                  <ArrowUpDown size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <select value={sort} onChange={(e) => { setSort(e.target.value); resetPage(); }}
                    className="w-full appearance-none rounded-2xl border-0 bg-gray-50 py-2.5 pl-10 pr-8 text-sm font-semibold text-gray-700 ring-1 ring-gray-200 focus:outline-none focus:ring-2 focus:ring-red-400">
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="amount-high">Amount: high → low</option>
                    <option value="amount-low">Amount: low → high</option>
                  </select>
                </div>
              </div>
            </div>
            {categories.length > 2 && (
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
                {categories.map((cat) => {
                  const Icon = cat === "All" ? Receipt : categoryIcon(cat);
                  return (
                    <button key={cat} onClick={() => { setCategory(cat); resetPage(); }}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${category === cat ? "bg-gray-900 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:text-red-600 hover:ring-red-200"}`}>
                      <Icon size={12} /> {cat === "All" ? "All categories" : cat}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {loading ? (
            <div className="divide-y divide-gray-50">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-4 px-5 py-4">
                  <div className="h-10 w-10 rounded-2xl bg-gray-100" />
                  <div className="flex-1 space-y-2"><div className="h-4 w-1/4 rounded bg-gray-100" /><div className="h-3 w-1/6 rounded bg-gray-50" /></div>
                  <div className="hidden h-4 w-1/5 rounded bg-gray-100 md:block" />
                  <div className="h-6 w-20 rounded-full bg-gray-100" />
                </div>
              ))}
            </div>
          ) : filteredClaims.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500 ring-1 ring-red-100"><Inbox size={28} /></div>
              <p className="text-base font-bold text-gray-900">
                {q ? "No claims match your search" : filterStatus === "Pending" ? "All caught up!" : "No claims found under this filter."}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {q ? "Try a different name, ID or expense." : filterStatus === "Pending" ? "There are no claims waiting for review." : "Try another status or category."}
              </p>
              {(q || filterStatus !== "All" || category !== "All") && (
                <button onClick={() => { setQuery(""); setFilterStatus("All"); setCategory("All"); resetPage(); }}
                  className="mt-5 rounded-2xl bg-gray-100 px-5 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-200">Show all claims</button>
              )}
            </div>
          ) : (
            <>
              {/* MOBILE CARDS */}
              <div className="space-y-3 p-4 lg:hidden">
                {pageItems.map((c) => {
                  const name = c.employeeId?.userId?.name || "Staff";
                  const m = STATUS_META[c.status] || STATUS_META.Pending;
                  return (
                    <motion.div key={c._id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      onClick={() => setDetail(c._id)}
                      className="relative cursor-pointer overflow-hidden rounded-2xl bg-white p-4 ring-1 ring-gray-100 transition hover:ring-red-200">
                      <span className={`absolute inset-y-0 left-0 w-1 ${m.strip}`} />
                      <div className="flex items-start gap-3">
                        <Avatar name={name} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-gray-900"><Highlight text={name} q={q} /></p>
                          <p className="truncate text-xs text-gray-500">{c.employeeId?.employeeId} · {c.employeeId?.department?.dep_name || "—"}</p>
                        </div>
                        <p className="text-lg font-extrabold tabular-nums text-gray-900">{inr(c.amount)}</p>
                      </div>
                      <p className="mt-3 truncate text-sm font-semibold text-gray-800"><Highlight text={c.title} q={q} /></p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <CategoryChip category={c.category} />
                        <span className="text-xs text-gray-400">{fmtDate(c.date)}</span>
                        <StatusChip status={c.status} />
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-50 pt-3">
                        <ReceiptThumb url={c.receiptUrl} onOpen={() => setReceipt(c.receiptUrl)} />
                        <Actions c={c} />
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* DESKTOP TABLE */}
              <div className="hidden lg:block">
                <table className="w-full table-auto border-collapse text-left">
                  <thead>
                    <tr className="bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      <th className="py-3 pl-6 pr-3">Employee</th>
                      <th className="px-3 py-3">Expense</th>
                      <th className="px-3 py-3">Category</th>
                      <th className="px-3 py-3 text-right">Amount</th>
                      <th className="px-3 py-3">Date</th>
                      <th className="px-3 py-3">Receipt</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="w-px whitespace-nowrap py-3 pl-3 pr-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pageItems.map((c, i) => {
                      const name = c.employeeId?.userId?.name || "Staff";
                      const empCode = c.employeeId?.employeeId || "";
                      const dept = c.employeeId?.department?.dep_name || "";
                      const m = STATUS_META[c.status] || STATUS_META.Pending;
                      return (
                        <motion.tr key={c._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                          onClick={() => setDetail(c._id)}
                          className="group cursor-pointer transition hover:bg-red-50/40">
                          <td className="relative max-w-0 py-3.5 pl-6 pr-3 xl:w-[22%]">
                            <span className={`absolute inset-y-2 left-0 w-1 rounded-r-full ${m.strip}`} />
                            <div className="flex min-w-0 items-center gap-3">
                              <Avatar name={name} />
                              <div className="min-w-0">
                                <p className="truncate font-bold text-gray-900 group-hover:text-red-700"><Highlight text={name} q={q} /></p>
                                <p className="truncate text-xs text-gray-500"><Highlight text={empCode} q={q} />{dept && <> · {dept}</>}</p>
                              </div>
                            </div>
                          </td>
                          <td className="max-w-0 px-3 py-3.5 xl:w-[24%]">
                            <p className="truncate font-semibold text-gray-900" title={c.title}><Highlight text={c.title} q={q} /></p>
                            {c.description && <p className="truncate text-xs text-gray-500" title={c.description}>{c.description}</p>}
                          </td>
                          <td className="max-w-[10rem] px-3 py-3.5"><CategoryChip category={c.category} /></td>
                          <td className="whitespace-nowrap px-3 py-3.5 text-right text-base font-extrabold tabular-nums text-gray-900">{inr(c.amount)}</td>
                          <td className="whitespace-nowrap px-3 py-3.5 text-sm text-gray-500">{fmtDate(c.date)}</td>
                          <td className="px-3 py-3.5"><ReceiptThumb url={c.receiptUrl} onOpen={() => setReceipt(c.receiptUrl)} /></td>
                          <td className="px-3 py-3.5"><StatusChip status={c.status} /></td>
                          <td className="w-px whitespace-nowrap py-3.5 pl-3 pr-6 text-right"><Actions c={c} /></td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* FOOTER / PAGINATION */}
              <div className="flex flex-col gap-3 border-t border-gray-100 p-4 sm:px-6 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                  <span>Showing <b className="text-gray-900">{start + 1}–{Math.min(start + perPage, filteredClaims.length)}</b> of <b className="text-gray-900">{filteredClaims.length}</b></span>
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">Total {inr(shownTotal)}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">Per page</span>
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <button key={n} onClick={() => { setPerPage(n); resetPage(); }}
                        className={`h-7 min-w-7 rounded-lg px-1.5 text-xs font-bold transition ${perPage === n ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "text-gray-500 hover:bg-gray-100"}`}>{n}</button>
                    ))}
                  </div>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => setPage(Math.max(cur - 1, 1))} disabled={cur === 1} aria-label="Previous page"
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200 disabled:opacity-30"><ChevronLeft size={16} /></button>
                    {pageList(totalPages, cur).map((p, i) =>
                      p === "…" ? <span key={`g${i}`} className="w-6 text-center text-gray-400">…</span> : (
                        <button key={p} onClick={() => setPage(p)}
                          className={`relative h-9 min-w-9 rounded-xl px-2 text-sm font-bold transition ${p === cur ? "text-white" : "text-gray-600 hover:bg-gray-100"}`}>
                          {p === cur && <motion.span layoutId="exp-page" className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 shadow-md shadow-red-600/25" />}
                          <span className="relative">{p}</span>
                        </button>
                      )
                    )}
                    <button onClick={() => setPage(Math.min(cur + 1, totalPages))} disabled={cur === totalPages} aria-label="Next page"
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200 disabled:opacity-30"><ChevronRight size={16} /></button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/* ================= CONFIRM ================= */
const ConfirmModal = ({ confirm, busy, onCancel, onConfirm }) => {
  const { type, claim: c } = confirm;
  const name = c.employeeId?.userId?.name || "Staff";
  const cfg = {
    Approved: {
      title: "Approve this claim?", Icon: CheckCircle2, bar: "from-emerald-500 to-teal-400",
      icon: "bg-emerald-50 text-emerald-600 ring-emerald-100", btn: "from-emerald-600 to-teal-500 shadow-emerald-600/30",
      label: "Approve", busyLabel: "Approving…",
      note: `${inr(c.amount)} will be added to ${name.split(" ")[0]}'s next payslip.`,
    },
    Rejected: {
      title: "Reject this claim?", Icon: XCircle, bar: "from-red-600 to-rose-400",
      icon: "bg-red-50 text-red-600 ring-red-100", btn: "from-red-600 to-rose-500 shadow-red-600/30",
      label: "Reject", busyLabel: "Rejecting…",
      note: "Nothing will be paid for this claim.",
    },
    delete: {
      title: "Delete this claim?", Icon: Trash2, bar: "from-red-600 to-rose-400",
      icon: "bg-red-50 text-red-600 ring-red-100", btn: "from-red-600 to-rose-500 shadow-red-600/30",
      label: "Delete", busyLabel: "Deleting…",
      note: c.status === "Approved"
        ? "This claim is approved — deleting it removes it from the next payslip. This cannot be undone."
        : "This cannot be undone.",
    },
  }[type];
  return (
    <Modal onClose={onCancel} dismissable={!busy}>
      <div className={`h-1.5 bg-gradient-to-r ${cfg.bar}`} />
      <button onClick={onCancel} disabled={busy} aria-label="Close"
        className="absolute right-4 top-5 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-40"><X size={17} /></button>
      <div className="p-6 sm:p-7">
        <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ring-1 ${cfg.icon}`}><cfg.Icon size={26} /></div>
        <h3 className="text-xl font-extrabold tracking-tight text-gray-900">{cfg.title}</h3>
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-100">
          <Avatar name={name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-gray-900">{c.title}</p>
            <p className="truncate text-xs text-gray-500">{name} · {c.category} · {fmtDate(c.date)}</p>
          </div>
          <p className="text-base font-extrabold tabular-nums text-gray-900">{inr(c.amount)}</p>
        </div>
        <p className={`mt-3 text-sm ${type === "delete" && c.status === "Approved" ? "font-semibold text-red-600" : "text-gray-500"}`}>{cfg.note}</p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button onClick={onCancel} disabled={busy}
            className="rounded-2xl bg-gray-100 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-200 disabled:opacity-50">Cancel</button>
          <button onClick={onConfirm} disabled={busy}
            className={`flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60 ${cfg.btn}`}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <cfg.Icon size={16} />}
            {busy ? cfg.busyLabel : cfg.label}
          </button>
        </div>
      </div>
    </Modal>
  );
};

/* ================= DETAIL ================= */
const DetailModal = ({ claim: c, onClose, onReceipt, actions }) => {
  const [imgFailed, setImgFailed] = useState(false);
  if (!c) return null;
  const name = c.employeeId?.userId?.name || "Staff";
  const Icon = categoryIcon(c.category);
  const img = c.receiptUrl && isImage(c.receiptUrl) && !imgFailed;
  return (
    <Modal onClose={onClose} wide>
      <div className="relative bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 px-6 pb-5 pt-6 text-white">
        <div className="absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/15 blur-2xl" />
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full bg-white/15 p-1.5 text-white ring-1 ring-white/20 hover:bg-white/25"><X size={16} /></button>
        <p className="relative flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/80"><Icon size={13} /> {c.category || "Expense"}</p>
        <p className="relative mt-1 pr-10 text-xl font-extrabold leading-tight">{c.title}</p>
        <p className="relative mt-3 text-4xl font-extrabold tabular-nums">{inr(c.amount)}</p>
      </div>
      <div className="grid max-h-[60vh] grid-cols-1 gap-5 overflow-y-auto p-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar name={name} size="h-12 w-12 text-base" />
            <div className="min-w-0">
              <p className="truncate font-bold text-gray-900">{name}</p>
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1"><Hash size={11} />{c.employeeId?.employeeId || "—"}</span>
                <span className="inline-flex items-center gap-1"><Building2 size={11} />{c.employeeId?.department?.dep_name || "—"}</span>
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-100">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Spent on</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm font-bold text-gray-900"><CalendarDays size={13} className="text-red-500" />{fmtDate(c.date)}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-100">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Status</p>
              <div className="mt-1"><StatusChip status={c.status} /></div>
            </div>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Description</p>
            <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">{c.description || <span className="text-gray-400">No description provided.</span>}</p>
          </div>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Receipt</p>
          {c.receiptUrl ? (
            <button type="button" onClick={() => onReceipt(c.receiptUrl)}
              className="group relative flex h-56 w-full items-center justify-center overflow-hidden rounded-2xl bg-gray-50 ring-1 ring-gray-200 transition hover:ring-red-300">
              {img ? (
                <img src={c.receiptUrl} alt="receipt" className="h-full w-full object-contain" onError={() => setImgFailed(true)} />
              ) : (
                <span className="flex flex-col items-center gap-2 text-gray-500"><FileText size={32} className="text-red-500" /><span className="text-sm font-semibold">{isPdf(c.receiptUrl) ? "PDF receipt" : "Receipt file"}</span></span>
              )}
              <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-gray-900/80 px-2.5 py-1 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100"><ExternalLink size={12} /> Open</span>
            </button>
          ) : (
            <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-2xl bg-gray-50 text-gray-400 ring-1 ring-dashed ring-gray-200">
              <FileText size={28} /><span className="text-sm">No receipt attached</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/60 px-6 py-4">
        <p className="hidden text-xs text-gray-400 sm:block">
          {c.status === "Pending" ? "Approve to add it to the next payslip." : c.status === "Approved" ? "Will be paid with the next payslip." : c.status === "Reimbursed" ? "Already paid — locked." : "This claim was rejected."}
        </p>
        <div className="ml-auto">{actions(c)}</div>
      </div>
    </Modal>
  );
};

/* ================= RECEIPT VIEWER ================= */
const ReceiptViewer = ({ url, onClose }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const img = isImage(url) && !failed;
  return createPortal(
    <motion.div role="dialog" aria-modal="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] flex flex-col bg-slate-950/90 p-4 backdrop-blur" onClick={onClose}>
      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
        <a href={url} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/20 hover:bg-white/20"><ExternalLink size={15} /> Open in new tab</a>
        <button onClick={onClose} aria-label="Close" className="rounded-xl bg-white/10 p-2 text-white ring-1 ring-white/20 hover:bg-white/20"><X size={18} /></button>
      </div>
      <div className="flex flex-1 items-center justify-center p-2" onClick={(e) => e.stopPropagation()}>
        {img ? (
          <motion.img initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} src={url} alt="receipt"
            onError={() => setFailed(true)} className="max-h-[82vh] max-w-full rounded-2xl object-contain shadow-2xl" />
        ) : isPdf(url) ? (
          <iframe title="receipt" src={url} className="h-[82vh] w-full max-w-4xl rounded-2xl bg-white" />
        ) : (
          <div className="rounded-3xl bg-white p-8 text-center">
            <FileText size={36} className="mx-auto text-red-500" />
            <p className="mt-3 font-bold text-gray-900">Preview not available</p>
            <a href={url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-5 py-2.5 text-sm font-bold text-white">
              <ExternalLink size={15} /> Open receipt
            </a>
          </div>
        )}
      </div>
    </motion.div>,
    document.body
  );
};

export default AdminExpenses;