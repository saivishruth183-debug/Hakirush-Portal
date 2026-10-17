import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Edit2, Trash2, Eye, AlertTriangle, Check, X, Loader2, FileX2, Award, ImageOff } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { apiErrorMessage } from "./apiError";

const AUTO_CLOSE_MS = 1200;

/* ================= MODAL SHELL ================= */
const Modal = ({ children, onClose, dismissable = true }) => {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && dismissable && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, dismissable]);

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => dismissable && onClose?.()} />
      <motion.div
        role="dialog" aria-modal="true"
        initial={{ y: 40, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 30, opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white p-7 text-left shadow-2xl ring-1 ring-gray-100"
      >
        {children}
      </motion.div>
    </motion.div>,
    document.body
  );
};

const ModalIcon = ({ tone, children }) => (
  <motion.div
    initial={{ scale: 0.5, rotate: -12 }} animate={{ scale: 1, rotate: 0 }}
    transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.05 }}
    className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ring-1 ${tone}`}
  >
    {children}
  </motion.div>
);

/* ================= CONFIRM DELETE ================= */
const ConfirmDeleteAlert = ({ onConfirm, onCancel, busy }) => (
  <Modal onClose={onCancel} dismissable={!busy}>
    <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-red-600 to-rose-400" />
    <ModalIcon tone="bg-red-50 text-red-600 ring-red-100"><Trash2 size={28} strokeWidth={2.2} /></ModalIcon>
    <h3 className="text-center text-xl font-extrabold tracking-tight text-gray-900">
      Delete this <span className="text-red-600">sponsor?</span>
    </h3>
    <p className="mt-2 text-center text-sm text-gray-500">This permanently removes the sponsor from the partner directory.</p>

    <ul className="mt-5 space-y-2 rounded-2xl bg-gray-50 p-4 ring-1 ring-gray-100">
      {[
        [Award, "They'll disappear from the sponsor list"],
        [ImageOff, "Their logo and details are removed"],
        [FileX2, "This can't be undone"],
      ].map(([Icon, text]) => (
        <li key={text} className="flex items-center gap-2.5 text-xs font-medium text-gray-600">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-red-500 shadow-sm"><Icon size={13} /></span>
          {text}
        </li>
      ))}
    </ul>

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
  </Modal>
);

/* ================= SUCCESS ================= */
const DeleteSuccessAlert = ({ onClose }) => (
  <Modal onClose={onClose}>
    <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400" />
    <ModalIcon tone="bg-emerald-50 text-emerald-600 ring-emerald-100"><Check size={30} strokeWidth={2.5} /></ModalIcon>
    <h3 className="text-center text-xl font-extrabold tracking-tight text-gray-900">Sponsor deleted</h3>
    <p className="mt-2 text-center text-sm text-gray-500">The sponsor directory has been updated.</p>
    <div className="mt-5 h-1 overflow-hidden rounded-full bg-gray-100">
      <motion.div
        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400"
        initial={{ width: "100%" }} animate={{ width: "0%" }}
        transition={{ duration: AUTO_CLOSE_MS / 1000, ease: "linear" }}
      />
    </div>
  </Modal>
);

/* ================= ERROR ================= */
const ErrorAlert = ({ message, onClose }) => (
  <Modal onClose={onClose}>
    <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-red-600 to-rose-400" />
    <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600">
      <X size={16} />
    </button>
    <ModalIcon tone="bg-red-50 text-red-600 ring-red-100"><AlertTriangle size={28} /></ModalIcon>
    <h3 className="text-center text-xl font-extrabold tracking-tight text-gray-900">Couldn't delete</h3>
    <p className="mt-2 text-center text-sm leading-relaxed text-gray-500">{message}</p>
    <button
      onClick={onClose}
      className="mt-6 w-full rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:brightness-110 active:scale-[0.98]"
    >
      Got it
    </button>
  </Modal>
);

/* ================= ICON BUTTON WITH TOOLTIP ================= */
const VARIANTS = {
  view: "bg-sky-50 text-sky-600 ring-sky-100 hover:bg-sky-500 hover:text-white hover:ring-sky-500 hover:shadow-sky-500/30",
  edit: "bg-amber-50 text-amber-600 ring-amber-100 hover:bg-amber-500 hover:text-white hover:ring-amber-500 hover:shadow-amber-500/30",
  danger: "bg-red-50 text-red-600 ring-red-100 hover:bg-red-600 hover:text-white hover:ring-red-600 hover:shadow-red-600/30",
};

const IconButton = ({ icon, label, onClick, variant = "view", disabled }) => (
  <div className="group/btn relative">
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.92 }}
      className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 transition-colors duration-200 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]}`}
      aria-label={label}
    >
      {icon}
    </motion.button>
    <span className="pointer-events-none absolute -top-9 left-1/2 z-30 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1 text-[11px] font-semibold text-white opacity-0 shadow-lg transition-all duration-150 group-hover/btn:translate-y-0 group-hover/btn:opacity-100">
      {label}
      <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
    </span>
  </div>
);

/* ================= MAIN BUTTONS ================= */
export const SponsorButtons = ({ id, refresh }) => {
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const deleteSponsor = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const response = await axios.delete(
        `${import.meta.env.VITE_BACKEND_URL}/api/sponsors/${id}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.data.success) {
        setShowConfirm(false);
        setShowSuccess(true);

        setTimeout(() => {
          setShowSuccess(false);
          if (refresh) refresh();
        }, AUTO_CLOSE_MS);
      }
    } catch (err) {
      console.error(err);
      setShowConfirm(false);
      setErrorMsg(apiErrorMessage(err, "System Error: Unable to delete sponsor record."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {showConfirm && (
          <ConfirmDeleteAlert
            key="confirm"
            busy={deleting}
            onConfirm={deleteSponsor}
            onCancel={() => setShowConfirm(false)}
          />
        )}
        {showSuccess && (
          <DeleteSuccessAlert key="success" onClose={() => setShowSuccess(false)} />
        )}
        {errorMsg && (
          <ErrorAlert key="error" message={errorMsg} onClose={() => setErrorMsg("")} />
        )}
      </AnimatePresence>

      <div className="flex items-center justify-end gap-1.5">
        <IconButton
          variant="view"
          label="View details"
          icon={<Eye size={16} />}
          onClick={() => navigate(`/admin-dashboard/sponsors/${id}`)}
        />
        <IconButton
          variant="edit"
          label="Edit sponsor"
          icon={<Edit2 size={15} />}
          onClick={() => navigate(`/admin-dashboard/sponsors/edit/${id}`)}
        />
        <span className="mx-0.5 h-6 w-px bg-gray-200" aria-hidden="true" />
        <IconButton
          variant="danger"
          label="Delete sponsor"
          icon={<Trash2 size={15} />}
          disabled={deleting}
          onClick={() => setShowConfirm(true)}
        />
      </div>
    </>
  );
};

/* ✅ API Helper */
export const fetchSponsors = async () => {
  try {
    const res = await axios.get(
      `${import.meta.env.VITE_BACKEND_URL}/api/sponsors`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      }
    );
    return res.data.success ? res.data.sponsors : [];
  } catch (error) {
    console.error("Core Sync Error:", error.response?.data || error);
    return [];
  }
};
