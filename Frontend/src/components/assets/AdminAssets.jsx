import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  Laptop, Monitor, Smartphone, Key, Fingerprint, Plus, Search, CheckCircle2, ShieldAlert, X, Loader2,
  Package, PackageCheck, UserCheck, Wrench, Undo2, UserPlus, AlertTriangle, Hash, ChevronLeft,
  ChevronRight, RefreshCw, Boxes, Building2, StickyNote, Check,
} from "lucide-react";
import { apiErrorMessage } from "../../utils/apiError";

const PAGE_BG =
  "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const CARD =
  "rounded-3xl bg-white/90 ring-1 ring-white/70 shadow-[0_10px_40px_-12px_rgba(127,29,29,0.18)] backdrop-blur";
const PAGE_SIZE_OPTIONS = [5, 8, 10, 15, 20];

const TYPES = [
  { value: "Laptop", Icon: Laptop, hint: "e.g. MacBook Pro M3" },
  { value: "Monitor", Icon: Monitor, hint: "e.g. Dell 27\" 4K" },
  { value: "Mobile", Icon: Smartphone, hint: "e.g. iPhone 15" },
  { value: "ID Card", Icon: Fingerprint, hint: "e.g. Access card #12" },
  { value: "Keys", Icon: Key, hint: "e.g. Office main door" },
  { value: "Other", Icon: Package, hint: "e.g. Headset" },
];
const typeIcon = (t) => (TYPES.find((x) => x.value === t) || TYPES[5]).Icon;

