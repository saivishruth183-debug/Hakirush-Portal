import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Trash2, User, Shirt, PlusCircle, ShieldCheck, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { apiErrorMessage } from "../../utils/apiError";

const JERSEY_SIZES = [
  { value: "XS", label: "XS - Extra Small" },
  { value: "S", label: "S - Small" },
  { value: "M", label: "M - Medium" },
  { value: "L", label: "L - Large" },
  { value: "XL", label: "XL - Extra Large" },
  { value: "XXL", label: "XXL - Double Large" },
];

const rosterUrl = `${import.meta.env.VITE_BACKEND_URL}/api/client/me/roster`;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

const formatTimestamp = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

// Roster is persisted per client: GET/POST /api/client/me/roster,
// DELETE /api/client/me/roster/:entryId (owner only).
const ClientRelationship = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    jerseySize: ""
  });

  const loadRoster = useCallback(async () => {
    try {
      const res = await axios.get(rosterUrl, { headers: authHeaders() });
      setEntries(Array.isArray(res.data?.entries) ? res.data.entries : []);
      setLoadError("");
    } catch (err) {
      setLoadError(apiErrorMessage(err, "Couldn't load your roster."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  const retryLoad = () => {
    setLoading(true);
    setLoadError("");
    loadRoster();
  };

  // Handle Input Changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formError) setFormError("");
  };

  // Handle Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const name = formData.name.trim();
    if (!name || !formData.jerseySize) {
      setFormError("Enter a name and choose a jersey size.");
      return;
    }

    setSubmitting(true);
    setFormError("");
    try {
      const res = await axios.post(
        rosterUrl,
        { name, jerseySize: formData.jerseySize },
        { headers: authHeaders() }
      );
      if (res.data?.success && res.data.entry) {
        setEntries((prev) => [res.data.entry, ...prev]);
      } else {
        await loadRoster();
      }
      setFormData({ name: "", jerseySize: "" }); // Reset fields
    } catch (err) {
      setFormError(apiErrorMessage(err, "Couldn't add this person to the roster."));
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Data Deletion
  const handleDelete = async (entryId) => {
    if (deletingId) return;
    if (!window.confirm("Remove this person from the roster?")) return;
    setDeletingId(entryId);
    try {
      await axios.delete(`${rosterUrl}/${entryId}`, { headers: authHeaders() });
      setEntries((prev) => prev.filter((entry) => entry._id !== entryId));
    } catch (err) {
      alert(apiErrorMessage(err, "Couldn't remove this roster entry."));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-red-50 to-pink-50 text-slate-900 font-sans p-6 lg:p-16 selection:bg-red-100">
      <div className="max-w-4xl mx-auto space-y-12">

        {/* TITLE HEADER */}
        <div className="border-l-8 border-red-600 pl-8">
          <h2 className="text-4xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">
            Roster & Apparel<br/><span className="text-red-600 text-5xl">Management</span>
          </h2>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.5em] mt-3">Personnel Unit Allocation</p>
        </div>

        {/* REGISTRATION FORM CARD */}
        <div className="bg-white/80 backdrop-blur-2xl border border-slate-100 p-8 rounded-[2.5rem] shadow-[0_8px_32px_rgba(220,38,38,0.04)]">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">

            {/* Input Name */}
            <div className="space-y-2">
              <label htmlFor="roster-name" className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Employee Name</label>
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="roster-name"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g. John Doe"
                  maxLength={100}
                  required
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold text-slate-800 placeholder-slate-300 focus:outline-none focus:border-red-400 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Selector Size */}
            <div className="space-y-2">
              <label htmlFor="roster-size" className="block text-[9px] font-black uppercase tracking-widest text-slate-400">Jersey Size</label>
              <div className="relative">
                <Shirt size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  id="roster-size"
                  name="jerseySize"
                  value={formData.jerseySize}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3.5 pl-12 pr-4 text-sm font-black text-slate-700 focus:outline-none focus:border-red-400 focus:bg-white transition-all appearance-none uppercase italic"
                >
                  <option value="" disabled hidden>Select Size</option>
                  {JERSEY_SIZES.map((size) => (
                    <option key={size.value} value={size.value}>{size.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Action Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-slate-950 hover:bg-red-600 text-white rounded-2xl py-3.5 px-6 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-red-600/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <PlusCircle size={16} />}
              {submitting ? "Saving…" : "Deploy to Roster"}
            </button>
          </form>
          {formError && (
            <p role="alert" className="mt-4 flex items-center gap-2 text-xs font-bold text-red-600">
              <AlertCircle size={14} /> {formError}
            </p>
          )}
        </div>

        {/* DATA VISUALIZATION TABLE */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-4">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Allocated Profiles ({entries.length})</span>
          </div>

          <div className="overflow-hidden bg-white border border-slate-100 rounded-[2.5rem] shadow-[0_4px_24px_rgba(0,0,0,0.01)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="py-5 px-8 text-[9px] font-black text-slate-400 uppercase tracking-widest">Employee Profile</th>
                    <th className="py-5 px-6 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Jersey Fit</th>
                    <th className="py-5 px-6 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Added</th>
                    <th className="py-5 px-8 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr>
                      <td colSpan="4" className="py-12 text-center">
                        <Loader2 size={24} className="mx-auto text-slate-300 animate-spin mb-2" />
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Loading roster…</p>
                      </td>
                    </tr>
                  ) : loadError ? (
                    <tr>
                      <td colSpan="4" className="py-12 text-center">
                        <AlertCircle size={28} className="mx-auto text-red-300 mb-2" />
                        <p className="text-xs font-bold text-red-600">{loadError}</p>
                        <button
                          type="button"
                          onClick={retryLoad}
                          className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-red-600"
                        >
                          <RefreshCw size={12} /> Retry
                        </button>
                      </td>
                    </tr>
                  ) : entries.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="py-12 text-center">
                        <ShieldCheck size={32} className="mx-auto text-slate-200 mb-2" />
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">No Personnel Enrolled Currently</p>
                      </td>
                    </tr>
                  ) : (
                    entries.map((entry) => (
                      <tr key={entry._id} className="hover:bg-red-50/10 transition-colors group">
                        <td className="py-5 px-8">
                          <span className="text-md font-black text-slate-800 uppercase italic tracking-tight group-hover:text-red-600 transition-colors">
                            {entry.name}
                          </span>
                        </td>
                        <td className="py-5 px-6 text-center">
                          <span className="inline-block px-3 py-1 bg-slate-100 rounded-lg text-xs font-black italic text-slate-700 tracking-wide border border-slate-200/40">
                            {entry.jerseySize || "—"}
                          </span>
                        </td>
                        <td className="py-5 px-6 text-center text-xs font-bold text-slate-400">
                          {formatTimestamp(entry.createdAt)}
                        </td>
                        <td className="py-5 px-8 text-right">
                          <button
                            onClick={() => handleDelete(entry._id)}
                            disabled={deletingId === entry._id}
                            className="p-2.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50"
                            title="Remove Employee"
                            aria-label={`Remove ${entry.name}`}
                          >
                            {deletingId === entry._id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ClientRelationship;
