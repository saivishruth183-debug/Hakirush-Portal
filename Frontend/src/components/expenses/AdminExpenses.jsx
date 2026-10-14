import React, { useState, useEffect } from "react";
import axios from "axios";
import { Receipt, Check, X, Clock, CheckCircle, ArrowUpRight, XCircle, Image as ImageIcon, Filter, Trash2 } from "lucide-react";
import { apiErrorMessage, authHeaders } from "../../utils/apiError";

const BACKEND = import.meta.env.VITE_BACKEND_URL || "";

const AdminExpenses = () => {
  const [claims, setClaims] = useState([]);
  const [filterStatus, setFilterStatus] = useState("All");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [msg, setMsg] = useState("");

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
        fetchClaims();
      }
    } catch (err) {
      alert(apiErrorMessage(err, `Failed to ${decision.toLowerCase()} claim`));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (claimId) => {
    if (!window.confirm("Are you sure you want to delete this expense claim? This cannot be undone.")) return;
    try {
      setActionLoading(claimId);
      const res = await axios.delete(`${BACKEND}/api/expenses/${claimId}`, {
        headers: authHeaders(),
      });
      if (res.data.success) {
        setMsg("Expense claim deleted successfully.");
        fetchClaims();
      }
    } catch (err) {
      alert(apiErrorMessage(err, "Failed to delete expense claim"));
    } finally {
      setActionLoading(null);
    }
  };

  const filteredClaims = claims.filter((c) => {
    if (filterStatus === "All") return true;
    return c.status === filterStatus;
  });

  const pendingCount = claims.filter((c) => c.status === "Pending").length;
  const approvedTotal = claims
    .filter((c) => c.status === "Approved")
    .reduce((s, c) => s + (c.amount || 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1A17]">Employee Expense Claims Review</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review and approve claims. Approved amounts are automatically bundled into the employee's next payslip.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {["All", "Pending", "Approved", "Reimbursed", "Rejected"].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filterStatus === st
                  ? "bg-[#7A2233] text-white shadow-xs"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {st} {st === "Pending" && pendingCount > 0 && `(${pendingCount})`}
            </button>
          ))}
        </div>
      </div>

      {msg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center justify-between">
          <span>{msg}</span>
          <button onClick={() => setMsg("")} className="font-bold text-emerald-600">&times;</button>
        </div>
      )}

      {/* QUICK METRICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 bg-white border border-[#E7E1D3] rounded-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-amber-700 uppercase">Pending Review</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{pendingCount} claims</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
            <Clock size={20} />
          </div>
        </div>

        <div className="p-4 bg-white border border-[#E7E1D3] rounded-xl flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-emerald-700 uppercase">Approved for Next Payroll</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1">₹{approvedTotal.toLocaleString("en-IN")}</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <CheckCircle size={20} />
          </div>
        </div>
      </div>

      {/* CLAIMS TABLE */}
      <div className="bg-white border border-[#E7E1D3] rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading claims...</div>
        ) : filteredClaims.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-sm">No claims found under this filter.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#FAF8F5] text-xs font-semibold text-gray-600 uppercase border-b border-[#E7E1D3]">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Expense Title</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Receipt</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredClaims.map((c) => {
                  const empName = c.employeeId?.userId?.name || "Staff";
                  const empCode = c.employeeId?.employeeId || "";
                  const dept = c.employeeId?.department?.dep_name || "";

                  return (
                    <tr key={c._id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900">{empName}</div>
                        <div className="text-xs text-gray-500">{empCode} • {dept}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">{c.title}</div>
                        {c.description && <div className="text-xs text-gray-500 line-clamp-1">{c.description}</div>}
                      </td>
                      <td className="py-3 px-4 text-xs text-gray-600">{c.category}</td>
                      <td className="py-3 px-4 font-bold text-gray-900">₹{c.amount.toLocaleString("en-IN")}</td>
                      <td className="py-3 px-4 text-xs text-gray-500">{c.date}</td>
                      <td className="py-3 px-4">
                        {c.receiptUrl ? (
                          <a
                            href={c.receiptUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-[#7A2233] hover:underline font-medium"
                          >
                            <ImageIcon size={13} /> View
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">None</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          c.status === "Approved" ? "bg-emerald-50 text-emerald-700" :
                          c.status === "Reimbursed" ? "bg-blue-50 text-blue-700" :
                          c.status === "Rejected" ? "bg-rose-50 text-rose-700" :
                          "bg-amber-50 text-amber-700"
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {c.status === "Pending" ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              disabled={actionLoading === c._id}
                              onClick={() => handleReview(c._id, "Approved")}
                              className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md flex items-center gap-1 shadow-xs transition-colors"
                            >
                              <Check size={12} /> Approve
                            </button>
                            <button
                              disabled={actionLoading === c._id}
                              onClick={() => handleReview(c._id, "Rejected")}
                              className="px-2.5 py-1 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-md flex items-center gap-1 shadow-xs transition-colors"
                            >
                              <X size={12} /> Reject
                            </button>
                            <button
                              disabled={actionLoading === c._id}
                              onClick={() => handleDelete(c._id)}
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                              title="Delete claim"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ) : c.status === "Reimbursed" ? (
                          <span className="text-xs text-gray-400">Locked</span>
                        ) : (
                          <button
                            disabled={actionLoading === c._id}
                            onClick={() => handleDelete(c._id)}
                            className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-md flex items-center gap-1 transition-colors"
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminExpenses;
