import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye, Pencil, UserX, UserCheck, Plane, Receipt, AlertTriangle, CheckCircle2, Loader2, Crown,
  ShieldOff, History, LogIn, X,
} from "lucide-react";
import { apiErrorCode, apiErrorMessage } from "./apiError";

const AUTO_CLOSE_MS = 1800;

/* ================= MODAL SHELL ================= */
const Modal = ({ open, onClose, dismissable = true, children }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && dismissable && onClose?.();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, dismissable, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center font-sans sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => dismissable && onClose?.()}
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="relative w-full max-w-sm overflow-hidden rounded-t-[2rem] bg-white text-left shadow-[0_40px_90px_-20px_rgba(127,29,29,0.45)] ring-1 ring-red-100 sm:rounded-[2rem]"
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

const TONES = {
  danger: { bar: "from-red-600 via-rose-500 to-orange-400", icon: "from-red-600 to-rose-500 shadow-red-600/35" },
  success: { bar: "from-emerald-500 via-teal-400 to-emerald-500", icon: "from-emerald-500 to-teal-500 shadow-emerald-500/35" },
  warning: { bar: "from-amber-500 via-orange-400 to-amber-500", icon: "from-amber-500 to-orange-500 shadow-amber-500/35" },
};

const ModalHead = ({ icon: Icon, tone, title, children }) => (
  <>
    <div className={`h-1.5 bg-gradient-to-r ${TONES[tone].bar}`} />
    <div className="px-7 pb-2 pt-7 text-center">
      <motion.span
        initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 16, delay: 0.05 }}
        className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center"
      >
        <span className={`absolute inset-0 animate-ping rounded-3xl bg-gradient-to-br opacity-20 [animation-duration:2s] ${TONES[tone].icon}`} />
        <span className={`relative flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br text-white shadow-lg ${TONES[tone].icon}`}>
          <Icon size={28} strokeWidth={2} />
        </span>
      </motion.span>
      <h3 className="text-xl font-extrabold tracking-tight text-gray-900">{title}</h3>
      {children}
    </div>
  </>
);

const Fact = ({ icon: Icon, tone, children }) => (
  <li className="flex items-start gap-2.5">
    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${tone}`}>
      <Icon size={13} />
    </span>
    <span className="text-xs leading-relaxed text-gray-600">{children}</span>
  </li>
);

const BtnSecondary = ({ children, ...p }) => (
  <button
    {...p}
    className="flex-1 rounded-2xl bg-gray-50 py-3.5 text-sm font-bold text-gray-600 ring-1 ring-gray-200 transition hover:bg-white hover:text-gray-900 active:scale-[0.98] disabled:opacity-50"
  >
    {children}
  </button>
);

const BtnPrimary = ({ tone = "danger", busy, busyText, children, ...p }) => (
  <button
    {...p}
    disabled={busy || p.disabled}
    className={`flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r py-3.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] disabled:translate-y-0 disabled:opacity-80 ${
      tone === "success" ? "from-emerald-600 to-teal-500 shadow-emerald-600/30" : "from-red-600 to-rose-500 shadow-red-600/30"
    }`}
  >
    {busy ? <><Loader2 size={16} className="animate-spin" /> {busyText}</> : children}
  </button>
);

const CountdownBar = ({ tone = "success" }) => (
  <motion.div
    initial={{ scaleX: 1 }}
    animate={{ scaleX: 0 }}
    transition={{ duration: AUTO_CLOSE_MS / 1000, ease: "linear" }}
    className={`h-1 origin-left bg-gradient-to-r ${tone === "success" ? "from-emerald-500 to-teal-400" : "from-gray-400 to-gray-300"}`}
  />
);

/* ================= ICON BUTTON WITH TOOLTIP ================= */
const VARIANTS = {
  view: "text-sky-600 bg-sky-50 ring-sky-100 hover:bg-sky-500 hover:text-white hover:ring-sky-500 hover:shadow-sky-500/30",
  edit: "text-amber-600 bg-amber-50 ring-amber-100 hover:bg-amber-500 hover:text-white hover:ring-amber-500 hover:shadow-amber-500/30",
  leave: "text-violet-600 bg-violet-50 ring-violet-100 hover:bg-violet-500 hover:text-white hover:ring-violet-500 hover:shadow-violet-500/30",
  pay: "text-teal-600 bg-teal-50 ring-teal-100 hover:bg-teal-500 hover:text-white hover:ring-teal-500 hover:shadow-teal-500/30",
  danger: "text-red-600 bg-red-50 ring-red-100 hover:bg-gradient-to-br hover:from-red-600 hover:to-rose-500 hover:text-white hover:ring-red-500 hover:shadow-red-600/30",
  success: "text-emerald-600 bg-emerald-50 ring-emerald-100 hover:bg-emerald-500 hover:text-white hover:ring-emerald-500 hover:shadow-emerald-500/30",
};

const IconButton = ({ icon: Icon, label, onClick, variant = "view", disabled }) => (
  <div className="group/btn relative">
    <motion.button
      type="button"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 transition-colors duration-200 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]}`}
    >
      <Icon size={16} strokeWidth={2} />
    </motion.button>
    <span
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1 text-[11px] font-semibold text-white opacity-0 shadow-lg transition-all duration-150 group-hover/btn:translate-y-0 group-hover/btn:opacity-100 group-focus-within/btn:translate-y-0 group-focus-within/btn:opacity-100"
    >
      {label}
      <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
    </span>
  </div>
);

