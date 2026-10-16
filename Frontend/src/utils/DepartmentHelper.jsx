import axios from "axios";
import { Pencil, Eye, Trash2, AlertTriangle, CheckCircle2, Users, Loader2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiErrorCode, apiErrorMessage } from "./apiError";

/* ================= MODAL SHELL ================= */
const Modal = ({ open, onClose, children, dismissable = true }) => {
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
        <div className="fixed inset-0 z-[120] flex items-end justify-center p-0 font-sans sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
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
            className="relative w-full max-w-sm overflow-hidden rounded-t-[2rem] bg-white shadow-[0_40px_90px_-20px_rgba(127,29,29,0.45)] ring-1 ring-red-100 sm:rounded-[2rem]"
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

const ModalIcon = ({ icon: Icon, tone }) => {
  const tones = {
    danger: "from-red-600 to-rose-500 shadow-red-600/35",
    success: "from-emerald-500 to-teal-500 shadow-emerald-500/35",
    warning: "from-amber-500 to-orange-500 shadow-amber-500/35",
  };
  return (
    <motion.span
      initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 16, delay: 0.05 }}
      className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center"
    >
      <span className={`absolute inset-0 animate-ping rounded-3xl bg-gradient-to-br opacity-20 [animation-duration:2s] ${tones[tone]}`} />
      <span className={`relative flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br text-white shadow-lg ${tones[tone]}`}>
        <Icon size={28} strokeWidth={2} />
      </span>
    </motion.span>
  );
};

/* ================= CONFIRM DELETE ================= */
const ConfirmDeleteAlert = ({ open, deleting, onConfirm, onCancel }) => (
  <Modal open={open} onClose={onCancel} dismissable={!deleting}>
    <div className="h-1.5 bg-gradient-to-r from-red-600 via-rose-500 to-orange-400" />
    <div className="px-7 pb-2 pt-7 text-center">
      <ModalIcon icon={Trash2} tone="danger" />
      <h3 className="text-xl font-extrabold tracking-tight text-gray-900">
        Delete this <span className="text-red-600">department?</span>
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-gray-500">
        It will be permanently removed from the system. This can't be undone.
      </p>
      <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-amber-50 p-3 text-left ring-1 ring-amber-100">
        <Users size={16} className="mt-0.5 shrink-0 text-amber-600" />
        <p className="text-xs leading-relaxed text-amber-800">
          Only departments with <b>no employees</b> can be deleted. Move or deactivate its people first.
        </p>
      </div>
    </div>

    <div className="flex gap-3 p-7 pt-5">
      <button
        onClick={onCancel}
        disabled={deleting}
        className="flex-1 rounded-2xl bg-gray-50 py-3.5 text-sm font-bold text-gray-600 ring-1 ring-gray-200 transition hover:bg-white hover:text-gray-900 active:scale-[0.98] disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={deleting}
        className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] disabled:translate-y-0 disabled:opacity-80"
      >
        {deleting ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Deleting…
          </>
        ) : (
          <>
            <Trash2 size={16} /> Yes, delete
          </>
        )}
      </button>
    </div>
  </Modal>
);

/* ================= SUCCESS ================= */
const AUTO_CLOSE_MS = 1800;

const DeleteSuccessAlert = ({ open, onClose }) => (
  <Modal open={open} onClose={onClose}>
    <div className="px-7 pb-2 pt-8 text-center">
      <ModalIcon icon={CheckCircle2} tone="success" />
      <h3 className="text-xl font-extrabold tracking-tight text-gray-900">Department deleted</h3>
      <p className="mt-2 text-sm text-gray-500">The directory has been updated.</p>
    </div>
    <div className="p-7 pt-5">
      <button
        onClick={onClose}
        className="w-full rounded-2xl bg-gray-900 py-3.5 text-sm font-bold text-white transition hover:bg-gray-800 active:scale-[0.98]"
      >
        Okay, got it
      </button>
    </div>
    {/* auto-close countdown */}
    {open && (
      <motion.div
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: AUTO_CLOSE_MS / 1000, ease: "linear" }}
        className="h-1 origin-left bg-gradient-to-r from-emerald-500 to-teal-400"
      />
    )}
  </Modal>
);

