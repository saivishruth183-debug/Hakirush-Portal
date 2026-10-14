import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Plus, Receipt, CheckCircle, Clock, XCircle, ArrowUpRight, FileText, Image as ImageIcon, Trash2 } from "lucide-react";
import { apiErrorMessage, authHeaders } from "../../utils/apiError";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "";

const CATEGORIES = [
  "Travel",
  "Client Lunches / Meals",
  "Equipment",
  "Office Supplies",
  "Internet / Utilities",
  "Other",
];

const EmployeeExpenses = () => {
  const [claims, setClaims] = useState([]);
  const [summary, setSummary] = useState({ totalSubmitted: 0, totalApproved: 0, totalReimbursed: 0 });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    title: "",
    category: "Travel",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    description: "",
    receipt: null,
  });

  const resetForm = () => {
    setFormData({
      title: "",
      category: "Travel",
      amount: "",
      date: new Date().toISOString().slice(0, 10),
      description: "",
      receipt: null,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const fetchClaims = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${BACKEND}/api/expenses/me`, {
        headers: authHeaders(),
      });
      if (res.data.success) {
        setClaims(res.data.claims || []);
        setSummary({
          totalSubmitted: res.data.totalSubmitted || 0,
          totalApproved: res.data.totalApproved || 0,
          totalReimbursed: res.data.totalReimbursed || 0,
        });
      }
    } catch (err) {
      console.error("Failed to load expense claims:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!formData.receipt) {
      setError("Please upload a bill or receipt photo.");
      return;
    }

    setSubmitting(true);

    try {
      const data = new FormData();
      data.append("title", formData.title);
      data.append("category", formData.category);
      data.append("amount", formData.amount);
      data.append("date", formData.date);
      data.append("description", formData.description);
      data.append("receipt", formData.receipt);

      const res = await axios.post(`${BACKEND}/api/expenses`, data, {
        headers: {
          ...authHeaders(),
          "Content-Type": "multipart/form-data",
        },
      });

      if (res.data.success) {
        setSuccessMsg(res.data.message || "Expense claim submitted successfully!");
        setIsModalOpen(false);
        resetForm();
        fetchClaims();
      }
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to submit expense claim"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (claimId) => {
    if (!window.confirm("Are you sure you want to delete this expense claim? This cannot be undone.")) return;
    try {
      const res = await axios.delete(`${BACKEND}/api/expenses/${claimId}`, {
        headers: authHeaders(),
      });
      if (res.data.success) {
        setSuccessMsg("Expense claim deleted successfully.");
        fetchClaims();
      }
    } catch (err) {
      alert(apiErrorMessage(err, "Failed to delete expense claim"));
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "Approved":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle size={12} /> Approved</span>;
      case "Reimbursed":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200"><ArrowUpRight size={12} /> Reimbursed</span>;
      case "Rejected":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-200"><XCircle size={12} /> Rejected</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200"><Clock size={12} /> Pending</span>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1A17]">Expense Claims & Reimbursements</h1>
          <p className="text-sm text-gray-500 mt-1">
            Fast, simple expense reporting. Approved claims are automatically added to your monthly payslip.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#7A2233] hover:bg-[#601a27] text-white text-sm font-medium rounded-lg shadow-sm transition-all"
        >
          <Plus size={16} /> New Expense Claim
        </button>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg("")} className="text-emerald-600 font-bold">&times;</button>
        </div>
      )}

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white border border-[#E7E1D3] rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Submitted</span>
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
              <Receipt size={16} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-[#1C1A17]">₹{summary.totalSubmitted.toLocaleString("en-IN")}</div>
          <div className="text-xs text-gray-400 mt-1">{claims.length} claims filed</div>
        </div>

        <div className="p-5 bg-white border border-[#E7E1D3] rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">Approved (Ready for Payslip)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
              <CheckCircle size={16} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-emerald-700">₹{summary.totalApproved.toLocaleString("en-IN")}</div>
          <div className="text-xs text-emerald-600 mt-1">Will be credited in payroll</div>
        </div>

        <div className="p-5 bg-white border border-[#E7E1D3] rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Paid / Reimbursed</span>
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
              <ArrowUpRight size={16} />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-blue-700">₹{summary.totalReimbursed.toLocaleString("en-IN")}</div>
          <div className="text-xs text-blue-600 mt-1">Paid in past payslips</div>
        </div>
      </div>

      {/* CLAIMS TABLE */}
      <div className="bg-white border border-[#E7E1D3] rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E7E1D3] flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 text-sm">Your Recent Expense Claims</h2>
          <span className="text-xs text-gray-500">{claims.length} records</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading expense claims...</div>
        ) : claims.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="mx-auto h-10 w-10 text-gray-300" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900">No expense claims filed yet</h3>
            <p className="mt-1 text-xs text-gray-500">Upload bills for travel, client lunches, or equipment to get reimbursed.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#FAF8F5] text-xs font-semibold text-gray-600 uppercase border-b border-[#E7E1D3]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Title & Details</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Receipt</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {claims.map((c) => (
                  <tr key={c._id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-gray-600">{c.date}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">{c.title}</div>
                      {c.description && <div className="text-xs text-gray-500 line-clamp-1">{c.description}</div>}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-gray-600 text-xs">{c.category}</td>
                    <td className="py-3 px-4 whitespace-nowrap font-semibold text-gray-900">₹{c.amount.toLocaleString("en-IN")}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {c.receiptUrl ? (
                        <a
                          href={c.receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-[#7A2233] hover:underline font-medium"
                        >
                          <ImageIcon size={13} /> View Bill
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">No bill</span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">{getStatusBadge(c.status)}</td>
                    <td className="py-3 px-4 whitespace-nowrap text-right">
                      {c.status !== "Reimbursed" ? (
                        <button
                          onClick={() => handleDelete(c._id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                          title="Delete this claim"
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">Locked</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SIMPLE CLAIM MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-[#7A2233] text-white flex items-center justify-between">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Receipt size={18} /> File Expense Claim
              </h3>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className="text-white/80 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg">{error}</div>}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Expense Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Flight ticket to Bangalore client meeting"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7A2233]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7A2233]"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g. 2500"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7A2233]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Expense Date *</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7A2233]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Bill / Receipt Photo *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  required
                  accept="image/*,application/pdf"
                  onChange={(e) => setFormData({ ...formData, receipt: e.target.files[0] || null })}
                  className="w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Notes / Description (Optional)</label>
                <textarea
                  rows="2"
                  placeholder="Additional context or purpose of expenditure"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7A2233]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-medium bg-[#7A2233] hover:bg-[#601a27] text-white rounded-lg transition-colors disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Submit Claim"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeExpenses;
