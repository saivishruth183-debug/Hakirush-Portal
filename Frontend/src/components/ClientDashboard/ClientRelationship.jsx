import React, { useMemo, useState, useEffect } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trash2,
  User,
  Shirt,
  PlusCircle,
  ShieldCheck,
  Trophy,
  Search,
  Download,
  Users,
  Clock,
  Undo2,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { apiErrorMessage, authHeaders } from "../../utils/apiError";

/* 👉 Edit these lists to match your events / sizes */
const EVENTS = ["Cricket", "Football", "Badminton", "Volleyball", "Kabaddi", "Athletics"];
const SIZES = [
  { value: "XS", label: "Extra Small" },
  { value: "S", label: "Small" },
  { value: "M", label: "Medium" },
  { value: "L", label: "Large" },
  { value: "XL", label: "Extra Large" },
  { value: "XXL", label: "Double XL" },
];

const avatarColors = [
  "from-red-500 to-rose-600",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-violet-500 to-purple-600",
  "from-slate-600 to-slate-800",
];
const colorFor = (s = "") => avatarColors[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % avatarColors.length];
const initials = (n = "") => n.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
const rosterEntryToEmployee = (entry) => ({
  id: entry._id,
  name: entry.name,
  event: entry.event || "",
  jerseySize: entry.jerseySize,
  registrationTime: entry.createdAt
    ? new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—",
});

