import mongoose from "mongoose";

const payslipSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },

    month: {
      type: String,
      required: true,
    },

    /* ================= SALARY STRUCTURE ================= */
    basicSalary: {
      type: Number,
      required: true,
    },

    hra: { type: Number, default: 0 },
    conveyanceAllowance: { type: Number, default: 0 },
    medicalAllowance: { type: Number, default: 0 },
    otherAllowances: { type: Number, default: 0 },

    /* ================= BONUS ================= */
    bonus: {
      type: Number,
      default: 0,
    },

    /* ================= OVERTIME ================= */
    overtimeHours: {
      type: Number,
      default: 0,
    },
    overtimeRate: {
      type: Number,
      default: 0,
    },
    overtimePay: {
      type: Number,
      default: 0,
    },

    /* ================= DEDUCTIONS ================= */
    providentFund: { type: Number, default: 0 },
    professionalTax: { type: Number, default: 0 },
    incomeTax: { type: Number, default: 0 },
    lossOfPay: { type: Number, default: 0 },
    otherDeductions: { type: Number, default: 0 },

    /* ================= REIMBURSEMENTS ================= */
    reimbursements: {
      type: Number,
      default: 0,
    },

    /* ================= CALCULATED VALUES ================= */
    grossSalary: {
      type: Number,
      required: true,
    },

    totalDeductions: {
      type: Number,
      required: true,
    },

    netSalary: {
      type: Number,
      required: true,
    },

    /* ================= PAYMENT STATUS ================= */
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid"],
      default: "Pending",
    },

    paymentDate: {
      type: Date,
    },

    // Upload URL. New uploads are private ImageKit files: this URL is not
    // directly viewable; clients use /payslip/:id/link or /payslip/:id/download.
    payslipFile: {
      type: String,
      required: true,
    },
    /* ===== Storage metadata (additive) ===== */
    // "private" = uploaded as a private ImageKit file by this server (only these
    // are served via signed link/download). Missing/null = legacy public upload
    // that must be migrated (scripts/migrateLegacyPayslips.js) before access.
    storage: { type: String, enum: ["private", null], default: null },
    fileId: { type: String, default: null },
    filePath: { type: String, default: null },
    isPrivateFile: { type: Boolean, default: false },
    legacyUrl: { type: String, default: null }, // original public URL, kept for audit after migration
    migratedAt: { type: Date, default: null },
    legacyRetiredAt: { type: Date, default: null }, // old public object deleted (migration --retire-public)
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

  },
  { timestamps: true }
);

// One payslip per employee per month.
payslipSchema.index({ employee: 1, month: 1 }, { unique: true, name: "uniq_payslip_employee_month" });

export default mongoose.model("Payslip", payslipSchema);