/* ================= ERROR (replaces browser alert) ================= */
const DeleteErrorAlert = ({ open, notEmpty, message, onClose, onViewEmployees }) => (
  <Modal open={open} onClose={onClose}>
    <button
      onClick={onClose}
      aria-label="Close"
      className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-gray-50 text-gray-400 transition hover:rotate-90 hover:text-gray-700"
    >
      <X size={15} />
    </button>
    <div className="px-7 pb-2 pt-8 text-center">
      <ModalIcon icon={notEmpty ? Users : AlertTriangle} tone="warning" />
      <h3 className="text-xl font-extrabold tracking-tight text-gray-900">
        {notEmpty ? "Department isn't empty" : "Couldn't delete"}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-gray-500">{message}</p>
    </div>
    <div className="flex gap-3 p-7 pt-5">
      {notEmpty ? (
        <>
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl bg-gray-50 py-3.5 text-sm font-bold text-gray-600 ring-1 ring-gray-200 transition hover:bg-white hover:text-gray-900 active:scale-[0.98]"
          >
            Close
          </button>
          <button
            onClick={onViewEmployees}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <Eye size={16} /> View employees
          </button>
        </>
      ) : (
        <button
          onClick={onClose}
          className="w-full rounded-2xl bg-gray-900 py-3.5 text-sm font-bold text-white transition hover:bg-gray-800 active:scale-[0.98]"
        >
          Okay
        </button>
      )}
    </div>
  </Modal>
);

/* ================= ICON BUTTON WITH TOOLTIP ================= */
const VARIANTS = {
  view: "text-sky-600 bg-sky-50 ring-sky-100 hover:bg-sky-500 hover:text-white hover:ring-sky-500 hover:shadow-sky-500/30",
  edit: "text-amber-600 bg-amber-50 ring-amber-100 hover:bg-amber-500 hover:text-white hover:ring-amber-500 hover:shadow-amber-500/30",
  danger: "text-red-600 bg-red-50 ring-red-100 hover:bg-gradient-to-br hover:from-red-600 hover:to-rose-500 hover:text-white hover:ring-red-500 hover:shadow-red-600/30",
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

    {/* tooltip */}
    <span
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1 text-[11px] font-semibold text-white opacity-0 shadow-lg transition-all duration-150 group-hover/btn:translate-y-0 group-hover/btn:opacity-100 group-focus-within/btn:translate-y-0 group-focus-within/btn:opacity-100"
    >
      {label}
      <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
    </span>
  </div>
);

/* ================= MAIN BUTTONS ================= */
export const DepartmentButtons = ({ id, onDepartmentDelete }) => {
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState(null); // { notEmpty, message }
  const [deleting, setDeleting] = useState(false);

  const viewEmployees = () => navigate(`/admin-dashboard/department/${id}/employees`);

  const finishSuccess = () => {
    setShowSuccess(false);
    onDepartmentDelete?.();
  };

  // auto-close the success popup, then refresh the list
  useEffect(() => {
    if (!showSuccess) return;
    const t = setTimeout(finishSuccess, AUTO_CLOSE_MS);
    return () => clearTimeout(t);
  }, [showSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await axios.delete(`${import.meta.env.VITE_BACKEND_URL}/api/department/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      if (res.data?.success) {
        setShowConfirm(false);
        setShowSuccess(true);
      }
    } catch (err) {
      setShowConfirm(false);
      const notEmpty = apiErrorCode(err) === "DEPARTMENT_NOT_EMPTY";
      setError({
        notEmpty,
        message: notEmpty
          ? apiErrorMessage(err, "This department still has employees. Move or deactivate them before deleting it.")
          : apiErrorMessage(err, "Something went wrong while deleting this department. Please try again."),
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <ConfirmDeleteAlert
        open={showConfirm}
        deleting={deleting}
        onConfirm={handleDelete}
        onCancel={() => !deleting && setShowConfirm(false)}
      />
      <DeleteSuccessAlert open={showSuccess} onClose={finishSuccess} />
      <DeleteErrorAlert
        open={!!error}
        notEmpty={error?.notEmpty}
        message={error?.message}
        onClose={() => setError(null)}
        onViewEmployees={() => { setError(null); viewEmployees(); }}
      />

      <div className="flex justify-end gap-2">
        <IconButton variant="view" label="View employees" icon={Eye} onClick={viewEmployees} />
        <IconButton
          variant="edit"
          label="Edit department"
          icon={Pencil}
          onClick={() => navigate(`/admin-dashboard/department/${id}`)}
        />
        <IconButton
          variant="danger"
          label="Delete department"
          icon={Trash2}
          disabled={deleting}
          onClick={() => setShowConfirm(true)}
        />
      </div>
    </>
  );
};