const ClientRelationship = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [formData, setFormData] = useState({ name: "", event: "", jerseySize: "" });
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [eventFilter, setEventFilter] = useState("All");
  const [toast, setToast] = useState(null); // { type: "added" | "removed", emp, index }

  useEffect(() => {
    let active = true;
    const loadRoster = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_BACKEND_URL}/api/client/me/roster`,
          { headers: authHeaders() }
        );
        if (!Array.isArray(response.data?.entries)) {
          throw new Error("The server returned invalid roster data.");
        }
        if (active) setEmployees(response.data.entries.map(rosterEntryToEmployee));
      } catch (requestError) {
        if (active) setLoadError(apiErrorMessage(requestError, "Couldn't load the roster. Please try again."));
      } finally {
        if (active) setLoading(false);
      }
    };

    loadRoster();
    return () => { active = false; };
  }, [reloadKey]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return setError("Please enter the employee's name.");
    if (!formData.event) return setError("Please choose an event.");
    if (!formData.jerseySize) return setError("Please pick a jersey size.");

    setSubmitting(true);
    setError("");
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/api/client/me/roster`,
        { name: formData.name.trim(), event: formData.event, jerseySize: formData.jerseySize },
        { headers: authHeaders() }
      );
      const entry = response.data?.entry;
      if (!entry?._id) throw new Error("The server did not confirm the roster entry.");
      const newEmployee = rosterEntryToEmployee(entry);
      setEmployees((prev) => [newEmployee, ...prev]);
      setFormData((prev) => ({ name: "", event: prev.event, jerseySize: "" }));
      setToast({ type: "added", emp: newEmployee });
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Couldn't add this player. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    const index = employees.findIndex((e) => e.id === id);
    if (index === -1) return;
    const emp = employees[index];
    setDeletingId(id);
    try {
      await axios.delete(
        `${import.meta.env.VITE_BACKEND_URL}/api/client/me/roster/${id}`,
        { headers: authHeaders() }
      );
      setEmployees((prev) => prev.filter((e) => e.id !== id));
      setToast({ type: "removed", emp, index });
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Couldn't remove this player. Please try again."));
    } finally {
      setDeletingId(null);
    }
  };

  const handleUndo = async () => {
    if (toast?.type !== "removed" || restoring) return;
    setRestoring(true);
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/api/client/me/roster`,
        { name: toast.emp.name, event: toast.emp.event, jerseySize: toast.emp.jerseySize },
        { headers: authHeaders() }
      );
      const entry = response.data?.entry;
      if (!entry?._id) throw new Error("The server did not confirm the roster entry.");
      const restored = rosterEntryToEmployee(entry);
      setEmployees((prev) => {
        const next = [...prev];
        next.splice(Math.min(toast.index, next.length), 0, restored);
        return next;
      });
      setToast(null);
    } catch (requestError) {
      setError(apiErrorMessage(requestError, "Couldn't restore this player. Please try again."));
    } finally {
      setRestoring(false);
    }
  };

  const exportCSV = () => {
    const rows = [["Name", "Event", "Jersey Size", "Registered"], ...employees.map((e) => [e.name, e.event, e.jerseySize, e.registrationTime])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "roster.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const sizeCounts = useMemo(
    () => SIZES.map((s) => ({ ...s, count: employees.filter((e) => e.jerseySize === s.value).length })),
    [employees]
  );
  const maxSize = Math.max(...sizeCounts.map((s) => s.count), 1);

  const eventCounts = useMemo(() => {
    const m = {};
    employees.forEach((e) => (m[e.event] = (m[e.event] || 0) + 1));
    return m;
  }, [employees]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter(
      (e) =>
        (eventFilter === "All" || e.event === eventFilter) &&
        (!q || [e.name, e.event, e.jerseySize].some((v) => v.toLowerCase().includes(q)))
    );
  }, [employees, query, eventFilter]);

  const topEvent = Object.entries(eventCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)] text-slate-900 font-sans selection:bg-red-200/60">
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/95 to-red-950/80" />
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-red-600/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 rounded-full bg-rose-500/10 blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-6 md:px-10 pt-10 pb-20 md:pt-14 md:pb-24">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-[11px] font-semibold uppercase tracking-[0.2em] text-red-300">
              <Shirt size={13} /> Kit Allocation
            </span>
            <h1 className="mt-4 text-3xl md:text-5xl font-black tracking-tight leading-[1.05]">
              Roster & Apparel <span className="text-red-500">Management</span>
            </h1>
            <p className="mt-3 text-sm md:text-base text-slate-400 max-w-xl">
              Register players for each event, assign jersey sizes and keep your kit order ready in one place.
            </p>
          </motion.div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 md:px-10 -mt-12 pb-16 space-y-8 relative">
        {/* ================= STATS ================= */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard i={0} icon={Users} label="Players Registered" value={employees.length} tone="bg-slate-900 shadow-slate-900/20" />
          <StatCard i={1} icon={Trophy} label="Events Covered" value={Object.keys(eventCounts).length} tone="bg-red-600 shadow-red-600/30" />
          <StatCard
            i={2}
            icon={Shirt}
            label="Most Popular Event"
            value={topEvent ? topEvent[0] : "—"}
            sub={topEvent ? `${topEvent[1]} players` : "No entries yet"}
            tone="bg-emerald-500 shadow-emerald-500/30"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* ================= FORM ================= */}
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="lg:col-span-3 bg-white border border-slate-200/70 rounded-3xl shadow-lg shadow-slate-200/40 p-6 md:p-8 space-y-6"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-100">
                <PlusCircle size={18} className="text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold tracking-tight">Add a player</h2>
                <p className="text-xs text-slate-400">The event stays selected so you can add players quickly.</p>
              </div>
            </div>

            {/* Name */}
            <Field label="Employee name">
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g. John Doe"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-11 pr-4 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-red-300 focus:bg-white focus:ring-4 focus:ring-red-100 transition"
                />
              </div>
            </Field>

            {/* Event */}
            <Field label="Event">
              <div className="relative">
                <Trophy size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  name="event"
                  value={formData.event}
                  onChange={handleInputChange}
                  className={`w-full bg-slate-50 border border-slate-200 rounded-2xl py-3.5 pl-11 pr-10 text-sm font-semibold focus:outline-none focus:border-red-300 focus:bg-white focus:ring-4 focus:ring-red-100 transition appearance-none ${
                    formData.event ? "text-slate-800" : "text-slate-400"
                  }`}
                >
                  <option value="" disabled hidden>Select an event</option>
                  {EVENTS.map((ev) => (
                    <option key={ev} value={ev}>{ev}</option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </Field>

            {/* Size chips */}
            <Field label="Jersey size">
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {SIZES.map((s) => {
                  const active = formData.jerseySize === s.value;
                  return (
                    <button
                      type="button"
                      key={s.value}
                      onClick={() => { setFormData((p) => ({ ...p, jerseySize: s.value })); setError(""); }}
                      title={s.label}
                      className={`relative py-3 rounded-2xl border text-center transition-all ${
                        active
                          ? "border-red-600 bg-red-600 text-white shadow-lg shadow-red-600/25"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-red-300 hover:bg-white"
                      }`}
                    >
                      <span className="block text-sm font-black">{s.value}</span>
                      <span className={`block text-[9px] font-semibold uppercase tracking-wide ${active ? "text-red-100" : "text-slate-400"}`}>
                        {s.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="text-sm font-semibold text-red-600"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading || submitting}
              className="w-full bg-slate-950 hover:bg-red-600 text-white rounded-2xl py-4 px-6 font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-red-600/25 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <PlusCircle size={17} />
              {submitting ? "Adding…" : "Add to roster"}
            </button>
          </motion.form>

          {/* ================= SIZE BREAKDOWN ================= */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className="lg:col-span-2 bg-white border border-slate-200/70 rounded-3xl shadow-lg shadow-slate-200/40 p-6 md:p-8"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-100">
                  <Shirt size={18} className="text-red-600" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold tracking-tight">Kit order</h2>
                  <p className="text-xs text-slate-400">Jerseys needed per size</p>
                </div>
              </div>
            </div>

            <div className="space-y-3.5">
              {sizeCounts.map((s, i) => (
                <div key={s.value} className="flex items-center gap-3">
                  <span className="w-11 text-xs font-black text-slate-700">{s.value}</span>
                  <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                    <motion.div
                      initial={false}
                      animate={{ width: `${(s.count / maxSize) * 100}%` }}
                      transition={{ duration: 0.6, delay: i * 0.03 }}
                      className="h-full rounded-full bg-gradient-to-r from-red-500 to-rose-500"
                    />
                  </div>
                  <span className="w-6 text-right text-sm font-bold text-slate-800 tabular-nums">{s.count}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-sm text-slate-500">Total jerseys</span>
              <span className="text-2xl font-black text-slate-900 tabular-nums">{employees.length}</span>
            </div>
          </motion.div>
        </div>

        {/* ================= ROSTER ================= */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white border border-slate-200/70 rounded-3xl shadow-lg shadow-slate-200/40 overflow-hidden"
        >
          {/* Toolbar */}
          <div className="p-5 md:p-6 border-b border-slate-100 space-y-4">
            {loadError && (
              <div role="alert" className="flex items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                <span>{loadError}</span>
                <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="font-bold underline">
                  Retry
                </button>
              </div>
            )}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold tracking-tight">Roster</h2>
                <p className="text-xs text-slate-400">
                  Showing {filtered.length} of {employees.length} players
                </p>
              </div>
              <div className="flex gap-2">
                <label className="relative flex-1 md:w-64">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search players…"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-red-300 focus:ring-4 focus:ring-red-100 transition"
                  />
                </label>
                <button
                  onClick={exportCSV}
                  disabled={employees.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:border-red-300 hover:text-red-600 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  <Download size={15} /> <span className="hidden sm:inline">Export CSV</span>
                </button>
              </div>
            </div>

            {employees.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {["All", ...Object.keys(eventCounts)].map((ev) => (
                  <button
                    key={ev}
                    onClick={() => setEventFilter(ev)}
                    className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      eventFilter === ev
                        ? "bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20"
                        : "bg-white text-slate-600 border-slate-200 hover:border-red-200 hover:text-red-600"
                    }`}
                  >
                    {ev}
                    <span className={`text-[10px] px-1.5 rounded-full ${eventFilter === ev ? "bg-white/20" : "bg-slate-100 text-slate-400"}`}>
                      {ev === "All" ? employees.length : eventCounts[ev]}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Table */}
          {loading ? (
            <p role="status" className="py-16 px-6 text-center text-sm text-slate-400">Loading roster…</p>
          ) : employees.length === 0 ? (
            <div className="py-16 px-6 text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
                <ShieldCheck size={28} className="text-slate-300" />
              </div>
              <p className="font-bold text-slate-700">No players yet</p>
              <p className="text-sm text-slate-400 mt-1">Add your first player using the form above.</p>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-400">No players match your search.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    <th className="py-3.5 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Player</th>
                    <th className="py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Event</th>
                    <th className="py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Jersey</th>
                    <th className="py-3.5 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">Added</th>
                    <th className="py-3.5 px-6 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <AnimatePresence initial={false}>
                    {filtered.map((emp) => (
                      <motion.tr
                        key={emp.id}
                        layout
                        initial={{ opacity: 0, backgroundColor: "#fef2f2" }}
                        animate={{ opacity: 1, backgroundColor: "#ffffff" }}
                        exit={{ opacity: 0, x: 30 }}
                        transition={{ duration: 0.35 }}
                        className="group hover:!bg-red-50/40"
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorFor(emp.name)} text-white text-sm font-black flex items-center justify-center shadow-md`}>
                              {initials(emp.name)}
                            </div>
                            <span className="text-sm font-bold text-slate-800 group-hover:text-red-600 transition-colors">{emp.name}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700">
                            <Trophy size={12} className="text-red-500" /> {emp.event}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="inline-flex items-center justify-center min-w-[44px] px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-black">
                            {emp.jerseySize}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                            <Clock size={12} /> {emp.registrationTime}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => handleDelete(emp.id)}
                            disabled={deletingId === emp.id}
                            className="p-2.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:cursor-wait disabled:opacity-50"
                            title="Remove player"
                            aria-label={`Remove ${emp.name}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>

      {/* ================= TOAST ================= */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 30, x: "-50%" }}
            className="fixed bottom-6 left-1/2 z-50 flex items-center gap-3 pl-4 pr-2 py-2 rounded-2xl bg-slate-900 text-white shadow-2xl"
          >
            {toast.type === "added" ? (
              <>
                <CheckCircle2 size={18} className="text-emerald-400" />
                <span className="text-sm font-medium pr-3">
                  <b>{toast.emp.name}</b> added · {toast.emp.event} · {toast.emp.jerseySize}
                </span>
              </>
            ) : (
              <>
                <Trash2 size={16} className="text-red-400" />
                <span className="text-sm font-medium">
                  <b>{toast.emp.name}</b> removed
                </span>
                <button
                  onClick={handleUndo}
                  disabled={restoring}
                  className="ml-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold transition-colors"
                >
                  <Undo2 size={14} /> {restoring ? "Restoring…" : "Undo"}
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ================= SMALL PIECES ================= */
const Field = ({ label, children }) => (
  <div className="space-y-2">
    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</label>
    {children}
  </div>
);

const StatCard = ({ icon: Icon, label, value, sub, tone, i }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: i * 0.07 }}
    className="bg-white rounded-3xl border border-slate-200/70 shadow-lg shadow-slate-200/40 p-5 flex items-center gap-4"
  >
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${tone}`}>
      <Icon size={20} />
    </div>
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-2xl font-black tracking-tight text-slate-900 truncate">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  </motion.div>
);

export default ClientRelationship;
