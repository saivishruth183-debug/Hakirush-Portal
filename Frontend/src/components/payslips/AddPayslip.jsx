import axios from "axios";
import React, { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud, CheckCircle2, AlertTriangle, ArrowLeft, ShieldCheck,
  History, FileText, Wallet, Activity, Receipt, Sparkles, CalendarDays,
  Clock, BadgeCheck, Hourglass, X, Loader2, Wand2, Send, TrendingUp,
  TrendingDown, Info, FileCheck2, Trash2, IndianRupee,
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

const PAGE_BG =
  "bg-[radial-gradient(ellipse_at_top_left,_#fee2e2_0%,_#f8fafc_45%,_#f1f5f9_100%)]";
const CARD =
  "rounded-3xl bg-white/90 ring-1 ring-white/70 shadow-[0_10px_40px_-12px_rgba(127,29,29,0.18)] backdrop-blur";

const ymOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (ym) => {
  if (!/^\d{4}-\d{2}$/.test(ym || "")) return ym || "—";
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};
const fmtBytes = (b) => (b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

/* ===== STATUS MODAL (success + error) ===== */
const StatusAlert = ({ variant = "success", title, message, onClose }) => {
  const isError = variant === "error";
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        role="dialog" aria-modal="true"
        initial={{ y: 40, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 30, opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white p-7 text-center shadow-2xl ring-1 ring-gray-100"
      >
        <div className={`absolute inset-x-0 top-0 h-1.5 ${isError ? "bg-gradient-to-r from-red-600 to-rose-400" : "bg-gradient-to-r from-emerald-500 to-teal-400"}`} />
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
          <X size={16} />
        </button>
        <motion.div
          initial={{ scale: 0.5, rotate: -12 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.05 }}
          className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ${isError ? "bg-red-50 text-red-600 ring-1 ring-red-100" : "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"}`}
        >
          {isError ? <AlertTriangle size={30} strokeWidth={2.2} /> : <CheckCircle2 size={30} strokeWidth={2.2} />}
        </motion.div>
        <h3 className="text-xl font-extrabold tracking-tight text-gray-900">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">{message}</p>
        <button
          onClick={onClose}
          className={`mt-6 w-full rounded-2xl py-3 text-sm font-bold text-white shadow-lg transition active:scale-[0.98] ${
            isError
              ? "bg-gradient-to-r from-red-600 to-rose-500 shadow-red-600/30 hover:brightness-110"
              : "bg-gradient-to-r from-emerald-600 to-teal-500 shadow-emerald-600/30 hover:brightness-110"
          }`}
        >
          {isError ? "Got it, let me fix" : "Done"}
        </button>
      </motion.div>
    </motion.div>,
    document.body
  );
};

/* ===== DELETE CONFIRM MODAL ===== */
const ConfirmDelete = ({ item, busy, onCancel, onConfirm }) => {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !busy && onCancel()} />
      <motion.div
        role="alertdialog" aria-modal="true"
        initial={{ y: 40, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 30, opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white p-7 shadow-2xl ring-1 ring-gray-100"
      >
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-red-600 to-rose-400" />
        <motion.div
          initial={{ scale: 0.5, rotate: -12 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.05 }}
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100"
        >
          <Trash2 size={28} strokeWidth={2.2} />
        </motion.div>
        <h3 className="text-center text-xl font-extrabold tracking-tight text-gray-900">
          Delete this <span className="text-red-600">payslip?</span>
        </h3>
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-gray-50 p-3.5 ring-1 ring-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-red-600 shadow-sm"><Receipt size={15} /></div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{monthLabel(item.month)}</p>
              <p className="text-xs text-gray-500">Net {inr(item.netSalary)}</p>
            </div>
          </div>
          {item.paymentStatus && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.paymentStatus === "Paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
              {item.paymentStatus}
            </span>
          )}
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-gray-500">
          <AlertTriangle size={14} className="mt-px shrink-0 text-amber-500" />
          The payslip and its PDF are removed for good, and the employee will no longer see it. This can't be undone.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            onClick={onCancel} disabled={busy}
            className="rounded-2xl bg-gray-100 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm} disabled={busy}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-70"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
};

const AddPayslip = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState(null); // "auto" | "post" (UI only)
  const [alertState, setAlertState] = useState(null); // { variant, title, message } | null
  const [history, setHistory] = useState([]);
  const [fetchingHistory, setFetchingHistory] = useState(true);

  const [form, setForm] = useState(emptyForm);
  const [autoGeneratePdf, setAutoGeneratePdf] = useState(true);
  const [approvedReimbursementTotal, setApprovedReimbursementTotal] = useState(0);
  // Totals returned by the server for the last posted payslip (authoritative)
  const [posted, setPosted] = useState(null);
  const [historyError, setHistoryError] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const [toDelete, setToDelete] = useState(null); // payslip item awaiting confirmation
  const [deleting, setDeleting] = useState(false);
  const [showAll, setShowAll] = useState(false);

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

  useEffect(() => {
    if (id) {
      fetchHistory();
      // Check for approved expense reimbursements waiting to be included in payroll
      axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/expenses/employee/${id}/approved`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      })
      .then((res) => {
        if (res.data.success && res.data.totalReimbursement > 0) {
          setApprovedReimbursementTotal(res.data.totalReimbursement);
          setForm((prev) => ({ ...prev, reimbursements: String(res.data.totalReimbursement) }));
        }
      })
      .catch(() => {});
    }
  }, [id, fetchHistory]);

  const deletePayslip = async () => {
    if (!toDelete || deleting) return;
    const target = toDelete;
    setDeleting(true);
    try {
      await axios.delete(`${import.meta.env.VITE_BACKEND_URL}/api/payslip/${target._id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setHistory((prev) => prev.filter((h) => h._id !== target._id));
      setPosted((p) => (p && p.month === target.month ? null : p));
      setToDelete(null);
      setAlertState({
        variant: "success",
        title: "Payslip deleted",
        message: `The payslip for ${monthLabel(target.month)} has been removed.`
      });
      fetchHistory();
    } catch (err) {
      setToDelete(null);
      setAlertState({
        variant: "error",
        title: "Delete failed",
        message: apiErrorMessage(err, "The payslip could not be deleted. Please try again.")
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    // Server also checks the %PDF signature; some browsers report an empty MIME type.
    const looksPdf = (selected.type === "application/pdf" || selected.type === "") && /\.pdf$/i.test(selected.name);
    if (!looksPdf) {
      setAlertState({
        variant: "error",
        title: "Wrong format",
        message: "Only PDF statements are accepted. Please select a .pdf file."
      });
      e.target.value = "";
      return;
    }
    if (selected.size > MAX_PDF_BYTES) {
      setAlertState({
        variant: "error",
        title: "File too large",
        message: "Payslip PDFs must be 5 MB or smaller."
      });
      e.target.value = "";
      return;
    }
    setFile(selected);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer?.files;
    if (files && files.length) handleFileChange({ target: { files, value: "" } });
  };

  const removeFile = () => {
    setFile(null);
    setFileInputKey((k) => k + 1);
  };

  const handleAutoGenerate = async () => {
    if (loading) return;
    if (!/^\d{4}-\d{2}$/.test(form.month)) {
      setAlertState({ variant: "error", title: "Missing month", message: "Choose the payroll month first." });
      return;
    }

    setLoading(true);
    setBusyAction("auto");
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
          title: "Payslip auto-generated",
          message: `The PDF was generated and posted. Server-calculated net pay: ${inr(p.netSalary)}.`
        });
        fetchHistory();
        setForm(emptyForm());
      }
    } catch (err) {
      setAlertState({
        variant: "error",
        title: "Auto-generate failed",
        message: apiErrorMessage(err, "The payslip could not be auto-generated. Please check if they have a base salary set.")
      });
    } finally {
      setLoading(false);
      setBusyAction(null);
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
      setAlertState({ variant: "error", title: "Check the form", message: problem });
      return;
    }
    if (!file && !autoGeneratePdf) {
      setAlertState({
        variant: "error",
        title: "Missing statement",
        message: "Please upload the PDF payslip or turn on Auto-generate PDF."
      });
      return;
    }
    setLoading(true);
    setBusyAction("post");
    const formData = new FormData();
    formData.append("month", form.month); // YYYY-MM
    formData.append("paymentStatus", form.paymentStatus);
    if (form.paymentStatus === "Paid" && form.paymentDate) formData.append("paymentDate", form.paymentDate);
    NUMERIC_FIELDS.forEach((k) => formData.append(k, form[k] === "" ? "0" : String(Number(form[k]))));
    formData.append("employeeId", id);
    if (autoGeneratePdf) formData.append("autoGenerate", "true");
    if (file) formData.append("payslip", file);

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
          title: "Payslip posted",
          message: p.netSalary !== undefined
            ? `Statement posted. Server-calculated net pay: ${inr(p.netSalary)}.`
            : "The payslip has been posted securely."
        });
        fetchHistory();
        setForm(emptyForm());
        setFile(null);
        setFileInputKey((k) => k + 1);
      }
    } catch (err) {
      setAlertState({
        variant: "error",
        title: "Posting failed",
        message: apiErrorMessage(err, "The statement could not be committed. Please try again.")
      });
    }
    finally { setLoading(false); setBusyAction(null); }
  };

  /* ---------- UI-only derived values ---------- */
  const n = (k) => Number(form[k] || 0);
  const earningsSubtotal = EARNING_FIELDS.reduce((a, [k]) => a + n(k), 0);
  const dedShare = calculations.gross > 0 ? Math.min(100, (calculations.ded / calculations.gross) * 100) : 0;
  const netNegative = calculations.net < 0;
  const monthOk = /^\d{4}-\d{2}$/.test(form.month);
  const basicOk = Number(form.basicSalary) > 0;
  const statementOk = !!file || autoGeneratePdf;
  const readySteps = [monthOk, basicOk, statementOk].filter(Boolean).length;
  const duplicateMonth = monthOk && history.some((h) => h.month === form.month);

  const now = new Date();
  const thisMonth = ymOf(now);
  const lastMonth = ymOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  return (
    <div className={`min-h-screen ${PAGE_BG} text-gray-900`}>
      <AnimatePresence>
        {alertState && (
          <StatusAlert
            key="alert"
            variant={alertState.variant}
            title={alertState.title}
            message={alertState.message}
            onClose={() => setAlertState(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toDelete && (
          <ConfirmDelete
            key="confirm-delete"
            item={toDelete}
            busy={deleting}
            onCancel={() => setToDelete(null)}
            onConfirm={deletePayslip}
          />
        )}
      </AnimatePresence>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        {/* ===== Header ===== */}
        <motion.header
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <button
              onClick={() => navigate(-1)}
              className="group mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-gray-500 ring-1 ring-gray-200 transition hover:text-red-600 hover:ring-red-200"
            >
              <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" /> Back
            </button>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-lg shadow-red-600/30">
                <Receipt size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                  Issue <span className="bg-gradient-to-r from-red-600 to-rose-500 bg-clip-text text-transparent">Payslip</span>
                </h1>
                <p className="text-sm text-gray-500">Enter this month's earnings and deductions, then post or auto-generate.</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100 sm:self-auto">
            <ShieldCheck size={14} /> Secure payroll
          </div>
        </motion.header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* ===== LEFT: FORM ===== */}
          <form onSubmit={handleSubmit} className="space-y-5 lg:col-span-7" noValidate>
            {/* Period & payment */}
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className={`${CARD} p-5 sm:p-6`}>
              <CardHeader icon={<CalendarDays size={16} />} title="Pay period & status" subtitle="Which month this payslip covers" tone="red" />
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="month" required>Payroll month</FieldLabel>
                  <input
                    id="month" name="month" type="month" value={form.month} onChange={handleChange} required
                    className={inputCls}
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[["This month", thisMonth], ["Last month", lastMonth]].map(([lbl, v]) => (
                      <button
                        key={v} type="button" onClick={() => setField("month", v)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                          form.month === v ? "bg-red-600 text-white shadow shadow-red-600/30" : "bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600"
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                  <AnimatePresence>
                    {duplicateMonth && (
                      <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                        className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-600">
                        <AlertTriangle size={13} /> A payslip for {monthLabel(form.month)} already exists.
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <div>
                  <FieldLabel>Payment status</FieldLabel>
                  <div className="relative grid grid-cols-2 gap-1 rounded-2xl bg-gray-100/80 p-1" role="radiogroup" aria-label="Payment status">
                    {[["Paid", BadgeCheck], ["Pending", Hourglass]].map(([val, Icon]) => {
                      const active = form.paymentStatus === val;
                      return (
                        <button
                          key={val} type="button" role="radio" aria-checked={active}
                          onClick={() => setField("paymentStatus", val)}
                          className={`relative z-10 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                            active ? (val === "Paid" ? "text-emerald-700" : "text-amber-700") : "text-gray-500 hover:text-gray-700"
                          }`}
                        >
                          {active && (
                            <motion.span layoutId="pay-status-pill" className="absolute inset-0 -z-10 rounded-xl bg-white shadow-sm ring-1 ring-gray-200"
                              transition={{ type: "spring", stiffness: 420, damping: 32 }} />
                          )}
                          <Icon size={15} /> {val}
                        </button>
                      );
                    })}
                  </div>
                  <AnimatePresence initial={false}>
                    {form.paymentStatus === "Paid" && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="pt-3">
                          <FieldLabel htmlFor="paymentDate">Payment date <span className="font-normal normal-case text-gray-400">(optional)</span></FieldLabel>
                          <input id="paymentDate" name="paymentDate" type="date" value={form.paymentDate} onChange={handleChange} className={inputCls} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.section>

            {/* Earnings */}
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className={`${CARD} p-5 sm:p-6`}>
              <CardHeader icon={<Wallet size={16} />} title="Earnings" subtitle="Monthly components" tone="emerald" total={earningsSubtotal} />

              <AnimatePresence>
                {approvedReimbursementTotal > 0 && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                    className="mt-4 flex items-start gap-3 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 p-3.5 ring-1 ring-emerald-100">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm"><Sparkles size={15} /></div>
                    <p className="text-xs leading-relaxed text-emerald-800">
                      <span className="font-bold">{inr(approvedReimbursementTotal)}</span> in approved expense claims was found and added to <span className="font-semibold">Reimbursements</span>.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {EARNING_FIELDS.map(([name, label]) => (
                  <MoneyInput
                    key={name} label={label} name={name} value={form[name]} onChange={handleChange}
                    required={name === "basicSalary"}
                    invalid={name === "basicSalary" && form.basicSalary !== "" && !basicOk}
                    highlight={name === "basicSalary"}
                    badge={name === "reimbursements" && approvedReimbursementTotal > 0 ? "Auto-filled" : null}
                  />
                ))}
              </div>

              <div className="mt-6 rounded-2xl bg-gray-50/80 p-4 ring-1 ring-gray-100">
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500"><Clock size={13} /> Overtime</span>
                  <span className="text-xs font-semibold text-gray-500">
                    {n("overtimeHours") || 0} h × {inr(n("overtimeRate"))} = <span className="font-bold text-gray-900">{inr(calculations.overtimePay)}</span>
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {OVERTIME_FIELDS.map(([name, label]) => (
                    <MoneyInput key={name} label={label} name={name} value={form[name]} onChange={handleChange}
                      prefix={name === "overtimeHours" ? null : "₹"} suffix={name === "overtimeHours" ? "hrs" : null} />
                  ))}
                </div>
              </div>
            </motion.section>

            {/* Deductions */}
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className={`${CARD} p-5 sm:p-6`}>
              <CardHeader icon={<TrendingDown size={16} />} title="Deductions" subtitle="Taken out of gross pay" tone="red" total={calculations.ded} negative />
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {DEDUCTION_FIELDS.map(([name, label]) => (
                  <MoneyInput key={name} label={label} name={name} value={form[name]} onChange={handleChange} tone="red" />
                ))}
              </div>
            </motion.section>

            {/* Statement */}
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={`${CARD} p-5 sm:p-6`}>
              <CardHeader icon={<FileText size={16} />} title="Payslip PDF" subtitle="Generate automatically or upload your own" tone="violet" />

              <button
                type="button" onClick={() => setAutoGeneratePdf((v) => !v)} role="switch" aria-checked={autoGeneratePdf}
                className={`mt-5 flex w-full items-center justify-between gap-4 rounded-2xl p-4 text-left ring-1 transition ${
                  autoGeneratePdf ? "bg-red-50/70 ring-red-100" : "bg-gray-50 ring-gray-100 hover:ring-gray-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${autoGeneratePdf ? "bg-gradient-to-br from-red-600 to-rose-500 text-white shadow shadow-red-600/30" : "bg-white text-gray-400 ring-1 ring-gray-200"}`}>
                    <Wand2 size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Auto-generate branded PDF</p>
                    <p className="text-xs text-gray-500">Creates the standard company payslip, so no upload is needed</p>
                  </div>
                </div>
                <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${autoGeneratePdf ? "bg-red-600" : "bg-gray-300"}`}>
                  <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 32 }}
                    className={`h-5 w-5 rounded-full bg-white shadow ${autoGeneratePdf ? "ml-[22px]" : "ml-0.5"}`} />
                </span>
              </button>

              <div className="mt-4">
                <AnimatePresence mode="wait" initial={false}>
                  {file ? (
                    <motion.div key="file" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
                      className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-emerald-200">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><FileCheck2 size={20} /></div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900">{file.name}</p>
                        <p className="text-xs text-gray-500">{fmtBytes(file.size)} · {autoGeneratePdf ? "will be used instead of the auto-generated PDF" : "ready to upload"}</p>
                      </div>
                      <button type="button" onClick={removeFile} aria-label="Remove file"
                        className="rounded-xl p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`group cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition ${
                        dragOver ? "border-red-400 bg-red-50/60" : !autoGeneratePdf ? "border-red-200 bg-red-50/20 hover:border-red-400" : "border-gray-200 hover:border-red-300 hover:bg-red-50/30"
                      }`}
                    >
                      <motion.div animate={dragOver ? { y: -4, scale: 1.08 } : { y: 0, scale: 1 }}
                        className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-gray-50 text-gray-400 ring-1 ring-gray-100 transition group-hover:bg-white group-hover:text-red-500">
                        <UploadCloud size={20} />
                      </motion.div>
                      <p className="text-sm font-semibold text-gray-700">
                        {autoGeneratePdf ? "Upload a custom PDF (optional)" : <>Upload the payslip PDF <span className="text-red-500">*</span></>}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">Drag & drop or <span className="font-semibold text-red-600">browse</span> · PDF only · max 5 MB</p>
                    </motion.div>
                  )}
                </AnimatePresence>
                <input key={fileInputKey} ref={fileInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleFileChange} />
              </div>
            </motion.section>

            {/* Actions */}
            <div className="sticky bottom-3 z-20">
              <div className={`${CARD} flex flex-col gap-3 p-3 sm:flex-row sm:items-center`}>
                <div className="flex items-center gap-2 px-2 sm:flex-1">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className={`h-1.5 w-6 rounded-full transition-colors ${i < readySteps ? "bg-gradient-to-r from-red-600 to-rose-500" : "bg-gray-200"}`} />
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-gray-500">
                    {readySteps === 3 ? "Ready to post" : `${readySteps}/3 ready`}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <button
                    type="button" onClick={handleAutoGenerate} disabled={loading}
                    title="Uses the employee's saved salary profile, only the month is needed"
                    className="flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-red-600 ring-1 ring-red-200 transition hover:bg-red-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busyAction === "auto" ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                    {busyAction === "auto" ? "Generating…" : "Auto-generate"}
                  </button>
                  <button
                    type="submit" disabled={loading}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busyAction === "post" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    {busyAction === "post" ? "Posting…" : "Post payslip"}
                  </button>
                </div>
              </div>
              <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-gray-400">
                <Info size={12} /> <span><b className="font-semibold text-gray-500">Auto-generate</b> uses the saved salary profile for the chosen month. <b className="font-semibold text-gray-500">Post payslip</b> uses the amounts above.</span>
              </p>
            </div>
          </form>

          {/* ===== RIGHT: ESTIMATE + HISTORY ===== */}
          <aside className="space-y-5 lg:col-span-5">
            <div className="space-y-5 lg:sticky lg:top-6">
              {/* Estimate */}
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-600 via-rose-600 to-rose-500 p-6 text-white shadow-[0_20px_50px_-15px_rgba(220,38,38,0.55)]"
              >
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
                <div className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-rose-300/30 blur-3xl" />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold ring-1 ring-white/20">
                      <Activity size={12} /> Live estimate
                    </span>
                    <span className="text-xs font-medium text-white/80">{monthOk ? monthLabel(form.month) : "No month selected"}</span>
                  </div>

                  <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-white/70">Estimated net pay</p>
                  <motion.p key={calculations.net} initial={{ opacity: 0.4, y: 4 }} animate={{ opacity: 1, y: 0 }}
                    className={`mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl ${netNegative ? "text-amber-200" : ""}`}>
                    {inr(calculations.net)}
                  </motion.p>
                  {netNegative && (
                    <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-amber-100"><AlertTriangle size={12} /> Deductions are higher than gross pay</p>
                  )}

                  {/* split bar */}
                  <div className="mt-5">
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-white/20">
                      <motion.div className="h-full bg-white" animate={{ width: `${calculations.gross > 0 ? 100 - dedShare : 0}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
                      <motion.div className="h-full bg-amber-300" animate={{ width: `${dedShare}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
                    </div>
                    <div className="mt-1.5 flex justify-between text-[11px] text-white/75">
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-white" /> Take-home</span>
                      <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-300" /> Deductions {dedShare.toFixed(0)}%</span>
                    </div>
                  </div>

                  <div className="mt-5 space-y-2.5 rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
                    <EstRow icon={<TrendingUp size={13} />} label="Gross" value={inr(calculations.gross)} />
                    {calculations.overtimePay > 0 && <EstRow icon={<Clock size={13} />} label="incl. overtime" value={inr(calculations.overtimePay)} muted />}
                    <EstRow icon={<TrendingDown size={13} />} label="Deductions" value={`− ${inr(calculations.ded)}`} />
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-white/70">
                    Calculated in your browser. The server works out the official totals when the payslip is posted.
                  </p>
                </div>
              </motion.div>

              {/* Posted */}
              <AnimatePresence>
                {posted && (
                  <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className={`${CARD} p-5 ring-emerald-100`}>
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="flex items-center gap-2 text-sm font-bold text-emerald-700"><CheckCircle2 size={16} /> Posted · official totals</h2>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">{monthLabel(posted.month)}</span>
                    </div>
                    <dl className="space-y-2 text-sm">
                      {posted.overtimePay !== undefined && (
                        <div className="flex justify-between"><dt className="text-gray-500">Overtime pay</dt><dd className="font-semibold">{inr(posted.overtimePay)}</dd></div>
                      )}
                      <div className="flex justify-between"><dt className="text-gray-500">Gross salary</dt><dd className="font-semibold">{posted.grossSalary !== undefined ? inr(posted.grossSalary) : "—"}</dd></div>
                      <div className="flex justify-between"><dt className="text-gray-500">Total deductions</dt><dd className="font-semibold text-red-600">{posted.totalDeductions !== undefined ? `− ${inr(posted.totalDeductions)}` : "—"}</dd></div>
                      <div className="mt-2 flex justify-between border-t border-dashed border-gray-200 pt-3 text-base"><dt className="font-bold">Net salary</dt><dd className="font-extrabold text-emerald-700">{posted.netSalary !== undefined ? inr(posted.netSalary) : "—"}</dd></div>
                    </dl>
                  </motion.section>
                )}
              </AnimatePresence>

              {/* History */}
              <section className={`${CARD} p-5`}>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600"><History size={14} /></span>
                    Recent payslips
                  </h2>
                  {!fetchingHistory && !historyError && history.length > 0 && (
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-500">{history.length} total</span>
                  )}
                </div>

                {fetchingHistory ? (
                  <div className="space-y-2.5">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="flex animate-pulse items-center gap-3 rounded-2xl bg-gray-50 p-3">
                        <div className="h-10 w-10 rounded-xl bg-gray-200" />
                        <div className="flex-1 space-y-1.5"><div className="h-3 w-24 rounded bg-gray-200" /><div className="h-2.5 w-16 rounded bg-gray-100" /></div>
                      </div>
                    ))}
                  </div>
                ) : historyError ? (
                  <div className="flex items-start gap-2 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {historyError}
                  </div>
                ) : history.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-gray-200 p-8 text-center">
                    <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-gray-50 text-gray-300"><IndianRupee size={20} /></div>
                    <p className="text-sm font-semibold text-gray-600">No payslips yet</p>
                    <p className="text-xs text-gray-400">The first one you post will appear here.</p>
                  </div>
                ) : (
                  <>
                  <ul className={`space-y-2 ${showAll ? "max-h-[420px] overflow-y-auto pr-1" : ""}`}>
                    <AnimatePresence initial={false}>
                    {(showAll ? history : history.slice(0, 4)).map((item, i) => {
                      const hasFile = payslipHasFile(item);
                      const paid = item.paymentStatus ? item.paymentStatus === "Paid" : null;
                      return (
                        <motion.li
                          key={item._id} layout initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20, height: 0, marginTop: 0, paddingTop: 0, paddingBottom: 0 }}
                          transition={{ delay: Math.min(i, 6) * 0.04 }}
                          className="group flex items-center justify-between gap-3 rounded-2xl p-3 ring-1 ring-gray-100 transition hover:bg-red-50/40 hover:ring-red-100"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-50 to-rose-100 text-red-600">
                              <Receipt size={16} />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-gray-900">{monthLabel(item.month)}</p>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span className="font-semibold text-gray-700">{inr(item.netSalary)}</span>
                                {paid !== null && (
                                  <span className={`rounded-full px-1.5 py-px text-[10px] font-bold ${paid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                                    {item.paymentStatus}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={!hasFile}
                            title={hasFile ? "Open PDF" : "No PDF attached"}
                            aria-label={`Open payslip for ${item.month}`}
                            onClick={() =>
                              openPayslip(item._id).catch((err) =>
                                setAlertState({
                                  variant: "error",
                                  title: "Can't open file",
                                  message: apiErrorMessage(err, "The payslip file could not be opened.")
                                })
                              )
                            }
                            className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 text-xs font-semibold text-gray-600 ring-1 ring-gray-200 transition hover:bg-red-600 hover:text-white hover:ring-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-gray-600 disabled:hover:ring-gray-200"
                          >
                            <FileText size={14} /> PDF
                          </button>
                          <button
                            type="button"
                            disabled={deleting}
                            title="Delete payslip"
                            aria-label={`Delete payslip for ${item.month}`}
                            onClick={() => setToDelete(item)}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-500 ring-1 ring-red-100 transition hover:-translate-y-0.5 hover:bg-red-600 hover:text-white hover:shadow-md hover:shadow-red-600/30 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 size={14} />
                          </button>
                        </motion.li>
                      );
                    })}
                    </AnimatePresence>
                  </ul>
                  {history.length > 4 && (
                    <button
                      type="button" onClick={() => setShowAll((v) => !v)}
                      className="mt-3 w-full rounded-xl py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      {showAll ? "Show less" : `Show all ${history.length} payslips`}
                    </button>
                  )}
                  </>
                )}
              </section>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

