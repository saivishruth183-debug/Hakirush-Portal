import axios from "axios";
import React, { useCallback, useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  UploadCloud, CheckCircle2, AlertTriangle, ArrowLeft, ShieldCheck,
  History, FileText, Wallet, Activity, Receipt
} from "lucide-react";
import { apiErrorMessage } from "../../utils/apiError";
import { openPayslip, payslipHasFile } from "../../utils/payslipFiles";

// Mirrors Backend/models/Payslip.js input fields (computed fields are server-side).
const EARNING_FIELDS = [
  ["basicSalary", "Basic Salary"],
  ["hra", "HRA"],
  ["conveyanceAllowance", "Conveyance Allowance"],
  ["medicalAllowance", "Medical Allowance"],
  ["otherAllowances", "Other Allowances"],
  ["bonus", "Bonus"],
  ["reimbursements", "Reimbursements"],
];
const OVERTIME_FIELDS = [
  ["overtimeHours", "Overtime Hours"],
  ["overtimeRate", "Overtime Rate (per hour)"],
];
const DEDUCTION_FIELDS = [
  ["providentFund", "Provident Fund"],
  ["professionalTax", "Professional Tax"],
  ["incomeTax", "Income Tax"],
  ["lossOfPay", "Loss of Pay"],
  ["otherDeductions", "Other Deductions"],
];
const NUMERIC_FIELDS = [...EARNING_FIELDS, ...OVERTIME_FIELDS, ...DEDUCTION_FIELDS].map(([k]) => k);
const MAX_PDF_BYTES = 5 * 1024 * 1024;

const emptyForm = () => ({
  month: "",
  paymentStatus: "Paid",
  paymentDate: "",
  ...Object.fromEntries(NUMERIC_FIELDS.map((k) => [k, ""])),
});

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const INK = "#1C1A17";
const GARNET = "#7A2233";
const GOLD = "#B8912E";
const SAGE = "#3F6B52";
const RUST = "#A24A32";

/* ===== SHARED STATUS ALERT COMPONENT (success + error) ===== */
const StatusAlert = ({ variant = "success", title, message, onClose }) => {
  const isError = variant === "error";
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300" />
      <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl border border-[#E7E1D3] p-8 text-center motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-300">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{
            backgroundColor: isError ? "#F7EAE6" : "#EEF3EE",
            color: isError ? RUST : SAGE
          }}
        >
          {isError ? <AlertTriangle size={40} strokeWidth={2.5} /> : <CheckCircle2 size={40} strokeWidth={2.5} />}
        </div>
        <h3 className="text-2xl font-black uppercase tracking-tighter text-[#1C1A17]">{title}</h3>
        <p className="text-[11px] font-bold uppercase tracking-widest text-[#8A8478] mt-2 mb-8">
          {message}
        </p>
        <button
          onClick={onClose}
          className="w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-md cursor-pointer"
          style={{
            backgroundColor: isError ? RUST : INK,
            color: "#F6F3EC"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = GOLD; e.currentTarget.style.color = INK; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = isError ? RUST : INK; e.currentTarget.style.color = "#F6F3EC"; }}
        >
          {isError ? "Try Again" : "Dismiss Ledger"}
        </button>
      </div>
    </div>
  );
};

