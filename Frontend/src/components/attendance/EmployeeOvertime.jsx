import React, { useState, useEffect } from "react";
import axios from "axios";
import { Clock, CheckCircle, Plus, Calendar, DollarSign, Award, XCircle, Trash2 } from "lucide-react";
import { apiErrorMessage, authHeaders } from "../../utils/apiError";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "";

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

  const handleDelete = async (requestId) => {
    if (!window.confirm("Are you sure you want to withdraw this overtime request? This cannot be undone.")) return;
    try {
      const res = await axios.delete(`${BACKEND}/api/overtime/${requestId}`, {
        headers: authHeaders(),
      });
      if (res.data.success) {
        setMsg("Overtime request withdrawn successfully.");
        fetchData();
      }
    } catch (err) {
      alert(apiErrorMessage(err, "Failed to withdraw overtime request"));
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1A17]">Overtime & Comp-Off Tracking</h1>
          <p className="text-sm text-gray-500 mt-1">
            Extra hours beyond the 8-hour workday are automatically calculated. Convert them to Comp-off leave or cash payout.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          disabled={data.availableHours <= 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#7A2233] hover:bg-[#601a27] text-white text-sm font-medium rounded-lg shadow-sm transition-all disabled:opacity-50"
        >
          <Plus size={16} /> Claim Overtime
        </button>
      </div>

      {msg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center justify-between">
          <span>{msg}</span>
          <button onClick={() => setMsg("")} className="font-bold text-emerald-600">&times;</button>
        </div>
      )}

      {/* METRIC TILES */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white border border-[#E7E1D3] rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Total OT Earned</span>
            <Clock size={18} className="text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{data.totalEarnedHours} hrs</div>
          <div className="text-xs text-gray-400 mt-1">Calculated beyond 8h shifts</div>
        </div>

        <div className="p-5 bg-white border border-[#E7E1D3] rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase">Claimed / Redeemed</span>
            <Award size={18} className="text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">{data.claimedHours} hrs</div>
          <div className="text-xs text-gray-400 mt-1">Converted to Comp-Off or Payout</div>
        </div>

        <div className="p-5 bg-white border border-[#E7E1D3] rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 uppercase">Available OT Balance</span>
            <CheckCircle size={18} className="text-emerald-600" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-700 mt-2">{data.availableHours} hrs</div>
          <div className="text-xs text-emerald-600 mt-1">
            {data.availableHours >= 8 ? "Eligible for 1+ Comp-Off Days!" : "Keep up the great work"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RECENT OT DAYS */}
        <div className="bg-white border border-[#E7E1D3] rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-[#E7E1D3] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Days with Overtime Hours</h2>
            <span className="text-xs text-gray-500">{data.recentOvertimeDays.length} records</span>
          </div>

          {loading ? (
            <div className="p-6 text-center text-xs text-gray-500">Loading records...</div>
          ) : data.recentOvertimeDays.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">No overtime recorded yet. Extra hours will appear here automatically when you check out past 8 hours.</div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {data.recentOvertimeDays.map((d) => (
                <div key={d._id} className="p-3.5 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs">
                      OT
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-900">{d.date}</div>
                      <div className="text-[11px] text-gray-400">Total Worked: {d.workedHours}h</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
                      +{d.overtimeHours} hrs
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CLAIM HISTORY */}
        <div className="bg-white border border-[#E7E1D3] rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-[#E7E1D3] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Your OT Claims & Comp-Off Requests</h2>
            <span className="text-xs text-gray-500">{data.requests.length} requests</span>
          </div>

          {loading ? (
            <div className="p-6 text-center text-xs text-gray-500">Loading requests...</div>
          ) : data.requests.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">No requests submitted yet.</div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {data.requests.map((r) => (
                <div key={r._id} className="p-3.5 flex items-center justify-between hover:bg-gray-50">
                  <div>
                    <div className="text-xs font-semibold text-gray-900 flex items-center gap-2">
                      <span>{r.type}</span>
                      <span className="text-gray-500 font-normal">({r.hours} hours)</span>
                    </div>
                    {r.reason && <div className="text-[11px] text-gray-500 mt-0.5">{r.reason}</div>}
                  </div>
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                    r.status === "Approved" ? "bg-emerald-50 text-emerald-700" :
                    r.status === "Rejected" ? "bg-rose-50 text-rose-700" :
                    "bg-amber-50 text-amber-700"
                  }`}>
                    {r.status}
                  </span>
                  <button
                    onClick={() => handleDelete(r._id)}
                    className="ml-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[11px] font-medium text-rose-600 hover:bg-rose-50 rounded transition-colors"
                    title="Withdraw this request"
                  >
                    <Trash2 size={11} /> Withdraw
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* APPLY MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-gray-100">
            <div className="px-6 py-4 bg-[#7A2233] text-white flex items-center justify-between">
              <h3 className="font-semibold text-sm">Convert Overtime Hours</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-white/80 hover:text-white font-bold">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg">{error}</div>}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Conversion Mode</label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`p-3 border rounded-lg cursor-pointer text-center text-xs font-medium transition-all ${
                    formData.type === "Comp-Off" ? "border-[#7A2233] bg-[#7A2233]/5 text-[#7A2233] font-bold" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}>
                    <input
                      type="radio"
                      name="type"
                      value="Comp-Off"
                      className="hidden"
                      checked={formData.type === "Comp-Off"}
                      onChange={() => setFormData({ ...formData, type: "Comp-Off" })}
                    />
                    🏖️ Comp-Off Leave Day
                  </label>

                  <label className={`p-3 border rounded-lg cursor-pointer text-center text-xs font-medium transition-all ${
                    formData.type === "Payout" ? "border-[#7A2233] bg-[#7A2233]/5 text-[#7A2233] font-bold" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}>
                    <input
                      type="radio"
                      name="type"
                      value="Payout"
                      className="hidden"
                      checked={formData.type === "Payout"}
                      onChange={() => setFormData({ ...formData, type: "Payout" })}
                    />
                    💵 Cash OT Payout
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Hours to Claim (Available: {data.availableHours}h)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max={data.availableHours}
                  required
                  value={formData.hours}
                  onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7A2233]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Reason / Notes</label>
                <textarea
                  rows="2"
                  placeholder="e.g. Weekend sprint deployment coverage"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7A2233]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-medium bg-[#7A2233] hover:bg-[#601a27] text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {submitting ? "Submitting..." : "Confirm Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeOvertime;