/* ================= MAIN ACTION COMPONENT ================= */
export const EmployeeButtons = ({ id, refresh, isActive }) => {
  const navigate = useNavigate();
  // null | "deactivate" | "manager" | "deactivated" | "reactivate" | "reactivated" | "error"
  const [modal, setModal] = useState(null);
  const [managerMsg, setManagerMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => !busy && setModal(null);

  // auto-close the success popups
  useEffect(() => {
    if (modal !== "deactivated" && modal !== "reactivated") return;
    const t = setTimeout(() => setModal(null), AUTO_CLOSE_MS);
    return () => clearTimeout(t);
  }, [modal]);

  const sendDeactivate = (clearManager = false) =>
    axios.delete(`${import.meta.env.VITE_BACKEND_URL}/api/employee/${id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      ...(clearManager ? { data: { clearManager: true } } : {}),
    });

  const sendReactivate = () =>
    axios.patch(
      `${import.meta.env.VITE_BACKEND_URL}/api/employee/${id}/status`,
      { isActive: true },
      { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
    );

  const fail = (err, fallback) => {
    setErrorMsg(apiErrorMessage(err, fallback));
    setModal("error");
  };

  const deactivateEmployee = async (clearManager = false) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await sendDeactivate(clearManager);
      if (res.data.success) {
        setModal("deactivated");
        // Immediate background refresh for smooth data transition
        refresh?.();
      }
    } catch (err) {
      // The employee currently manages a department: offer to clear it.
      if (!clearManager && apiErrorCode(err) === "MANAGER_REASSIGNMENT_REQUIRED") {
        setManagerMsg(apiErrorMessage(err, "This employee is the manager of their department."));
        setModal("manager");
      } else {
        console.error("Employee deactivation failed.", err);
        fail(err, "Unable to deactivate this employee.");
      }
    } finally {
      setBusy(false);
    }
  };

  const reactivateEmployee = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await sendReactivate();
      if (res.data.success) {
        setModal("reactivated");
        refresh?.();
      }
    } catch (err) {
      console.error("Employee reactivation failed.", err);
      fail(err, "Unable to reactivate this employee.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* ---------- confirm deactivate ---------- */}
      <Modal open={modal === "deactivate"} onClose={close} dismissable={!busy}>
        <ModalHead icon={UserX} tone="danger" title={<>Deactivate this <span className="text-red-600">employee?</span></>} />
        <ul className="mx-7 mt-3 space-y-2.5 rounded-2xl bg-gray-50/80 p-4 ring-1 ring-gray-100">
          <Fact icon={ShieldOff} tone="bg-red-50 text-red-600">They <b>won't be able to sign in</b>, and any open sessions end right away.</Fact>
          <Fact icon={History} tone="bg-emerald-50 text-emerald-600">Payroll, attendance and leave history are <b>kept</b>.</Fact>
          <Fact icon={UserCheck} tone="bg-sky-50 text-sky-600">You can reactivate them at any time.</Fact>
        </ul>
        <div className="flex gap-3 p-7 pt-5">
          <BtnSecondary onClick={close} disabled={busy}>Cancel</BtnSecondary>
          <BtnPrimary busy={busy} busyText="Deactivating…" onClick={() => deactivateEmployee(false)}>
            <UserX size={16} /> Deactivate
          </BtnPrimary>
        </div>
      </Modal>

      {/* ---------- manager reassignment (replaces window.confirm) ---------- */}
      <Modal open={modal === "manager"} onClose={close} dismissable={!busy}>
        <ModalHead icon={Crown} tone="warning" title="They manage a department">
          <p className="mt-2 text-sm leading-relaxed text-gray-500">{managerMsg}</p>
        </ModalHead>
        <div className="mx-7 mt-3 rounded-2xl bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-100">
          Continuing will <b>clear the department's manager</b> and deactivate this employee. You can choose a new manager later from <b>Departments → Edit</b>.
        </div>
        <div className="flex gap-3 p-7 pt-5">
          <BtnSecondary onClick={close} disabled={busy}>Cancel</BtnSecondary>
          <BtnPrimary busy={busy} busyText="Working…" onClick={() => deactivateEmployee(true)}>
            Clear & deactivate
          </BtnPrimary>
        </div>
      </Modal>

      {/* ---------- deactivated ---------- */}
      <Modal open={modal === "deactivated"} onClose={() => setModal(null)}>
        <ModalHead icon={CheckCircle2} tone="success" title="Employee deactivated">
          <p className="mt-2 text-sm text-gray-500">Their account is disabled. All history is kept.</p>
        </ModalHead>
        <div className="p-7 pt-5">
          <button onClick={() => setModal(null)} className="w-full rounded-2xl bg-gray-900 py-3.5 text-sm font-bold text-white transition hover:bg-gray-800 active:scale-[0.98]">
            Okay, got it
          </button>
        </div>
        <CountdownBar />
      </Modal>

      {/* ---------- confirm reactivate ---------- */}
      <Modal open={modal === "reactivate"} onClose={close} dismissable={!busy}>
        <ModalHead icon={UserCheck} tone="success" title={<>Reactivate this <span className="text-emerald-600">employee?</span></>} />
        <ul className="mx-7 mt-3 space-y-2.5 rounded-2xl bg-gray-50/80 p-4 ring-1 ring-gray-100">
          <Fact icon={LogIn} tone="bg-emerald-50 text-emerald-600">They'll be able to <b>sign in</b> and use the portal again.</Fact>
          <Fact icon={History} tone="bg-sky-50 text-sky-600">All their existing history stays exactly as it was.</Fact>
        </ul>
        <div className="flex gap-3 p-7 pt-5">
          <BtnSecondary onClick={close} disabled={busy}>Cancel</BtnSecondary>
          <BtnPrimary tone="success" busy={busy} busyText="Reactivating…" onClick={reactivateEmployee}>
            <UserCheck size={16} /> Reactivate
          </BtnPrimary>
        </div>
      </Modal>

      {/* ---------- reactivated ---------- */}
      <Modal open={modal === "reactivated"} onClose={() => setModal(null)}>
        <ModalHead icon={CheckCircle2} tone="success" title="Employee reactivated">
          <p className="mt-2 text-sm text-gray-500">Their account is restored and they can sign in again.</p>
        </ModalHead>
        <div className="p-7 pt-5">
          <button onClick={() => setModal(null)} className="w-full rounded-2xl bg-gray-900 py-3.5 text-sm font-bold text-white transition hover:bg-gray-800 active:scale-[0.98]">
            Okay, got it
          </button>
        </div>
        <CountdownBar />
      </Modal>

      {/* ---------- error (replaces alert) ---------- */}
      <Modal open={modal === "error"} onClose={() => setModal(null)}>
        <button
          onClick={() => setModal(null)}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-gray-50 text-gray-400 transition hover:rotate-90 hover:text-gray-700"
        >
          <X size={15} />
        </button>
        <ModalHead icon={AlertTriangle} tone="warning" title="Something went wrong">
          <p className="mt-2 text-sm leading-relaxed text-gray-500">{errorMsg}</p>
        </ModalHead>
        <div className="p-7 pt-5">
          <button onClick={() => setModal(null)} className="w-full rounded-2xl bg-gray-900 py-3.5 text-sm font-bold text-white transition hover:bg-gray-800 active:scale-[0.98]">
            Okay
          </button>
        </div>
      </Modal>

      {/* ---------- the buttons ---------- */}
      <div className="flex items-center justify-end gap-1.5">
        <IconButton variant="view" label="View profile" icon={Eye} onClick={() => navigate(`/admin-dashboard/employees/${id}`)} />
        <IconButton variant="edit" label="Edit details" icon={Pencil} onClick={() => navigate(`/admin-dashboard/employees/edit/${id}`)} />
        <IconButton variant="leave" label="Leaves" icon={Plane} onClick={() => navigate(`/admin-dashboard/employees/leaves/${id}`)} />
        <IconButton variant="pay" label="Payslip" icon={Receipt} onClick={() => navigate(`/admin-dashboard/employees/payslip/${id}`)} />
        <span className="mx-0.5 h-6 w-px bg-gray-200" aria-hidden />
        {isActive === false ? (
          <IconButton variant="success" label="Reactivate" icon={UserCheck} disabled={busy} onClick={() => setModal("reactivate")} />
        ) : (
          <IconButton variant="danger" label="Deactivate" icon={UserX} disabled={busy} onClick={() => setModal("deactivate")} />
        )}
      </div>
    </>
  );
};

/* ================= API HELPERS ================= */

/**
 * Fetches the master employee list
 */
export const fetchEmployees = async () => {
  try {
    const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/employee`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    return res.data.success ? res.data.employees : [];
  } catch (error) {
    console.error("Sync Error: Failed to fetch employees.", error.response?.data || error);
    return [];
  }
};

/**
 * Fetches departments for the onboarding form
 */
export const fetchDepartments = async () => {
  try {
    const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/api/department`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });
    if (response.data.success) {
      return response.data.departments;
    }
  } catch (error) {
    console.error("Sync Error: Failed to fetch departments.", error.response?.data || error);
  }
  return [];
};
