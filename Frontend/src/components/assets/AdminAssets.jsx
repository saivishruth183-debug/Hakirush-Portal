import React, { useState, useEffect } from "react";
import axios from "axios";
import { Laptop, Monitor, Smartphone, Key, Fingerprint, Plus, Search, CheckCircle2, ShieldAlert } from "lucide-react";
import { apiErrorMessage } from "../../utils/apiError";

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

  useEffect(() => {
    fetchAssets();
    fetchEmployees();
  }, []);

  const fetchAssets = async () => {
    try {
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
    try {
      await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/asset/add`, formData, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setShowAdd(false);
      setFormData({ name: "", assetType: "Laptop", serialNumber: "", notes: "" });
      fetchAssets();
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    const empId = e.target.employeeId.value;
    if (!empId) return;
    try {
      await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/asset/${showAssign}/assign`, { employeeId: empId }, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setShowAssign(null);
      fetchAssets();
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  };

  const handleReturn = async (id) => {
    if (!window.confirm("Mark this asset as returned?")) return;
    try {
      await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/asset/${id}/return`, { status: "Available" }, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      fetchAssets();
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  };

  const getIcon = (type) => {
    switch(type) {
      case "Laptop": return <Laptop size={20} />;
      case "Monitor": return <Monitor size={20} />;
      case "Mobile": return <Smartphone size={20} />;
      case "ID Card": return <Fingerprint size={20} />;
      case "Keys": return <Key size={20} />;
      default: return <Laptop size={20} />;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto font-sans">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-[#1C1A17]">Company <span className="text-[#B8912E]">Assets</span></h1>
          <p className="text-xs font-bold uppercase tracking-widest text-[#8A8478] mt-1">Equipment Tracker</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-[#1C1A17] text-[#F6F3EC] px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-[#B8912E] hover:text-[#1C1A17] transition-all">
          <Plus size={16} /> New Asset
        </button>
      </div>

      {loading ? (
        <div className="text-center p-10 font-black uppercase tracking-widest text-[#8A8478]">Loading vault...</div>
      ) : (
        <div className="bg-white rounded-[2.5rem] border border-[#E7E1D3] p-8 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-[#E7E1D3]">
                  <th className="pb-4 px-4 text-[10px] font-black uppercase tracking-widest text-[#8A8478]">Asset Details</th>
                  <th className="pb-4 px-4 text-[10px] font-black uppercase tracking-widest text-[#8A8478]">Serial #</th>
                  <th className="pb-4 px-4 text-[10px] font-black uppercase tracking-widest text-[#8A8478]">Status</th>
                  <th className="pb-4 px-4 text-[10px] font-black uppercase tracking-widest text-[#8A8478]">Assigned To</th>
                  <th className="pb-4 px-4 text-[10px] font-black uppercase tracking-widest text-[#8A8478] text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset._id} className="border-b border-[#E7E1D3]/50 hover:bg-[#FBF3E3]/30 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-[#F6F3EC] rounded-xl flex items-center justify-center text-[#B8912E]">
                          {getIcon(asset.assetType)}
                        </div>
                        <div>
                          <p className="font-bold text-[#1C1A17] text-sm">{asset.name}</p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[#8A8478]">{asset.assetType}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-xs font-mono text-[#8A8478]">{asset.serialNumber || "N/A"}</td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        asset.status === "Assigned" ? "bg-[#3F6B52]/10 text-[#3F6B52]" : 
                        asset.status === "Available" ? "bg-[#B8912E]/10 text-[#B8912E]" : 
                        "bg-[#A24A32]/10 text-[#A24A32]"
                      }`}>
                        {asset.status}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      {asset.assignedTo ? (
                        <div className="flex items-center gap-2">
                          <img src={asset.assignedTo.userId?.profileImage || "https://ui-avatars.com/api/?name=User"} className="h-6 w-6 rounded-full" alt="avatar" />
                          <span className="text-xs font-bold text-[#1C1A17]">{asset.assignedTo.userId?.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-[#D6D0BF]">Unassigned</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      {asset.status === "Available" ? (
                        <button onClick={() => setShowAssign(asset._id)} className="bg-[#B8912E]/10 text-[#B8912E] hover:bg-[#B8912E] hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors">
                          Assign
                        </button>
                      ) : asset.status === "Assigned" ? (
                        <button onClick={() => handleReturn(asset._id)} className="bg-[#1C1A17]/5 text-[#1C1A17] hover:bg-[#1C1A17] hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors">
                          Return
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-black uppercase tracking-tighter text-[#1C1A17] mb-6">Add Asset</h2>
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[#8A8478] ml-1">Asset Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-[#F6F3EC] border border-[#E7E1D3] rounded-2xl px-5 py-3 text-xs font-bold outline-none mt-1" placeholder="e.g. MacBook Pro M3" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[#8A8478] ml-1">Type</label>
                <select value={formData.assetType} onChange={e => setFormData({...formData, assetType: e.target.value})} className="w-full bg-[#F6F3EC] border border-[#E7E1D3] rounded-2xl px-5 py-3 text-xs font-bold outline-none mt-1">
                  <option value="Laptop">Laptop</option>
                  <option value="Monitor">Monitor</option>
                  <option value="Mobile">Mobile</option>
                  <option value="ID Card">ID Card</option>
                  <option value="Keys">Keys</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[#8A8478] ml-1">Serial Number (Optional)</label>
                <input type="text" value={formData.serialNumber} onChange={e => setFormData({...formData, serialNumber: e.target.value})} className="w-full bg-[#F6F3EC] border border-[#E7E1D3] rounded-2xl px-5 py-3 text-xs font-mono outline-none mt-1" />
              </div>
              <div className="flex gap-4 mt-8">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 bg-[#F6F3EC] text-[#1C1A17] py-4 rounded-xl font-black uppercase tracking-widest text-[10px]">Cancel</button>
                <button type="submit" className="flex-1 bg-[#B8912E] text-white py-4 rounded-xl font-black uppercase tracking-widest text-[10px]">Save Asset</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-black uppercase tracking-tighter text-[#1C1A17] mb-6">Assign Asset</h2>
            <form onSubmit={handleAssign} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-[#8A8478] ml-1">Select Employee</label>
                <select name="employeeId" required className="w-full bg-[#F6F3EC] border border-[#E7E1D3] rounded-2xl px-5 py-3 text-xs font-bold outline-none mt-1">
                  <option value="">-- Choose Employee --</option>
                  {employees.map(e => (
                    <option key={e._id} value={e._id}>{e.employeeId} - {e.userId?.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-4 mt-8">
                <button type="button" onClick={() => setShowAssign(null)} className="flex-1 bg-[#F6F3EC] text-[#1C1A17] py-4 rounded-xl font-black uppercase tracking-widest text-[10px]">Cancel</button>
                <button type="submit" className="flex-1 bg-[#1C1A17] text-[#F6F3EC] py-4 rounded-xl font-black uppercase tracking-widest text-[10px]">Confirm Assignment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAssets;