/* ===== Small building blocks ===== */
const inputCls =
  "w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none ring-1 ring-gray-200 transition placeholder:font-normal placeholder:text-gray-300 focus:ring-2 focus:ring-red-400";

const TONES = {
  red: "bg-red-50 text-red-600",
  emerald: "bg-emerald-50 text-emerald-600",
  violet: "bg-violet-50 text-violet-600",
};

const CardHeader = ({ icon, title, subtitle, tone = "red", total, negative }) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-3">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${TONES[tone]}`}>{icon}</div>
      <div>
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
    </div>
    {total !== undefined && (
      <div className="text-right">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Subtotal</p>
        <p className={`text-base font-extrabold ${negative ? "text-red-600" : "text-gray-900"}`}>
          {negative && total > 0 ? "− " : ""}{inr(total)}
        </p>
      </div>
    )}
  </div>
);

const FieldLabel = ({ children, htmlFor, required }) => (
  <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-semibold text-gray-600">
    {children} {required && <span className="text-red-500">*</span>}
  </label>
);

const MoneyInput = ({ label, name, value, onChange, required, invalid, highlight, badge, prefix = "₹", suffix, tone }) => {
  const filled = value !== "" && Number(value) > 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={name} className="text-xs font-semibold text-gray-600">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {badge && <span className="rounded-full bg-emerald-50 px-2 py-px text-[10px] font-bold text-emerald-700">{badge}</span>}
      </div>
      <div
        className={`flex items-center rounded-2xl bg-white ring-1 transition focus-within:ring-2 ${
          invalid ? "ring-red-300 focus-within:ring-red-400" : highlight ? "ring-red-100 focus-within:ring-red-400" : "ring-gray-200 focus-within:ring-red-400"
        }`}
      >
        {prefix && (
          <span className={`pl-4 text-sm font-bold ${filled ? (tone === "red" ? "text-red-500" : "text-gray-700") : "text-gray-300"}`}>{prefix}</span>
        )}
        <input
          id={name} name={name} type="number" min="0" step="0.01" inputMode="decimal"
          value={value} onChange={onChange} required={required} placeholder="0.00"
          onWheel={(e) => e.currentTarget.blur()}
          className={`w-full min-w-0 bg-transparent py-3 pr-4 text-sm font-semibold text-gray-900 outline-none placeholder:font-normal placeholder:text-gray-300 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${prefix ? "pl-1.5" : "pl-4"}`}
        />
        {suffix && <span className="pr-4 text-xs font-semibold text-gray-400">{suffix}</span>}
      </div>
      {invalid && <p className="mt-1 text-[11px] font-medium text-red-500">Must be greater than 0</p>}
    </div>
  );
};

const EstRow = ({ icon, label, value, muted }) => (
  <div className={`flex items-center justify-between text-sm ${muted ? "pl-5 text-white/70" : ""}`}>
    <span className="flex items-center gap-1.5 text-white/80">{!muted && icon}{label}</span>
    <span className="font-bold">{value}</span>
  </div>
);

export default AddPayslip;