import axios from "axios";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ImagePlus, Trash2, Loader2, Plus, Save, Trophy, Images, RefreshCw, UploadCloud,
  X, AlertTriangle, CheckCircle2, ZoomIn, ChevronLeft, ChevronRight, Type, Medal,
  Search,
} from "lucide-react";
import { apiErrorMessage } from "../../utils/apiError";

const BACKEND = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/+$/, "");
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

const resolveImageUrl = (url) => {
  if (!url || typeof url !== "string") return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${BACKEND}/${url.replace(/^\/+/, "")}`;
};

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_GALLERY_IMAGE_BYTES = 50 * 1024 * 1024;
const NUMERIC_FIELDS = ["played", "won", "lost", "points"];
const CAPTION_MAX = 200;

const CARD =
  "rounded-3xl bg-white/90 ring-1 ring-white/70 shadow-[0_10px_40px_-12px_rgba(127,29,29,0.18)] backdrop-blur";
const fmtBytes = (b) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const previousMonthValue = () => {
  const month = new Date();
  month.setDate(1);
  month.setMonth(month.getMonth() - 1);
  return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
};

export const SharedGalleryManager = () => {
  const [month, setMonth] = useState(previousMonthValue);
  const [images, setImages] = useState([]);
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [confirmImg, setConfirmImg] = useState(null);
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [justUploaded, setJustUploaded] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${BACKEND}/api/client/gallery/shared?month=${month}`, { headers: authHeaders() });
      setImages(Array.isArray(res.data?.images) ? res.data.images : []);
      setLoadError("");
    } catch (err) {
      setLoadError(apiErrorMessage(err, "Couldn't load the shared gallery."));
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (lightboxIdx === null) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setLightboxIdx(null);
      if (event.key === "ArrowRight") setLightboxIdx((index) => (index + 1) % images.length);
      if (event.key === "ArrowLeft") setLightboxIdx((index) => (index - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIdx, images.length]);

  const pick = (picked) => {
    setUploadError("");
    setJustUploaded(false);
    if (picked && picked.size > MAX_GALLERY_IMAGE_BYTES) {
      setUploadError("Image must be 50 MB or smaller.");
      setFile(null);
      return;
    }
    if (picked && !ACCEPTED_IMAGE_TYPES.includes(picked.type)) {
      setUploadError("Choose a JPEG, PNG, WebP or GIF image.");
      setFile(null);
      return;
    }
    setFile(picked);
  };

  const clearFile = () => {
    setFile(null);
    setFileInputKey((current) => current + 1);
  };

  const upload = async (event) => {
    event.preventDefault();
    if (!file || uploading) return;
    setUploading(true);
    setUploadError("");
    try {
      const authRes = await axios.get(`${BACKEND}/api/client/gallery/shared/upload-auth`, { headers: authHeaders() });
      const { publicKey, uploadEndpoint, folder, authenticationParameters, maxFileBytes } = authRes.data;
      if (!Number.isSafeInteger(maxFileBytes) || file.size > maxFileBytes) {
        throw new Error("Image must be 50 MB or smaller.");
      }
      const body = new FormData();
      body.append("file", file);
      body.append("fileName", file.name);
      body.append("folder", folder);
      body.append("publicKey", publicKey);
      Object.entries(authenticationParameters).forEach(([key, value]) => body.append(key, String(value)));
      const uploaded = await axios.post(uploadEndpoint, body);
      await axios.post(
        `${BACKEND}/api/client/gallery/shared`,
        { fileId: uploaded.data?.fileId, month, caption: caption.trim() },
        { headers: { ...authHeaders(), "Content-Type": "application/json" } }
      );
      setFile(null);
      setFileInputKey((current) => current + 1);
      setCaption("");
      setJustUploaded(true);
      setTimeout(() => setJustUploaded(false), 2500);
      await load();
    } catch (err) {
      setUploadError(err?.response ? apiErrorMessage(err, "Couldn't upload the shared image.") : err?.message || "Couldn't upload the shared image.");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (imageId) => {
    if (deletingId) return;
    setDeletingId(imageId);
    try {
      await axios.delete(`${BACKEND}/api/client/gallery/shared/${imageId}`, { headers: authHeaders() });
      setImages((current) => current.filter((image) => image._id !== imageId));
      setConfirmImg(null);
    } catch (err) {
      setConfirmImg(null);
      setDeleteError(apiErrorMessage(err, "Couldn't delete the shared image."));
    } finally {
      setDeletingId(null);
    }
  };

  const lbImg = lightboxIdx !== null ? images[lightboxIdx] : null;

  return (
    <Card
      icon={<Images size={18} />}
      title="Shared client gallery"
      subtitle="Monthly highlight images shown to every client"
      right={!loading && !loadError && (
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
          {images.length} image{images.length === 1 ? "" : "s"}
        </span>
      )}
    >
      <AnimatePresence>
        {confirmImg && (
          <Modal key="confirm-shared" onClose={() => setConfirmImg(null)} dismissable={!deletingId}>
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-red-600 to-rose-400" />
            <div className="mx-auto mb-4 h-32 w-full overflow-hidden rounded-2xl bg-gray-100 ring-1 ring-gray-100">
              <img src={resolveImageUrl(confirmImg.url)} alt="" className="h-full w-full object-cover" />
            </div>
            <h3 className="text-center text-xl font-extrabold tracking-tight text-gray-900">Delete this <span className="text-red-600">shared image?</span></h3>
            <p className="mt-2 text-center text-sm text-gray-500">It will be removed from every client’s gallery. This can’t be undone.</p>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirmImg(null)} disabled={!!deletingId}
                className="rounded-2xl bg-gray-100 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-200 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={() => remove(confirmImg._id)} disabled={!!deletingId}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:brightness-110 disabled:opacity-70">
                {deletingId ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {deletingId ? "Deleting…" : "Delete"}
              </button>
            </div>
          </Modal>
        )}
        {deleteError && (
          <Modal key="shared-delete-error" onClose={() => setDeleteError("")}>
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-red-600 to-rose-400" />
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100"><AlertTriangle size={26} /></div>
            <h3 className="text-center text-lg font-extrabold text-gray-900">Couldn’t delete</h3>
            <p className="mt-2 text-center text-sm text-gray-500">{deleteError}</p>
            <button type="button" onClick={() => setDeleteError("")}
              className="mt-6 w-full rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 hover:brightness-110">Got it</button>
          </Modal>
        )}
      </AnimatePresence>

      {createPortal(
        <AnimatePresence>
          {lbImg && (
            <motion.div key="shared-lightbox" className="fixed inset-0 z-[95] flex flex-col items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setLightboxIdx(null)}>
              <button type="button" aria-label="Close" className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><X size={18} /></button>
              {images.length > 1 && (
                <>
                  <button type="button" aria-label="Previous" onClick={(event) => { event.stopPropagation(); setLightboxIdx((index) => (index - 1 + images.length) % images.length); }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20 sm:left-6"><ChevronLeft size={20} /></button>
                  <button type="button" aria-label="Next" onClick={(event) => { event.stopPropagation(); setLightboxIdx((index) => (index + 1) % images.length); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20 sm:right-6"><ChevronRight size={20} /></button>
                </>
              )}
              <motion.img key={lbImg._id} src={resolveImageUrl(lbImg.url)} alt={lbImg.caption || "Shared client gallery image"}
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                onClick={(event) => event.stopPropagation()}
                className="max-h-[78vh] max-w-full rounded-2xl object-contain shadow-2xl" />
              <p className="mt-4 max-w-xl text-center text-sm text-white/85">{lbImg.caption || <span className="text-white/40">No caption</span>}</p>
              <p className="mt-1 text-xs text-white/40">{lightboxIdx + 1} / {images.length}</p>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <form onSubmit={upload} className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div>
          <AnimatePresence mode="wait" initial={false}>
            {file && preview ? (
              <motion.div key="shared-preview" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
                className="relative h-44 overflow-hidden rounded-2xl ring-1 ring-gray-200">
                <img src={preview} alt="Selected shared gallery image" className="h-full w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8 text-white">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{file.name}</p>
                    <p className="text-[11px] text-white/70">{fmtBytes(file.size)}</p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button type="button" onClick={() => fileRef.current?.click()}
                      className="rounded-lg bg-white/20 px-2.5 py-1 text-[11px] font-semibold backdrop-blur hover:bg-white/30">Change</button>
                    <button type="button" onClick={clearFile} aria-label="Remove selected image"
                      className="rounded-lg bg-white/20 p-1.5 backdrop-blur hover:bg-red-600"><X size={13} /></button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="shared-dropzone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                role="button" tabIndex={0}
                onClick={() => fileRef.current?.click()}
                onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && (event.preventDefault(), fileRef.current?.click())}
                onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => { event.preventDefault(); setDragOver(false); pick(event.dataTransfer.files?.[0] || null); }}
                className={`group flex h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center outline-none transition focus-visible:ring-2 focus-visible:ring-red-400 ${
                  dragOver ? "border-red-400 bg-red-50/70" : "border-gray-200 bg-gray-50/50 hover:border-red-300 hover:bg-red-50/30"
                }`}>
                <motion.div animate={dragOver ? { y: -4, scale: 1.08 } : { y: 0, scale: 1 }}
                  className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-gray-400 shadow-sm ring-1 ring-gray-100 transition group-hover:text-red-500">
                  <UploadCloud size={22} />
                </motion.div>
                <p className="text-sm font-semibold text-gray-700">{dragOver ? "Drop to add" : <>Drag &amp; drop or <span className="text-red-600">browse</span></>}</p>
                <p className="mt-0.5 text-xs text-gray-400">JPEG, PNG, WebP or GIF · up to 50 MB</p>
              </motion.div>
            )}
          </AnimatePresence>
          <input key={fileInputKey} ref={fileRef} type="file" accept={ACCEPTED_IMAGE_TYPES.join(",")} onChange={(event) => pick(event.target.files?.[0] || null)} className="hidden" />
        </div>

        <div className="flex flex-col gap-3">
          <label htmlFor="shared-gallery-month" className="text-xs font-semibold text-gray-600">
            Gallery month
            <input id="shared-gallery-month" type="month" required value={month} onChange={(event) => setMonth(event.target.value)}
              className="mt-1 block w-full rounded-xl bg-white px-3 py-2.5 text-sm text-gray-900 outline-none ring-1 ring-gray-200 focus:ring-2 focus:ring-red-400" />
          </label>
          <div className="flex items-center justify-between">
            <label htmlFor="shared-gallery-caption" className="text-xs font-semibold text-gray-600">Caption <span className="font-normal text-gray-400">(optional)</span></label>
            <span className={`text-[11px] tabular-nums ${caption.length > CAPTION_MAX - 20 ? "text-amber-600" : "text-gray-400"}`}>{caption.length}/{CAPTION_MAX}</span>
          </div>
          <textarea id="shared-gallery-caption" value={caption} maxLength={CAPTION_MAX}
            onChange={(event) => setCaption(event.target.value)} placeholder="e.g. Finals day, under-16 team" rows={3}
            className="min-h-[72px] w-full resize-none rounded-2xl bg-white px-4 py-3 text-sm text-gray-900 outline-none ring-1 ring-gray-200 transition placeholder:text-gray-300 focus:ring-2 focus:ring-red-400" />
          <button type="submit" disabled={uploading || !file}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
            {uploading ? "Uploading…" : file ? "Add to all clients" : "Choose an image first"}
          </button>
        </div>
      </form>
      <AnimatePresence>
        {uploadError && <Notice key="shared-upload-error" onClose={() => setUploadError("")}>{uploadError}</Notice>}
        {justUploaded && <Notice key="shared-upload-ok" tone="ok">Image added to the shared gallery.</Notice>}
      </AnimatePresence>

      <div className="mt-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => <div key={index} className="aspect-[4/3] animate-pulse rounded-2xl bg-gray-100" />)}
          </div>
        ) : loadError ? (
          <RetryBlock message={loadError} onRetry={load} />
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-gray-200 px-4 py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-300"><Images size={22} /></div>
            <p className="text-sm font-semibold text-gray-600">No shared images for this month</p>
            <p className="text-xs text-gray-400">Add a highlight above to show it on every client dashboard.</p>
          </div>
        ) : (
          <motion.div layout className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <AnimatePresence initial={false}>
              {images.map((image, index) => (
                <motion.figure key={image._id} layout
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                  className="group relative overflow-hidden rounded-2xl bg-gray-100 ring-1 ring-gray-100">
                  <button type="button" onClick={() => setLightboxIdx(index)} className="block w-full cursor-zoom-in" aria-label="Open shared image">
                    <img src={resolveImageUrl(image.url)} alt={image.caption || "Shared client gallery image"} loading="lazy"
                      className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-105" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100">
                      <span className="rounded-full bg-white/90 p-2 text-gray-800 shadow"><ZoomIn size={16} /></span>
                    </span>
                  </button>
                  <figcaption className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6 text-xs font-medium text-white">
                    {image.caption || <span className="text-white/50">No caption</span>}
                  </figcaption>
                  <button type="button" onClick={() => setConfirmImg(image)} disabled={deletingId === image._id}
                    aria-label="Delete shared image" title="Delete shared image"
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-xl bg-white/90 text-red-600 shadow-md backdrop-blur transition hover:bg-red-600 hover:text-white disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100">
                    {deletingId === image._id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </motion.figure>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </Card>
  );
};

/* ================= SHARED UI ================= */
const Card = ({ icon, title, subtitle, right, children }) => (
  <motion.section
    initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
    className={`${CARD} mt-6 p-5 sm:p-6`}
  >
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-rose-500 text-white shadow-md shadow-red-600/25">
          {icon}
        </span>
        <div>
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
    {children}
  </motion.section>
);

const Notice = ({ tone = "error", children, onClose }) => (
  <motion.div
    role={tone === "error" ? "alert" : "status"}
    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
    className={`mt-3 flex items-start gap-2 rounded-2xl px-3.5 py-2.5 text-xs font-medium ring-1 ${
      tone === "error" ? "bg-red-50 text-red-700 ring-red-100" : "bg-emerald-50 text-emerald-700 ring-emerald-100"
    }`}
  >
    {tone === "error" ? <AlertTriangle size={14} className="mt-px shrink-0" /> : <CheckCircle2 size={14} className="mt-px shrink-0" />}
    <span className="flex-1">{children}</span>
    {onClose && (
      <button type="button" onClick={onClose} aria-label="Dismiss" className="rounded p-0.5 opacity-60 hover:opacity-100"><X size={12} /></button>
    )}
  </motion.div>
);

const RetryBlock = ({ message, onRetry }) => (
  <div className="flex flex-col items-center rounded-2xl bg-red-50/60 p-6 text-center ring-1 ring-red-100">
    <AlertTriangle size={20} className="text-red-500" />
    <p className="mt-2 text-sm font-semibold text-red-700">{message}</p>
    <button type="button" onClick={onRetry}
      className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-red-600 ring-1 ring-red-200 transition hover:bg-red-600 hover:text-white">
      <RefreshCw size={12} /> Retry
    </button>
  </div>
);

const Modal = ({ children, onClose, dismissable = true }) => {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && dismissable && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, dismissable]);
  return createPortal(
    <motion.div className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => dismissable && onClose?.()} />
      <motion.div role="dialog" aria-modal="true"
        initial={{ y: 40, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 30, opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white p-7 shadow-2xl ring-1 ring-gray-100">
        {children}
      </motion.div>
    </motion.div>,
    document.body
  );
};

/* ================= GALLERY ================= */
export const ClientGalleryManager = ({ clientId }) => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [inputKey, setInputKey] = useState(0);
  // UI-only
  const [preview, setPreview] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [confirmImg, setConfirmImg] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const [justUploaded, setJustUploaded] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${BACKEND}/api/client/${clientId}/gallery`, { headers: authHeaders() });
      setImages(Array.isArray(res.data?.images) ? res.data.images : []);
      setLoadError("");
    } catch (err) {
      setLoadError(apiErrorMessage(err, "Couldn't load the gallery."));
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  // object URL for the selected file's preview
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (picked) => {
    setUploadError("");
    setJustUploaded(false);
    if (picked && picked.size > MAX_GALLERY_IMAGE_BYTES) {
      setUploadError("Image must be 50 MB or smaller.");
      setFile(null);
      return;
    }
    if (picked && !ACCEPTED_IMAGE_TYPES.includes(picked.type)) {
      setUploadError("Choose a JPEG, PNG, WebP or GIF image.");
      setFile(null);
      return;
    }
    setFile(picked);
  };

  const onFileChange = (e) => pick(e.target.files?.[0] || null);

  const clearFile = () => {
    setFile(null);
    setInputKey((k) => k + 1);
  };

  const upload = async (e) => {
    e.preventDefault();
    if (uploading) return;
    if (!file) {
      setUploadError("Choose an image to upload.");
      return;
    }
    if (file.size > MAX_GALLERY_IMAGE_BYTES) {
      setUploadError("Image must be 50 MB or smaller.");
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const authResponse = await axios.get(
        `${BACKEND}/api/client/${clientId}/gallery/upload-auth`,
        { headers: authHeaders() }
      );
      const { publicKey, uploadEndpoint, folder, maxFileBytes, authenticationParameters } = authResponse.data;
      if (!Number.isSafeInteger(maxFileBytes) || file.size > maxFileBytes) {
        setUploadError("Image must be 50 MB or smaller.");
        return;
      }
      const uploadForm = new FormData();
      uploadForm.append("file", file);
      uploadForm.append("fileName", file.name);
      uploadForm.append("folder", folder);
      uploadForm.append("publicKey", publicKey);
      Object.entries(authenticationParameters).forEach(([key, value]) => {
        uploadForm.append(key, String(value));
      });
      const uploaded = await axios.post(uploadEndpoint, uploadForm);
      const res = await axios.post(
        `${BACKEND}/api/client/${clientId}/gallery`,
        { fileId: uploaded.data?.fileId, caption: caption.trim() },
        { headers: { ...authHeaders(), "Content-Type": "application/json" } }
      );
      const created = res.data?.image;
      if (created && created._id) {
        setImages((prev) => [created, ...prev]);
      } else {
        await load();
      }
      setFile(null);
      setCaption("");
      setInputKey((k) => k + 1); // reset the file input
      setJustUploaded(true);
      setTimeout(() => setJustUploaded(false), 2500);
    } catch (err) {
      setUploadError(apiErrorMessage(err, "Upload failed."));
    } finally {
      setUploading(false);
    }
  };

  const remove = async (imageId) => {
    if (deletingId) return;
    setDeletingId(imageId);
    try {
      await axios.delete(`${BACKEND}/api/client/${clientId}/gallery/${imageId}`, { headers: authHeaders() });
      setImages((prev) => prev.filter((img) => img._id !== imageId));
      setConfirmImg(null);
    } catch (err) {
      setConfirmImg(null);
      setDeleteError(apiErrorMessage(err, "Couldn't delete this image."));
    } finally {
      setDeletingId(null);
    }
  };

  // lightbox keyboard nav
  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e) => {
      if (e.key === "Escape") setLightboxIdx(null);
      if (e.key === "ArrowRight") setLightboxIdx((i) => (i + 1) % images.length);
      if (e.key === "ArrowLeft") setLightboxIdx((i) => (i - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIdx, images.length]);

  const lbImg = lightboxIdx !== null ? images[lightboxIdx] : null;

  return (
    <Card
      icon={<Images size={18} />}
      title="Client gallery"
      subtitle="Images shown on the client's dashboard"
      right={!loading && !loadError && (
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
          {images.length} image{images.length === 1 ? "" : "s"}
        </span>
      )}
    >
      {/* Modals */}
      <AnimatePresence>
        {confirmImg && (
          <Modal key="confirm" onClose={() => setConfirmImg(null)} dismissable={!deletingId}>
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-red-600 to-rose-400" />
            <div className="mx-auto mb-4 h-32 w-full overflow-hidden rounded-2xl bg-gray-100 ring-1 ring-gray-100">
              <img src={resolveImageUrl(confirmImg.url)} alt="" className="h-full w-full object-cover" />
            </div>
            <h3 className="text-center text-xl font-extrabold tracking-tight text-gray-900">Delete this <span className="text-red-600">image?</span></h3>
            <p className="mt-2 text-center text-sm text-gray-500">It will be removed from the client's gallery straight away. This can't be undone.</p>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirmImg(null)} disabled={!!deletingId}
                className="rounded-2xl bg-gray-100 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-200 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={() => remove(confirmImg._id)} disabled={!!deletingId}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:brightness-110 disabled:opacity-70">
                {deletingId ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                {deletingId ? "Deleting…" : "Delete"}
              </button>
            </div>
          </Modal>
        )}
        {deleteError && (
          <Modal key="err" onClose={() => setDeleteError("")}>
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-red-600 to-rose-400" />
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100"><AlertTriangle size={26} /></div>
            <h3 className="text-center text-lg font-extrabold text-gray-900">Couldn't delete</h3>
            <p className="mt-2 text-center text-sm text-gray-500">{deleteError}</p>
            <button type="button" onClick={() => setDeleteError("")}
              className="mt-6 w-full rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 hover:brightness-110">Got it</button>
          </Modal>
        )}
      </AnimatePresence>

      {/* Lightbox */}
      {createPortal(
        <AnimatePresence>
          {lbImg && (
            <motion.div key="lb" className="fixed inset-0 z-[95] flex flex-col items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setLightboxIdx(null)}>
              <button type="button" aria-label="Close" className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><X size={18} /></button>
              {images.length > 1 && (
                <>
                  <button type="button" aria-label="Previous" onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => (i - 1 + images.length) % images.length); }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20 sm:left-6"><ChevronLeft size={20} /></button>
                  <button type="button" aria-label="Next" onClick={(e) => { e.stopPropagation(); setLightboxIdx((i) => (i + 1) % images.length); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20 sm:right-6"><ChevronRight size={20} /></button>
                </>
              )}
              <motion.img key={lbImg._id} src={resolveImageUrl(lbImg.url)} alt={lbImg.caption || "Client gallery image"}
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                onClick={(e) => e.stopPropagation()}
                className="max-h-[78vh] max-w-full rounded-2xl object-contain shadow-2xl" />
              <p className="mt-4 max-w-xl text-center text-sm text-white/85">{lbImg.caption || <span className="text-white/40">No caption</span>}</p>
              <p className="mt-1 text-xs text-white/40">{lightboxIdx + 1} / {images.length}</p>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Upload form */}
      <form onSubmit={upload} className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Dropzone / preview */}
        <div>
          <AnimatePresence mode="wait" initial={false}>
            {file && preview ? (
              <motion.div key="preview" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
                className="relative h-44 overflow-hidden rounded-2xl ring-1 ring-gray-200">
                <img src={preview} alt="Selected" className="h-full w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8 text-white">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{file.name}</p>
                    <p className="text-[11px] text-white/70">{fmtBytes(file.size)}</p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button type="button" onClick={() => fileRef.current?.click()}
                      className="rounded-lg bg-white/20 px-2.5 py-1 text-[11px] font-semibold backdrop-blur hover:bg-white/30">Change</button>
                    <button type="button" onClick={clearFile} aria-label="Remove selected image"
                      className="rounded-lg bg-white/20 p-1.5 backdrop-blur hover:bg-red-600"><X size={13} /></button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                role="button" tabIndex={0}
                onClick={() => fileRef.current?.click()}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), fileRef.current?.click())}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer.files?.[0] || null); }}
                className={`group flex h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center outline-none transition focus-visible:ring-2 focus-visible:ring-red-400 ${
                  dragOver ? "border-red-400 bg-red-50/70" : "border-gray-200 bg-gray-50/50 hover:border-red-300 hover:bg-red-50/30"
                }`}>
                <motion.div animate={dragOver ? { y: -4, scale: 1.08 } : { y: 0, scale: 1 }}
                  className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-gray-400 shadow-sm ring-1 ring-gray-100 transition group-hover:text-red-500">
                  <UploadCloud size={22} />
                </motion.div>
                <p className="text-sm font-semibold text-gray-700">{dragOver ? "Drop to add" : <>Drag & drop or <span className="text-red-600">browse</span></>}</p>
                <p className="mt-0.5 text-xs text-gray-400">JPEG, PNG, WebP or GIF · up to 50 MB</p>
              </motion.div>
            )}
          </AnimatePresence>
          <input key={inputKey} ref={fileRef} type="file" accept={ACCEPTED_IMAGE_TYPES.join(",")} onChange={onFileChange} className="hidden" />
        </div>

        {/* Caption + submit */}
        <div className="flex flex-col">
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="gallery-caption" className="text-xs font-semibold text-gray-600">Caption <span className="font-normal text-gray-400">(optional)</span></label>
            <span className={`text-[11px] tabular-nums ${caption.length > CAPTION_MAX - 20 ? "text-amber-600" : "text-gray-400"}`}>{caption.length}/{CAPTION_MAX}</span>
          </div>
          <div className="group relative flex-1">
            <Type size={15} className="pointer-events-none absolute left-3.5 top-3.5 text-gray-400 transition group-focus-within:text-red-500" />
            <textarea
              id="gallery-caption"
              value={caption}
              maxLength={CAPTION_MAX}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="e.g. Finals day, under-16 team"
              rows={3}
              className="h-full min-h-[96px] w-full resize-none rounded-2xl bg-white py-3 pl-10 pr-4 text-sm text-gray-900 outline-none ring-1 ring-gray-200 transition placeholder:text-gray-300 focus:ring-2 focus:ring-red-400"
            />
          </div>
          <button
            type="submit"
            disabled={uploading || !file}
            className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
            {uploading ? "Uploading…" : file ? "Upload image" : "Choose an image first"}
          </button>
        </div>
      </form>
      <AnimatePresence>
        {uploadError && <Notice key="ue" onClose={() => setUploadError("")}>{uploadError}</Notice>}
        {justUploaded && <Notice key="ok" tone="ok">Image added to the gallery.</Notice>}
      </AnimatePresence>

      {/* Grid */}
      <div className="mt-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-gray-100" />)}
          </div>
        ) : loadError ? (
          <RetryBlock message={loadError} onRetry={() => { setLoading(true); load(); }} />
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-gray-200 px-4 py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-300"><Images size={22} /></div>
            <p className="text-sm font-semibold text-gray-600">No gallery images yet</p>
            <p className="text-xs text-gray-400">Upload the first photo above, and it will show on the client's dashboard.</p>
          </div>
        ) : (
          <motion.div layout className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <AnimatePresence initial={false}>
              {images.map((img, i) => (
                <motion.figure
                  key={img._id} layout
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                  className="group relative overflow-hidden rounded-2xl bg-gray-100 ring-1 ring-gray-100"
                >
                  <button type="button" onClick={() => setLightboxIdx(i)} className="block w-full cursor-zoom-in" aria-label="Open image">
                    <img src={resolveImageUrl(img.url)} alt={img.caption || "Client gallery image"} loading="lazy"
                      className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-105" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100">
                      <span className="rounded-full bg-white/90 p-2 text-gray-800 shadow"><ZoomIn size={16} /></span>
                    </span>
                  </button>
                  <figcaption className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6 text-xs font-medium text-white">
                    {img.caption || <span className="text-white/50">No caption</span>}
                  </figcaption>
                  <button
                    type="button"
                    onClick={() => setConfirmImg(img)}
                    disabled={deletingId === img._id}
                    aria-label="Delete image"
                    title="Delete image"
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-xl bg-white/90 text-red-600 shadow-md backdrop-blur transition hover:bg-red-600 hover:text-white disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                  >
                    {deletingId === img._id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </motion.figure>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </Card>
  );
};

/* ================= PERFORMANCE STANDINGS ================= */
const emptyRow = (clientId = "") => ({
  key: `new-${Math.random().toString(36).slice(2)}`,
  clientId,
  clientName: "",
  unassigned: false,
  teamName: "",
  played: "0",
  won: "0",
  lost: "0",
  points: "0",
});

const toRow = (s, i, defaultClientId = "") => ({
  key: s._id || `row-${i}`,
  clientId: String(s.clientId || defaultClientId || ""),
  clientName: s.clientName || "",
  unassigned: !s.clientId && !defaultClientId,
  teamName: s.teamName || "",
  played: String(s.played ?? 0),
  won: String(s.won ?? 0),
  lost: String(s.lost ?? 0),
  points: String(s.points ?? 0),
});

const FIELD_LABELS = { played: "P", won: "W", lost: "L", points: "Pts" };
const FIELD_TITLES = { played: "Played", won: "Won", lost: "Lost", points: "Points" };
const MEDAL = ["bg-amber-400 text-white", "bg-gray-300 text-white", "bg-orange-400 text-white"];

const ClientPicker = ({ clients, value, onChange, invalid, unassigned, usedClientIds = [] }) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = clients.find((client) => String(client._id) === value);
  const filteredClients = clients.filter((client) => String(client.name || "").toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="relative min-w-[11rem]">
      <div className={`flex items-center gap-2 rounded-xl bg-white px-3 ring-1 transition focus-within:ring-2 ${
        invalid ? "ring-red-300 focus-within:ring-red-400" : "ring-gray-200 focus-within:ring-red-400"
      }`}>
        <Search size={14} className="shrink-0 text-gray-400" />
        <input
          aria-label="Client"
          aria-expanded={open}
          role="combobox"
          value={open ? query : selected?.name || (unassigned ? "Unassigned" : "")}
          placeholder="Select client"
          onFocus={() => { setQuery(""); setOpen(true); }}
          onChange={(event) => setQuery(event.target.value)}
          onBlur={() => setOpen(false)}
          className="w-full min-w-0 py-2 text-sm font-medium text-gray-800 outline-none placeholder:font-normal placeholder:text-gray-300"
        />
      </div>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-xl bg-white p-1 shadow-xl ring-1 ring-gray-200">
          {filteredClients.length ? filteredClients.map((client) => {
            const clientId = String(client._id);
            const usedElsewhere = usedClientIds.includes(clientId);
            return (
              <button
                key={client._id}
                type="button"
                disabled={usedElsewhere}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => { onChange(clientId, client.name); setOpen(false); }}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                  usedElsewhere
                    ? "cursor-not-allowed text-gray-300"
                    : clientId === value
                      ? "bg-red-50 font-semibold text-red-700"
                      : "text-gray-700 hover:bg-red-50 hover:text-red-700"
                }`}
              >
                {client.name}{usedElsewhere ? " · already added" : ""}
              </button>
            );
          }) : <p className="px-3 py-2 text-xs text-gray-400">No clients found.</p>}
        </div>
      )}
    </div>
  );
};

export const ClientStandingsEditor = ({ clientId }) => {
  const performanceUrl = clientId
    ? `${BACKEND}/api/client/${clientId}/performance`
    : `${BACKEND}/api/client/shared/performance`;
  const [rows, setRows] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false); // UI-only
  const [clients, setClients] = useState([]);

  const load = useCallback(async () => {
    try {
      const requests = [axios.get(performanceUrl, { headers: authHeaders() })];
      if (!clientId) requests.push(axios.get(`${BACKEND}/api/client/admin/list`, { headers: authHeaders() }));
      const [res, clientsRes] = await Promise.all(requests);
      const list = Array.isArray(res.data?.standings) ? res.data.standings : [];
      setRows(list.map((standing, index) => toRow(standing, index, clientId)));
      if (clientsRes) setClients(Array.isArray(clientsRes.data?.clients) ? clientsRes.data.clients : []);
      setUpdatedAt(res.data?.updatedAt || null);
      setLoadError("");
      setDirty(false);
    } catch (err) {
      setLoadError(apiErrorMessage(err, "Couldn't load standings."));
    } finally {
      setLoading(false);
    }
  }, [clientId, performanceUrl]);

  useEffect(() => {
    load();
  }, [load]);

  const updateRow = (key, field, value) => {
    setSaved(false);
    setDirty(true);
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  };

  const addRow = () => {
    setSaved(false);
    setDirty(true);
    setRows((prev) => [...prev, emptyRow(clientId)]);
  };

  const removeRow = (key) => {
    setSaved(false);
    setDirty(true);
    setRows((prev) => prev.filter((r) => r.key !== key));
  };

  // Mirrors the server rules so most mistakes are caught before saving.
  const validate = () => {
    const seen = new Set();
    for (const [i, r] of rows.entries()) {
      if (!clientId) {
        if (!r.clientId) return `Row ${i + 1}: client is required.`;
        if (seen.has(r.clientId)) return `Row ${i + 1}: each client can only be listed once.`;
        seen.add(r.clientId);
      }
      if (clientId) {
        const name = r.teamName.trim();
        if (!name) return `Row ${i + 1}: team name is required.`;
        const key = `${r.clientId}:${name.toLowerCase()}`;
        if (seen.has(key)) return `Row ${i + 1}: duplicate team name "${name}" for this client.`;
        seen.add(key);
      }
      for (const f of clientId ? NUMERIC_FIELDS : ["played", "won", "lost"]) {
        if (!/^\d+$/.test(String(r[f]).trim())) return `Row ${i + 1}: ${f} must be a whole number (0 or more).`;
      }
      if (Number(r.won) + Number(r.lost) > Number(r.played)) {
        return `Row ${i + 1}: won + lost cannot exceed played.`;
      }
    }
    return "";
  };

  const save = async () => {
    if (saving) return;
    const problem = validate();
    if (problem) {
      setSaveError(problem);
      return;
    }
    setSaving(true);
    setSaveError("");
    setSaved(false);
    try {
      const standings = rows.map((r) => clientId
        ? {
            teamName: r.teamName.trim(),
            played: Number(r.played),
            won: Number(r.won),
            lost: Number(r.lost),
            points: Number(r.points),
          }
        : {
            clientId: r.clientId,
            played: Number(r.played),
            won: Number(r.won),
            lost: Number(r.lost),
          });
      const res = await axios.put(
        performanceUrl,
        { standings },
        { headers: authHeaders() }
      );
      if (Array.isArray(res.data?.standings)) setRows(res.data.standings.map((standing, index) => toRow(standing, index, clientId)));
      setUpdatedAt(res.data?.updatedAt || new Date().toISOString());
      setSaved(true);
      setDirty(false);
    } catch (err) {
      setSaveError(apiErrorMessage(err, "Couldn't save standings."));
    } finally {
      setSaving(false);
    }
  };

  const updatedLabel = (() => {
    if (!updatedAt) return "Not published yet";
    const d = new Date(updatedAt);
    return isNaN(d.getTime()) ? "—" : `Last updated ${d.toLocaleString("en-IN")}`;
  })();

  /* per-row inline problems (UI hints only; validate() is still the gate) */
  const rowIssues = useMemo(() => {
    const counts = {};
    rows.forEach((r) => {
      const key = clientId ? `${r.clientId}:${r.teamName.trim().toLowerCase()}` : r.clientId;
      if (key) counts[key] = (counts[key] || 0) + 1;
    });
    const out = {};
    rows.forEach((r) => {
      const issues = {};
      const n = r.teamName.trim().toLowerCase();
      const key = clientId ? `${r.clientId}:${n}` : r.clientId;
      if (!clientId && !r.clientId) issues.clientId = "Client required";
      if (!clientId && r.clientId && counts[key] > 1) issues.clientId = "Duplicate client";
      if (clientId && n && counts[key] > 1) issues.teamName = "Duplicate team";
      (clientId ? NUMERIC_FIELDS : ["played", "won", "lost"]).forEach((f) => {
        if (!/^\d+$/.test(String(r[f]).trim())) issues[f] = "Whole number";
      });
      if (!issues.won && !issues.lost && !issues.played && Number(r.won) + Number(r.lost) > Number(r.played)) {
        issues.won = issues.lost = "W + L > P";
      }
      out[r.key] = issues;
    });
    return out;
  }, [clientId, rows]);

  /* Rank by points, wins, and then fewest losses. */
  const rankOf = useMemo(() => {
    const rowPoints = (row) => clientId ? Number(row.points) : Number(row.won) * 2;
    const sorted = [...rows].filter((r) => clientId ? r.teamName.trim() : r.clientId).sort(
      (a, b) => rowPoints(b) - rowPoints(a) || Number(b.won) - Number(a.won) || Number(a.lost) - Number(b.lost)
    );
    const m = {};
    sorted.forEach((r, i) => { m[r.key] = i; });
    return m;
  }, [clientId, rows]);

  const displayRows = useMemo(() => {
    return rows.map((row) => ({ type: "team", row }));
  }, [rows]);

  const numCls = (bad) =>
    `w-full min-w-[3.5rem] rounded-xl bg-white px-2 py-2 text-center text-sm font-semibold tabular-nums text-gray-900 outline-none ring-1 transition focus:ring-2 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none ${
      bad ? "ring-red-300 focus:ring-red-400 bg-red-50/40" : "ring-gray-200 focus:ring-red-400"
    }`;

  return (
    <Card
      icon={<Trophy size={18} />}
      title="Performance standings"
      subtitle={`${clientId ? "Visible to this client" : "Shared with all clients"} · ${updatedLabel}`}
      right={dirty && !loading && !loadError && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" /> Unsaved changes
        </span>
      )}
    >
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-11 animate-pulse rounded-xl bg-gray-100" />)}
        </div>
      ) : loadError ? (
        <RetryBlock message={loadError} onRetry={() => { setLoading(true); load(); }} />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl ring-1 ring-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/80 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    <th className="w-12 py-3 pl-4 pr-2">#</th>
                    <th className="min-w-[10rem] px-2 py-3">{clientId ? "Team" : "Client"}</th>
                    {NUMERIC_FIELDS.map((f) => (
                      <th key={f} className="w-20 px-2 py-3 text-center" title={FIELD_TITLES[f]}>
                        <span className="sm:hidden">{FIELD_LABELS[f]}</span>
                        <span className="hidden sm:inline">{FIELD_TITLES[f]}</span>
                      </th>
                    ))}
                    <th className="hidden w-24 px-2 py-3 text-center md:table-cell">Win %</th>
                    <th className="w-12 py-3 pl-2 pr-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <AnimatePresence initial={false}>
                    {displayRows.map((displayRow) => {
                      const { row: r } = displayRow;
                      const issues = rowIssues[r.key] || {};
                      const rank = rankOf[r.key];
                      const played = Number(r.played) || 0;
                      const winPct = played > 0 ? Math.round((Number(r.won) / played) * 100) : null;
                      return (
                        <motion.tr key={r.key} layout
                          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                          className="group transition-colors hover:bg-red-50/30">
                          <td className="py-2 pl-4 pr-2">
                            {rank !== undefined ? (
                              <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${rank < 3 ? MEDAL[rank] : "bg-gray-100 text-gray-500"}`}
                                title="Rank by points">
                                {rank < 3 ? <Medal size={13} /> : rank + 1}
                              </span>
                            ) : <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-50 text-xs text-gray-300">–</span>}
                          </td>
                          {!clientId && (
                            <td className="px-2 py-2 align-top">
                              <ClientPicker
                                clients={clients}
                                value={r.clientId}
                                unassigned={r.unassigned}
                                usedClientIds={rows
                                  .filter((entry) => entry.key !== r.key && entry.clientId)
                                  .map((entry) => entry.clientId)}
                                invalid={!!issues.clientId}
                                onChange={(value, name) => {
                                  setSaved(false);
                                  setDirty(true);
                                  setRows((prev) => prev.map((entry) => entry.key === r.key
                                    ? { ...entry, clientId: value, clientName: name, unassigned: false }
                                    : entry));
                                }}
                              />
                            </td>
                          )}
                          {clientId && <td className="px-2 py-2">
                            <input
                              aria-label="Team name"
                              value={r.teamName}
                              maxLength={100}
                              placeholder="Team name"
                              onChange={(e) => updateRow(r.key, "teamName", e.target.value)}
                              className={`w-full rounded-xl bg-white px-3 py-2 text-sm font-semibold text-gray-900 outline-none ring-1 transition placeholder:font-normal placeholder:text-gray-300 focus:ring-2 ${
                                issues.teamName ? "ring-red-300 focus:ring-red-400" : "ring-gray-200 focus:ring-red-400"
                              }`}
                              title={issues.teamName || undefined}
                            />
                          </td>}
                          {(clientId ? NUMERIC_FIELDS : ["played", "won", "lost", "points"]).map((f) => (
                            <td key={f} className="px-2 py-2">
                              {!clientId && f === "points" ? (
                                <div aria-label="Points" className="rounded-xl bg-slate-50 px-2 py-2 text-center text-sm font-bold tabular-nums text-slate-700 ring-1 ring-slate-100">
                                  {(Number(r.won) || 0) * 2}
                                </div>
                              ) : <input
                                aria-label={f}
                                type="number"
                                min="0"
                                step="1"
                                inputMode="numeric"
                                value={r[f]}
                                onWheel={(e) => e.currentTarget.blur()}
                                onChange={(e) => updateRow(r.key, f, e.target.value)}
                                className={numCls(!!issues[f])}
                                title={issues[f] || undefined}
                              />}
                            </td>
                          ))}
                          <td className="hidden px-2 py-2 md:table-cell">
                            {winPct === null ? <p className="text-center text-xs text-gray-300">—</p> : (
                              <div>
                                <p className="text-center text-xs font-bold text-gray-700">{Math.min(100, winPct)}%</p>
                                <div className="mx-auto mt-1 h-1 w-14 overflow-hidden rounded-full bg-gray-100">
                                  <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-rose-400" style={{ width: `${Math.min(100, winPct)}%` }} />
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="py-2 pl-2 pr-4 text-right">
                            <button
                              type="button"
                              onClick={() => removeRow(r.key)}
                              aria-label="Remove row"
                              title="Remove row"
                              className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
            {rows.length === 0 && (
              <div className="flex flex-col items-center px-4 py-10 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-300"><Trophy size={22} /></div>
                <p className="text-sm font-semibold text-gray-600">No standings yet</p>
                <p className="text-xs text-gray-400">Add a row to start the table.</p>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={addRow}
              className="flex items-center justify-center gap-1.5 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-red-600 ring-1 ring-red-200 transition hover:bg-red-50"
            >
              <Plus size={16} /> {clientId ? "Add team" : "Add client"}
            </button>
            {dirty && (
              <button type="button" onClick={() => { setLoading(true); setSaveError(""); load(); }}
                className="rounded-2xl px-4 py-2.5 text-sm font-semibold text-gray-500 transition hover:bg-gray-100 hover:text-gray-800">
                Discard changes
              </button>
            )}
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50 sm:ml-auto"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? "Saving…" : "Save standings"}
            </button>
          </div>
          <AnimatePresence>
            {saveError && <Notice key="se" onClose={() => setSaveError("")}>{saveError}</Notice>}
            {saved && (
              <Notice key="sv" tone="ok">
                {clientId ? "Standings saved for this client." : "Standings saved. All clients can see the updated table."}
              </Notice>
            )}
          </AnimatePresence>
          <p className="mt-3 text-[11px] text-gray-400">The medals show rank by points, wins, then fewest losses. Rows are saved in the order listed.</p>
        </>
      )}
    </Card>
  );
};

const ClientMediaAdmin = ({ clientId }) => {
  if (!clientId) return null;
  return <ClientGalleryManager clientId={clientId} />;
};

export default ClientMediaAdmin;