const STATUS_META = {
  Available: { chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", strip: "bg-emerald-500", Icon: PackageCheck },
  Assigned: { chip: "bg-sky-50 text-sky-700 ring-sky-200", strip: "bg-sky-500", Icon: UserCheck },
};
const otherMeta = { chip: "bg-amber-50 text-amber-700 ring-amber-200", strip: "bg-amber-400", Icon: Wrench };
const metaFor = (s) => STATUS_META[s] || otherMeta;

/* ---------- helpers (UI only) ---------- */
const AVATAR_BG = ["from-red-500 to-rose-400", "from-violet-500 to-fuchsia-400", "from-sky-500 to-cyan-400", "from-amber-500 to-orange-400", "from-emerald-500 to-teal-400"];
const colorFor = (s = "") => AVATAR_BG[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_BG.length];
const initials = (name = "") => String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
const imageUrl = (p) => {
  if (!p) return null;
  if (/^(https?:|data:|blob:)/.test(p)) return p;
  return `${import.meta.env.VITE_BACKEND_URL}/${String(p).replace(/^\/+/, "")}`;
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

/* ================= SHARED PIECES ================= */
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

const ModalHeader = ({ Icon, title, subtitle, onClose, disabled }) => (
  <div className="relative shrink-0 bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 px-6 pb-5 pt-6 text-white">
    <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
    <button type="button" onClick={onClose} disabled={disabled} aria-label="Close"
      className="absolute right-4 top-4 rounded-full bg-white/15 p-1.5 ring-1 ring-white/20 hover:bg-white/25 disabled:opacity-40"><X size={16} /></button>
    <div className="relative flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25"><Icon size={20} /></div>
      <div className="min-w-0 pr-8">
        <h2 className="text-lg font-extrabold leading-tight">{title}</h2>
        {subtitle && <p className="truncate text-sm text-white/80">{subtitle}</p>}
      </div>
    </div>
  </div>
);

const Avatar = ({ user, size = "h-8 w-8 text-xs" }) => {
  const [failed, setFailed] = useState(false);
  const src = imageUrl(user?.profileImage);
  const name = user?.name || "User";
  return src && !failed ? (
    <img src={src} alt={name} onError={() => setFailed(true)} className={`shrink-0 rounded-full object-cover ring-2 ring-white ${size}`} />
  ) : (
    <div className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${colorFor(name)} font-bold text-white ring-2 ring-white ${size}`}>{initials(name)}</div>
  );
};

const StatusChip = ({ status }) => {
  const m = metaFor(status);
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${m.chip}`}>
      <m.Icon size={12} /> {status || "Unknown"}
    </span>
  );
};

const TypeTile = ({ type, size = "h-11 w-11" }) => {
  const Icon = typeIcon(type);
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-50 to-rose-100 text-red-600 ring-1 ring-red-100 ${size}`}>
      <Icon size={20} />
    </div>
  );
};

/* ================= MAIN ================= */
const AdminAssets = () => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [employees, setEmployees] = useState([]);

  // Modals
  const [showAdd, setShowAdd] = useState(false);
  const [showAssign, setShowAssign] = useState(null);

  // Add Form
  const [formData, setFormData] = useState({ name: "", assetType: "Laptop", serialNumber: "", notes: "" });

  // UI-only
  const [query, setQuery] = useState("");
  const [statusTab, setStatusTab] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(8);
  const [saving, setSaving] = useState(false);
  const [returnTarget, setReturnTarget] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [toast, setToast] = useState("");
  const [empQuery, setEmpQuery] = useState("");
  const [selectedEmp, setSelectedEmp] = useState("");

  useEffect(() => {
    fetchAssets();
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchAssets = async () => {
    try {
      setError("");
      const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/asset`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setAssets(res.data.assets || []);
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to load assets"));
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/employee`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setEmployees(res.data.employees || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    try {
      setSaving(true);
      await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/asset/add`, formData, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setShowAdd(false);
      setToast(`${formData.name} added to inventory`);
      setFormData({ name: "", assetType: "Laptop", serialNumber: "", notes: "" });
      fetchAssets();
    } catch (err) {
      setErrorMsg(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    const empId = e.target.employeeId.value;
    if (!empId) return;
    try {
      setSaving(true);
      await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/asset/${showAssign}/assign`, { employeeId: empId }, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      const emp = employees.find((x) => x._id === empId);
      setToast(`Assigned to ${emp?.userId?.name || "employee"}`);
      setShowAssign(null);
      fetchAssets();
    } catch (err) {
      setErrorMsg(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // confirmation now happens in the styled modal before this runs
  const handleReturn = async (id) => {
    try {
      setSaving(true);
      await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/asset/${id}/return`, { status: "Available" }, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setReturnTarget(null);
      setToast("Asset marked as returned");
      fetchAssets();
    } catch (err) {
      setReturnTarget(null);
      setErrorMsg(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openAssign = (id) => { setSelectedEmp(""); setEmpQuery(""); setShowAssign(id); };

  /* ---------- derived ---------- */
  const counts = {
    All: assets.length,
    Available: assets.filter((a) => a.status === "Available").length,
    Assigned: assets.filter((a) => a.status === "Assigned").length,
  };
  counts.Other = assets.length - counts.Available - counts.Assigned;
  const typeCounts = useMemo(() => Object.fromEntries(TYPES.map((t) => [t.value, assets.filter((a) => (TYPES.some((x) => x.value === a.assetType) ? a.assetType : "Other") === t.value).length])), [assets]);
  const heldBy = useMemo(() => {
    const m = {};
    assets.forEach((a) => { const id = a.assignedTo?._id; if (id) m[id] = (m[id] || 0) + 1; });
    return m;
  }, [assets]);
  const utilisation = assets.length ? Math.round((counts.Assigned / assets.length) * 100) : 0;

  const q = query.trim().toLowerCase();
  const visible = assets
    .filter((a) => statusTab === "All" || (statusTab === "Other" ? !["Available", "Assigned"].includes(a.status) : a.status === statusTab))
    .filter((a) => typeFilter === "All" || (TYPES.some((x) => x.value === a.assetType) ? a.assetType : "Other") === typeFilter)
    .filter((a) => !q || [a.name, a.serialNumber, a.assetType, a.assignedTo?.userId?.name, a.assignedTo?.employeeId].some((v) => String(v || "").toLowerCase().includes(q)));

  const totalPages = Math.max(1, Math.ceil(visible.length / perPage));
  const cur = Math.min(page, totalPages);
  const start = (cur - 1) * perPage;
  const pageItems = visible.slice(start, start + perPage);
  const resetPage = () => setPage(1);

  const assignAsset = assets.find((a) => a._id === showAssign);
  const eq = empQuery.trim().toLowerCase();
  const empList = employees.filter((e) => !eq || [e.userId?.name, e.employeeId, e.department?.dep_name].some((v) => String(v || "").toLowerCase().includes(eq)));

  const TABS = [
    { key: "All", label: "All" },
    { key: "Available", label: "Available" },
    { key: "Assigned", label: "Assigned" },
    ...(counts.Other ? [{ key: "Other", label: "Other" }] : []),
  ];

  const RowAction = ({ asset }) =>
    asset.status === "Available" ? (
      <button onClick={(e) => { e.stopPropagation(); openAssign(asset._id); }}
        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 px-3.5 py-2 text-xs font-bold text-white shadow shadow-red-600/25 transition hover:brightness-110 active:scale-95">
        <UserPlus size={14} /> Assign
      </button>
    ) : asset.status === "Assigned" ? (
      <button onClick={(e) => { e.stopPropagation(); setReturnTarget(asset); }}
        className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-gray-700 ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200 active:scale-95">
        <Undo2 size={14} /> Return
      </button>
    ) : <span className="text-xs text-gray-300">—</span>;

  return (
    <div className={`min-h-screen ${PAGE_BG}`}>
      {/* ---------- overlays ---------- */}
      <AnimatePresence>
        {showAdd && (
          <Modal key="add" onClose={() => !saving && setShowAdd(false)} dismissable={!saving} size="max-w-lg">
            <ModalHeader Icon={Plus} title="Add asset" subtitle="Register a new piece of equipment" onClose={() => setShowAdd(false)} disabled={saving} />
            <form onSubmit={handleAddSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="space-y-5 overflow-y-auto p-6">
                <div>
                  <p className="mb-2 text-xs font-semibold text-gray-600">Type</p>
                  <div className="grid grid-cols-3 gap-2">
                    {TYPES.map(({ value, Icon }) => {
                      const on = formData.assetType === value;
                      return (
                        <button key={value} type="button" onClick={() => setFormData({ ...formData, assetType: value })}
                          className={`relative flex flex-col items-center gap-1.5 rounded-2xl p-3 text-xs font-bold transition ${on ? "bg-red-50 text-red-700 ring-2 ring-red-400" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-red-200"}`}>
                          {on && <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white"><Check size={10} strokeWidth={3} /></span>}
                          <Icon size={20} />
                          {value}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label htmlFor="a-name" className="mb-1.5 block text-xs font-semibold text-gray-600">Asset name <span className="text-red-500">*</span></label>
                  <input id="a-name" required autoFocus type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder={(TYPES.find((t) => t.value === formData.assetType) || TYPES[0]).hint}
                    className="w-full rounded-2xl border-0 bg-white px-4 py-3 text-sm font-semibold text-gray-900 ring-1 ring-gray-200 placeholder:font-normal placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-400" />
                </div>
                <div>
                  <label htmlFor="a-serial" className="mb-1.5 block text-xs font-semibold text-gray-600">Serial number <span className="font-normal text-gray-400">(optional)</span></label>
                  <div className="relative">
                    <Hash size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input id="a-serial" type="text" value={formData.serialNumber} onChange={e => setFormData({...formData, serialNumber: e.target.value})}
                      placeholder="e.g. C02XK1ABJG5H"
                      className="w-full rounded-2xl border-0 bg-white py-3 pl-10 pr-4 font-mono text-sm text-gray-900 ring-1 ring-gray-200 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-400" />
                  </div>
                  {formData.serialNumber && assets.some((a) => (a.serialNumber || "").toLowerCase() === formData.serialNumber.trim().toLowerCase()) && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-amber-700"><AlertTriangle size={12} /> Another asset already has this serial number.</p>
                  )}
                </div>
                <div>
                  <label htmlFor="a-notes" className="mb-1.5 block text-xs font-semibold text-gray-600">Notes <span className="font-normal text-gray-400">(optional)</span></label>
                  <textarea id="a-notes" rows={3} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}
                    placeholder="Condition, accessories, purchase info…"
                    className="w-full resize-none rounded-2xl border-0 bg-white px-4 py-3 text-sm text-gray-900 ring-1 ring-gray-200 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-red-400" />
                </div>
              </div>
              <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-gray-100 bg-gray-50/60 p-4">
                <button type="button" onClick={() => setShowAdd(false)} disabled={saving}
                  className="rounded-2xl bg-white py-3 text-sm font-bold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={saving || !formData.name.trim()}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:brightness-110 disabled:opacity-50">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} {saving ? "Saving…" : "Save asset"}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {showAssign && (
          <Modal key="assign" onClose={() => !saving && setShowAssign(null)} dismissable={!saving} size="max-w-lg">
            <ModalHeader Icon={UserPlus} title="Assign asset"
              subtitle={assignAsset ? `${assignAsset.name}${assignAsset.serialNumber ? ` · ${assignAsset.serialNumber}` : ""}` : undefined}
              onClose={() => setShowAssign(null)} disabled={saving} />
            <form onSubmit={handleAssign} className="flex min-h-0 flex-1 flex-col">
              <input type="hidden" name="employeeId" value={selectedEmp} />
              <div className="shrink-0 p-4 pb-2">
                <div className="relative">
                  <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input autoFocus value={empQuery} onChange={(e) => setEmpQuery(e.target.value)} placeholder="Search name, ID or department…"
                    className="w-full rounded-2xl border-0 bg-gray-50 py-2.5 pl-10 pr-4 text-sm ring-1 ring-gray-200 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-400" />
                </div>
              </div>
              <div className="min-h-[12rem] flex-1 space-y-1 overflow-y-auto px-4 pb-4">
                {employees.length === 0 ? (
                  <p className="py-10 text-center text-sm text-gray-400">No employees loaded.</p>
                ) : empList.length === 0 ? (
                  <p className="py-10 text-center text-sm text-gray-400">No one matches “{empQuery}”.</p>
                ) : empList.map((e) => {
                  const on = selectedEmp === e._id;
                  const held = heldBy[e._id] || 0;
                  return (
                    <button key={e._id} type="button" onClick={() => setSelectedEmp(e._id)} onDoubleClick={() => setSelectedEmp(e._id)}
                      className={`flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition ${on ? "bg-red-50 ring-2 ring-red-400" : "hover:bg-gray-50"}`}>
                      <Avatar user={e.userId} size="h-10 w-10 text-sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-gray-900"><Highlight text={e.userId?.name} q={eq} /></p>
                        <p className="flex items-center gap-2 truncate text-xs text-gray-500">
                          <span className="font-mono"><Highlight text={e.employeeId} q={eq} /></span>
                          {e.department?.dep_name && <span className="inline-flex items-center gap-1"><Building2 size={10} />{e.department.dep_name}</span>}
                        </p>
                      </div>
                      {held > 0 && <span className="shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700 ring-1 ring-sky-100">holds {held}</span>}
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition ${on ? "bg-red-600 text-white" : "ring-1 ring-gray-200"}`}>
                        {on && <Check size={12} strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-gray-100 bg-gray-50/60 p-4">
                <button type="button" onClick={() => setShowAssign(null)} disabled={saving}
                  className="rounded-2xl bg-white py-3 text-sm font-bold text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={saving || !selectedEmp}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:brightness-110 disabled:opacity-50">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <UserCheck size={16} />} {saving ? "Assigning…" : "Confirm assignment"}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {returnTarget && (
          <Modal key="return" onClose={() => !saving && setReturnTarget(null)} dismissable={!saving}>
            <div className="h-1.5 bg-gradient-to-r from-red-600 to-rose-400" />
            <div className="p-6 sm:p-7">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100"><Undo2 size={26} /></div>
              <h3 className="text-xl font-extrabold tracking-tight text-gray-900">Mark this asset as returned?</h3>
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-100">
                <TypeTile type={returnTarget.assetType} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-gray-900">{returnTarget.name}</p>
                  <p className="truncate font-mono text-xs text-gray-500">{returnTarget.serialNumber || "No serial"}</p>
                </div>
              </div>
              {returnTarget.assignedTo && (
                <p className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                  <Avatar user={returnTarget.assignedTo.userId} size="h-6 w-6 text-[10px]" />
                  Back from <b className="text-gray-800">{returnTarget.assignedTo.userId?.name}</b> — it will become available again.
                </p>
              )}
              <div className="mt-6 grid grid-cols-2 gap-2">
                <button onClick={() => setReturnTarget(null)} disabled={saving}
                  className="rounded-2xl bg-gray-100 py-3 text-sm font-bold text-gray-700 hover:bg-gray-200 disabled:opacity-50">Cancel</button>
                <button onClick={() => handleReturn(returnTarget._id)} disabled={saving}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:brightness-110 disabled:opacity-60">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Undo2 size={16} />} {saving ? "Saving…" : "Mark returned"}
                </button>
              </div>
            </div>
          </Modal>
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
      </AnimatePresence>

      {createPortal(
        <AnimatePresence>
          {toast && (
            <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
              className="fixed inset-x-0 bottom-5 z-[110] flex justify-center px-4">
              <div className="flex items-center gap-3 rounded-2xl bg-gray-900 py-3 pl-4 pr-2 text-sm font-semibold text-white shadow-2xl">
                <CheckCircle2 size={18} className="text-emerald-400" /> {toast}
                <button onClick={() => setToast("")} aria-label="Dismiss" className="rounded-lg p-1 text-white/60 hover:bg-white/10 hover:text-white"><X size={15} /></button>
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
              <Boxes size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">Company assets</h1>
              <p className="text-sm text-gray-500">Track equipment and who has it.</p>
            </div>
          </div>
          <button onClick={() => setShowAdd(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98]">
            <Plus size={17} strokeWidth={2.5} /> New asset
          </button>
        </header>

        {/* STATS */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="relative col-span-2 overflow-hidden rounded-3xl bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 p-5 text-white shadow-xl shadow-red-600/25 lg:col-span-1">
            <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/15 blur-2xl" />
            <p className="relative text-[11px] font-semibold uppercase tracking-wider text-white/80">In use</p>
            <p className="relative mt-2 text-3xl font-extrabold tabular-nums">{loading ? "–" : `${utilisation}%`}</p>
            <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-white/20">
              <motion.div initial={{ width: 0 }} animate={{ width: `${utilisation}%` }} transition={{ duration: 0.8 }} className="h-full rounded-full bg-white" />
            </div>
            <p className="relative mt-2 text-xs text-white/85">{counts.Assigned} of {counts.All} assets assigned</p>
          </motion.div>
          {[
            { key: "All", label: "Total assets", value: counts.All, Icon: Boxes, tone: "bg-red-50 text-red-600" },
            { key: "Available", label: "Available", value: counts.Available, Icon: PackageCheck, tone: "bg-emerald-50 text-emerald-600" },
            { key: "Assigned", label: "Assigned", value: counts.Assigned, Icon: UserCheck, tone: "bg-sky-50 text-sky-600" },
          ].map((s, i) => (
            <motion.button type="button" key={s.key} onClick={() => { setStatusTab(s.key); resetPage(); }}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * (i + 1) }}
              className={`${CARD} p-4 text-left transition hover:-translate-y-0.5 sm:p-5 ${statusTab === s.key && s.key !== "All" ? "ring-2 ring-red-300" : ""}`}>
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.tone}`}><s.Icon size={17} /></div>
              <p className="mt-3 text-2xl font-extrabold tabular-nums text-gray-900">{loading ? "–" : s.value}</p>
              <p className="text-xs font-semibold text-gray-500">{s.label}</p>
            </motion.button>
          ))}
        </div>

        {/* TYPE FILTER */}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {[{ value: "All", Icon: Boxes }, ...TYPES].map(({ value, Icon }) => {
            const on = typeFilter === value;
            const n = value === "All" ? counts.All : typeCounts[value] || 0;
            return (
              <button key={value} onClick={() => { setTypeFilter(value); resetPage(); }}
                className={`flex shrink-0 items-center gap-2 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition ${on ? "bg-gray-900 text-white shadow-lg" : "bg-white/90 text-gray-600 ring-1 ring-gray-200 hover:text-red-600 hover:ring-red-200"}`}>
                <Icon size={16} /> {value === "All" ? "All types" : value}
                <span className={`rounded-full px-1.5 text-[11px] font-bold ${on ? "bg-white/20" : "bg-gray-100 text-gray-500"}`}>{n}</span>
              </button>
            );
          })}
        </div>

        {/* LIST */}
        <div className={`${CARD} overflow-hidden`}>
          <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="-mx-1 overflow-x-auto px-1">
              <div className="flex w-max gap-1 rounded-2xl bg-gray-100/80 p-1">
                {TABS.map((t) => (
                  <button key={t.key} onClick={() => { setStatusTab(t.key); resetPage(); }}
                    className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${statusTab === t.key ? "text-white" : "text-gray-500 hover:text-gray-800"}`}>
                    {statusTab === t.key && (
                      <motion.span layoutId="asset-tab" className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 shadow-md shadow-red-600/25"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }} />
                    )}
                    <span className="relative">{t.label}</span>
                    <span className={`relative rounded-full px-1.5 text-[11px] font-bold ${statusTab === t.key ? "bg-white/25" : "bg-white text-gray-500"}`}>{counts[t.key]}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="relative w-full lg:w-80">
              <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={query} onChange={(e) => { setQuery(e.target.value); resetPage(); }} placeholder="Search asset, serial or person…"
                className="w-full rounded-2xl border-0 bg-gray-50 py-2.5 pl-10 pr-9 text-sm text-gray-900 ring-1 ring-gray-200 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-400" />
              {query && (
                <button onClick={() => { setQuery(""); resetPage(); }} aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X size={15} /></button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="divide-y divide-gray-50">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex animate-pulse items-center gap-4 px-5 py-4">
                  <div className="h-11 w-11 rounded-2xl bg-gray-100" />
                  <div className="flex-1 space-y-2"><div className="h-4 w-1/4 rounded bg-gray-100" /><div className="h-3 w-1/6 rounded bg-gray-50" /></div>
                  <div className="hidden h-6 w-24 rounded-full bg-gray-100 md:block" />
                  <div className="h-8 w-20 rounded-xl bg-gray-100" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100"><ShieldAlert size={28} /></div>
              <p className="text-base font-bold text-gray-900">Couldn't load assets</p>
              <p className="mt-1 text-sm text-gray-500">{error}</p>
              <button onClick={() => { setLoading(true); fetchAssets(); }}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-600/30"><RefreshCw size={15} /> Try again</button>
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500 ring-1 ring-red-100"><Package size={28} /></div>
              <p className="text-base font-bold text-gray-900">{assets.length ? "No assets match these filters" : "No assets yet"}</p>
              <p className="mt-1 text-sm text-gray-500">{assets.length ? "Try another search, status or type." : "Add laptops, ID cards, keys and more to start tracking them."}</p>
              {assets.length ? (
                <button onClick={() => { setQuery(""); setStatusTab("All"); setTypeFilter("All"); resetPage(); }}
                  className="mt-5 rounded-2xl bg-gray-100 px-5 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-200">Clear filters</button>
              ) : (
                <button onClick={() => setShowAdd(true)}
                  className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-600/30"><Plus size={16} /> Add first asset</button>
              )}
            </div>
          ) : (
            <>
              {/* MOBILE */}
              <div className="space-y-3 p-4 md:hidden">
                {pageItems.map((asset) => {
                  const m = metaFor(asset.status);
                  return (
                    <motion.div key={asset._id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="relative overflow-hidden rounded-2xl bg-white p-4 ring-1 ring-gray-100">
                      <span className={`absolute inset-y-0 left-0 w-1 ${m.strip}`} />
                      <div className="flex items-start gap-3">
                        <TypeTile type={asset.assetType} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-gray-900"><Highlight text={asset.name} q={q} /></p>
                          <p className="truncate font-mono text-xs text-gray-500">{asset.serialNumber ? <Highlight text={asset.serialNumber} q={q} /> : "No serial"}</p>
                        </div>
                        <StatusChip status={asset.status} />
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-50 pt-3">
                        {asset.assignedTo ? (
                          <div className="flex min-w-0 items-center gap-2">
                            <Avatar user={asset.assignedTo.userId} />
                            <span className="truncate text-sm font-semibold text-gray-800"><Highlight text={asset.assignedTo.userId?.name} q={q} /></span>
                          </div>
                        ) : <span className="text-xs font-semibold text-gray-300">Unassigned</span>}
                        <RowAction asset={asset} />
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* DESKTOP */}
              <div className="hidden md:block">
                <table className="w-full table-auto border-collapse text-left">
                  <thead>
                    <tr className="bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                      <th className="py-3 pl-6 pr-3">Asset</th>
                      <th className="px-3 py-3">Serial #</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Assigned to</th>
                      <th className="w-px whitespace-nowrap py-3 pl-3 pr-6 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pageItems.map((asset, i) => {
                      const m = metaFor(asset.status);
                      return (
                        <motion.tr key={asset._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                          className="group transition hover:bg-red-50/40">
                          <td className="relative max-w-0 py-3.5 pl-6 pr-3 lg:w-[34%]">
                            <span className={`absolute inset-y-2 left-0 w-1 rounded-r-full ${m.strip}`} />
                            <div className="flex min-w-0 items-center gap-3">
                              <TypeTile type={asset.assetType} />
                              <div className="min-w-0">
                                <p className="truncate font-bold text-gray-900 group-hover:text-red-700" title={asset.name}><Highlight text={asset.name} q={q} /></p>
                                <p className="flex items-center gap-1.5 truncate text-xs text-gray-500">
                                  {asset.assetType}
                                  {asset.notes && <span className="inline-flex min-w-0 items-center gap-1 truncate text-gray-400" title={asset.notes}><StickyNote size={10} className="shrink-0" /><span className="truncate">{asset.notes}</span></span>}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3.5">
                            {asset.serialNumber
                              ? <span className="rounded-lg bg-gray-50 px-2 py-1 font-mono text-xs text-gray-600 ring-1 ring-gray-100"><Highlight text={asset.serialNumber} q={q} /></span>
                              : <span className="text-xs text-gray-300">N/A</span>}
                          </td>
                          <td className="px-3 py-3.5"><StatusChip status={asset.status} /></td>
                          <td className="max-w-0 px-3 py-3.5">
                            {asset.assignedTo ? (
                              <div className="flex min-w-0 items-center gap-2.5">
                                <Avatar user={asset.assignedTo.userId} />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-gray-900"><Highlight text={asset.assignedTo.userId?.name} q={q} /></p>
                                  {asset.assignedTo.employeeId && <p className="truncate font-mono text-[11px] text-gray-400">{asset.assignedTo.employeeId}</p>}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs font-semibold text-gray-300">Unassigned</span>
                            )}
                          </td>
                          <td className="w-px whitespace-nowrap py-3.5 pl-3 pr-6 text-right"><RowAction asset={asset} /></td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION */}
              <div className="flex flex-col gap-3 border-t border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                  <span>Showing <b className="text-gray-900">{start + 1}–{Math.min(start + perPage, visible.length)}</b> of <b className="text-gray-900">{visible.length}</b></span>
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
                          {p === cur && <motion.span layoutId="asset-page" className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-600 to-rose-500 shadow-md shadow-red-600/25" />}
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

export default AdminAssets;