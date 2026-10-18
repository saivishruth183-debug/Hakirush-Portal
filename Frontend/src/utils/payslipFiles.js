import axios from "axios";

// Payslip PDFs are private files. Never open the stored file URL directly and
// never put the bearer token in a URL:
//  - View:     GET /api/payslip/:payslipId/link     -> { url, expiresAt } short-lived signed URL
//  - Download: GET /api/payslip/:payslipId/download -> application/pdf (Authorization header)

const BACKEND = import.meta.env.VITE_BACKEND_URL;
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

export const openPayslip = async (payslipId) => {
  // Open the tab synchronously (inside the click handler) so popup blockers
  // allow it, then point it at the signed URL once it arrives.
  const win = window.open("about:blank", "_blank");
  try {
    const res = await axios.get(`${BACKEND}/api/payslip/${payslipId}/link`, { headers: authHeaders() });
    const url = res.data?.url;
    if (!url) throw new Error("No link returned");
    if (win) {
      win.opener = null;
      win.location.href = url;
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  } catch (err) {
    if (win) win.close();
    throw err;
  }
};

export const downloadPayslip = async (payslipId, filename = "payslip") => {
  const res = await axios.get(`${BACKEND}/api/payslip/${payslipId}/download`, {
    headers: authHeaders(),
    responseType: "blob",
  });
  const blobUrl = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
};

// `hasFile` (new API) or a legacy file reference means a PDF exists.
export const payslipHasFile = (p) =>
  p?.hasFile !== undefined ? Boolean(p.hasFile) : Boolean(p?.payslipFile);