const AddPayslip = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [alertState, setAlertState] = useState(null); // { variant, title, message } | null
  const [history, setHistory] = useState([]);
  const [fetchingHistory, setFetchingHistory] = useState(true);

  const [form, setForm] = useState(emptyForm);
  // Totals returned by the server for the last posted payslip (authoritative)
  const [posted, setPosted] = useState(null);
  const [historyError, setHistoryError] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/payslip/employee/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setHistory(res.data.payslips || []);
      setHistoryError("");
    } catch (err) {
      console.error(err);
      setHistoryError(apiErrorMessage(err, "Couldn't load payslip history."));
    }
    finally { setFetchingHistory(false); }
  }, [id]);

  useEffect(() => { if (id) fetchHistory(); }, [id, fetchHistory]);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    // Server also checks the %PDF signature; some browsers report an empty MIME type.
    const looksPdf = (selected.type === "application/pdf" || selected.type === "") && /\.pdf$/i.test(selected.name);
    if (!looksPdf) {
      setAlertState({
        variant: "error",
        title: "Wrong Format",
        message: "Only PDF statements are accepted. Please select a .pdf file."
      });
      e.target.value = "";
      return;
    }
    if (selected.size > MAX_PDF_BYTES) {
      setAlertState({
        variant: "error",
        title: "File Too Large",
        message: "Payslip PDFs must be 5 MB or smaller."
      });
      e.target.value = "";
      return;
    }
    setFile(selected);
  };

  const handleAutoGenerate = async () => {
    if (loading) return;
    if (!/^\d{4}-\d{2}$/.test(form.month)) {
      setAlertState({ variant: "error", title: "Missing Month", message: "Choose the payroll month first." });
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/payslip/auto-generate`, 
        { month: form.month, employeeId: id }, 
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
      
      if (res.data.success) {
        const p = res.data.payslip || {};
        setPosted({
          month: p.month || form.month,
          overtimePay: p.overtimePay,
          grossSalary: p.grossSalary,
          totalDeductions: p.totalDeductions,
          netSalary: p.netSalary,
        });
        setAlertState({
          variant: "success",
          title: "Auto-Generated!",
          message: `Payslip PDF generated & posted. Server-calculated net pay: ${inr(p.netSalary)}.`
        });
        fetchHistory();
        setForm(emptyForm());
      }
    } catch (err) {
      setAlertState({
        variant: "error",
        title: "Auto-Generate Failed",
        message: apiErrorMessage(err, "The payslip could not be auto-generated. Please check if they have a base salary set.")
      });
    } finally {
      setLoading(false);
    }
  };

  // Client-side ESTIMATE only - the server computes the stored totals.
  const calculations = useMemo(() => {
    const n = (k) => Number(form[k] || 0);
    const overtimePay = n("overtimeHours") * n("overtimeRate");
    const gross = ["basicSalary", "hra", "conveyanceAllowance", "medicalAllowance", "otherAllowances", "bonus", "reimbursements"]
      .reduce((acc, k) => acc + n(k), 0) + overtimePay;
    const ded = DEDUCTION_FIELDS.reduce((acc, [k]) => acc + n(k), 0);
    return { overtimePay, gross, ded, net: gross - ded };
  }, [form]);

  const validate = () => {
    if (!/^\d{4}-\d{2}$/.test(form.month)) return "Choose the payroll month.";
    if (!(Number(form.basicSalary) > 0)) return "Basic salary must be greater than 0.";
    for (const k of NUMERIC_FIELDS) {
      const v = form[k];
      if (v !== "" && (!Number.isFinite(Number(v)) || Number(v) < 0)) return "Amounts cannot be negative.";
    }
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    const problem = validate();
    if (problem) {
      setAlertState({ variant: "error", title: "Check The Form", message: problem });
      return;
    }
    if (!file) {
      setAlertState({
        variant: "error",
        title: "Missing Statement",
        message: "Please upload the PDF payslip before finalizing."
      });
      return;
    }
    setLoading(true);
    const formData = new FormData();
    formData.append("month", form.month); // YYYY-MM
    formData.append("paymentStatus", form.paymentStatus);
    if (form.paymentStatus === "Paid" && form.paymentDate) formData.append("paymentDate", form.paymentDate);
    NUMERIC_FIELDS.forEach((k) => formData.append(k, form[k] === "" ? "0" : String(Number(form[k]))));
    formData.append("employeeId", id);
    formData.append("payslip", file);

    try {
      const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/payslip/add`, formData, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.data.success) {
        const p = res.data.payslip || {};
        setPosted({
          month: p.month || form.month,
          overtimePay: p.overtimePay,
          grossSalary: p.grossSalary,
          totalDeductions: p.totalDeductions,
          netSalary: p.netSalary,
        });
        setAlertState({
          variant: "success",
          title: "Vaulted!",
          message: p.netSalary !== undefined
            ? `Statement posted. Server-calculated net pay: ${inr(p.netSalary)}.`
            : "Financial statement has been securely posted."
        });
        fetchHistory();
        setForm(emptyForm());
        setFile(null);
        setFileInputKey((k) => k + 1);
      }
    } catch (err) {
      setAlertState({
        variant: "error",
        title: "Posting Failed",
        message: apiErrorMessage(err, "The statement could not be committed. Please try again.")
      });
    }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#F6F3EC] text-[#1C1A17] font-sans">
      {alertState && (
        <StatusAlert
          variant={alertState.variant}
          title={alertState.title}
          message={alertState.message}
          onClose={() => setAlertState(null)}
        />
      )}

      <nav className="top-0 px-6 py-3 flex justify-between items-center z-50">
        <button onClick={() => navigate(-1)} className="group px-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#8A8478] hover:text-[#B8912E] transition-all cursor-pointer pt-5">
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform"/> Back
        </button>
        <div className="flex items-center gap-2 pt-5">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#8A8478]">Secure Node</span>
          <ShieldCheck size={16} style={{ color: SAGE }} />
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* LEFT: FORM SECTION */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-end gap-3">
               <h1 className="text-3xl font-black uppercase tracking-tighter">Issue <span className="text-[#B8912E]">Statement</span></h1>
               <Activity size={20} className="mb-1 text-[#D6D0BF] motion-safe:animate-pulse" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-white rounded-[2.5rem] border border-[#E7E1D3] p-8 shadow-sm space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input label="Payroll Month" name="month" type="month" value={form.month} onChange={handleChange} required placeholder="" />
                  <div className="group space-y-2">
                    <label htmlFor="paymentStatus" className="text-[9px] font-black uppercase tracking-widest text-[#8A8478] ml-1">Payment Status</label>
                    <select
                      id="paymentStatus"
                      name="paymentStatus"
                      value={form.paymentStatus}
                      onChange={handleChange}
                      className="w-full bg-[#F6F3EC] border border-[#E7E1D3] rounded-2xl px-5 py-3.5 text-xs font-black tracking-tight outline-none text-[#1C1A17] focus:bg-white focus:border-[#B8912E]"
                    >
                      <option value="Paid">Paid</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>
                  {form.paymentStatus === "Paid" && (
                    <Input label="Payment Date (optional)" name="paymentDate" type="date" value={form.paymentDate} onChange={handleChange} placeholder="" />
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
                  <div className="space-y-4">
                    <SectionLabel icon={<Wallet size={12}/>} title="Earnings" />
                    {EARNING_FIELDS.map(([name, label]) => (
                      <Input
                        key={name}
                        label={label}
                        name={name}
                        type="number"
                        min="0"
                        step="0.01"
                        value={form[name]}
                        onChange={handleChange}
                        required={name === "basicSalary"}
                      />
                    ))}
                    <SectionLabel icon={<Activity size={12}/>} title="Overtime" />
                    {OVERTIME_FIELDS.map(([name, label]) => (
                      <Input key={name} label={label} name={name} type="number" min="0" step="0.01" value={form[name]} onChange={handleChange} />
                    ))}
                  </div>

                  <div className="space-y-4">
                    <SectionLabel icon={<Receipt size={12}/>} title="Deductions" color="text-[#A24A32]" />
                    {DEDUCTION_FIELDS.map(([name, label]) => (
                      <Input key={name} label={label} name={name} type="number" min="0" step="0.01" value={form[name]} onChange={handleChange} />
                    ))}
                  </div>
                </div>

                <div className="group relative border-2 border-dashed border-[#E7E1D3] rounded-[2rem] p-6 text-center transition-all hover:border-[#B8912E] hover:bg-[#FBF3E3]/30">
                  <input
                    key={fileInputKey}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={handleFileChange}
                  />
                  <UploadCloud size={24} className="mx-auto text-[#D6D0BF] mb-2 group-hover:text-[#B8912E] transition-colors" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#8A8478] group-hover:text-[#9C7A22] transition-colors">
                    {file ? file.name : "Drop PDF Statement"}
                  </p>
                  <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-[#C9C2AE]">PDF only · max 5 MB</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button type="button" onClick={handleAutoGenerate} disabled={loading} className="w-full bg-[#3F6B52] text-[#F6F3EC] py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-md hover:bg-[#B8912E] hover:text-[#1C1A17] transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">
                  {loading ? "PROCESSING..." : "Auto-Generate PDF"}
                </button>
                <button type="submit" disabled={loading} className="w-full bg-[#1C1A17] text-[#F6F3EC] py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-md hover:bg-[#B8912E] hover:text-[#1C1A17] transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">
                  {loading ? "COMMITTING DATA..." : "Manual Post"}
                </button>
              </div>
            </form>
          </div>

          {/* RIGHT: LIVE LEDGER & HISTORY */}
          <div className="lg:col-span-5 space-y-6">
            <div
              className="sticky top-24 rounded-[2.5rem] p-8 text-[#F6F3EC] shadow-2xl relative overflow-hidden"
              style={{ background: `linear-gradient(155deg, ${INK} 0%, ${GARNET} 140%)` }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#B8912E]/10 rounded-full blur-3xl" />
              <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-[#B8912E]/70 mb-2 flex items-center gap-2">
                <Activity size={10}/> Estimate (preview)
              </h3>
              <p className="text-[10px] text-[#D6D0BF]/80 mb-6">
                Calculated in your browser. The server computes the official totals when the statement is posted.
              </p>

              <div className="space-y-5">
                {calculations.overtimePay > 0 && (
                  <div className="flex justify-between items-center border-b border-white/10 pb-3">
                    <span className="text-[10px] text-[#D6D0BF] uppercase font-bold tracking-widest">Overtime Pay (est.)</span>
                    <span className="text-base font-black tracking-tight">₹{calculations.overtimePay.toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="flex justify-between items-center border-b border-white/10 pb-3">
                  <span className="text-[10px] text-[#D6D0BF] uppercase font-bold tracking-widest">Gross (est.)</span>
                  <span className="text-xl font-black tracking-tight">₹{calculations.gross.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/10 pb-3 text-[#E08F73]">
                  <span className="text-[10px] uppercase font-bold tracking-widest">Total Deductions</span>
                  <span className="text-xl font-black tracking-tight">- ₹{calculations.ded.toLocaleString("en-IN")}</span>
                </div>
                <div className="pt-4 text-center">
                  <p className="text-[9px] font-black uppercase tracking-[0.4em] text-[#B8912E] mb-1">Estimated Net Pay</p>
                  <p className="text-5xl font-black tracking-tighter">₹{calculations.net.toLocaleString("en-IN")}</p>
                </div>
              </div>
            </div>

            {posted && (
              <section className="rounded-[2rem] border border-[#D7E4D9] bg-white p-6 shadow-sm">
                <h2 className="text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2 mb-4" style={{ color: SAGE }}>
                  <CheckCircle2 size={12} /> Posted · server-calculated totals ({posted.month})
                </h2>
                <dl className="space-y-2 text-xs font-bold">
                  {posted.overtimePay !== undefined && (
                    <div className="flex justify-between"><dt className="text-[#8A8478]">Overtime pay</dt><dd>{inr(posted.overtimePay)}</dd></div>
                  )}
                  <div className="flex justify-between"><dt className="text-[#8A8478]">Gross salary</dt><dd>{posted.grossSalary !== undefined ? inr(posted.grossSalary) : "—"}</dd></div>
                  <div className="flex justify-between"><dt className="text-[#8A8478]">Total deductions</dt><dd>{posted.totalDeductions !== undefined ? inr(posted.totalDeductions) : "—"}</dd></div>
                  <div className="flex justify-between text-sm font-black"><dt>Net salary</dt><dd>{posted.netSalary !== undefined ? inr(posted.netSalary) : "—"}</dd></div>
                </dl>
              </section>
            )}

            <section className="space-y-4">
              <h2 className="text-[9px] font-black uppercase tracking-[0.2em] text-[#8A8478] flex items-center gap-2 ml-2">
                <History size={12} /> Recent Dispatches
              </h2>
              <div className="space-y-3">
                {fetchingHistory ? (
                   <div className="p-4 bg-white/60 rounded-2xl border border-[#E7E1D3] motion-safe:animate-pulse text-[10px] font-black uppercase text-[#D6D0BF] text-center tracking-widest">Syncing Vault...</div>
                ) : historyError ? (
                  <div className="p-4 bg-white/60 rounded-2xl border border-[#EAD9CC] text-[11px] font-bold text-[#A24A32] text-center">{historyError}</div>
                ) : history.length === 0 ? (
                  <div className="p-10 text-center border-2 border-dashed border-[#E7E1D3] rounded-[2rem] text-[10px] font-black uppercase text-[#D6D0BF] tracking-widest">No entries found</div>
                ) : (
                  history.slice(0, 4).map((item) => (
                    <div key={item._id} className="bg-white rounded-[1.5rem] p-4 border border-[#E7E1D3] shadow-sm flex justify-between items-center group hover:border-[#B8912E]/40 hover:translate-x-1 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-[#F6F3EC] flex items-center justify-center text-[#C9C2AE] group-hover:bg-[#FBF3E3] group-hover:text-[#B8912E] transition-colors">
                           <Receipt size={16} />
                        </div>
                        <div>
                          <p className="font-black uppercase text-xs tracking-tight text-[#1C1A17]">{item.month}</p>
                          <p className="text-[10px] font-bold text-[#8A8478]">₹{item.netSalary?.toLocaleString("en-IN")}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!payslipHasFile(item)}
                        aria-label={`Open payslip for ${item.month}`}
                        onClick={() =>
                          openPayslip(item._id).catch((err) =>
                            setAlertState({
                              variant: "error",
                              title: "Can't Open File",
                              message: apiErrorMessage(err, "The payslip file could not be opened.")
                            })
                          )
                        }
                        className="h-10 w-10 flex items-center justify-center rounded-xl text-[#D6D0BF] hover:bg-[#1C1A17] hover:text-[#F6F3EC] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <FileText size={18} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

const SectionLabel = ({ icon, title, color = "text-[#8A8478]" }) => (
  <div className={`flex items-center gap-2 ${color} mb-2`}>
    {icon}
    <span className="text-[10px] font-black uppercase tracking-widest">{title}</span>
  </div>
);

const Input = ({ label, placeholder = "0.00", ...props }) => (
  <div className="group space-y-2">
    <label className="text-[9px] font-black uppercase tracking-widest text-[#8A8478] group-focus-within:text-[#B8912E] transition-colors ml-1">
      {label}
    </label>
    <input
      {...props}
      placeholder={placeholder}
      className="w-full bg-[#F6F3EC] border border-[#E7E1D3] rounded-2xl px-5 py-3.5 text-xs font-black tracking-tight outline-none transition-all text-[#1C1A17] focus:bg-white focus:border-[#B8912E] focus:ring-4 focus:ring-[#B8912E]/10 placeholder:text-[#D6D0BF]"
    />
  </div>
);

export default AddPayslip;