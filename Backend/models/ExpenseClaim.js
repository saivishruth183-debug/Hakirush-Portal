import mongoose from "mongoose";

export const EXPENSE_CATEGORIES = [
  "Travel",
  "Client Lunches / Meals",
  "Equipment",
  "Office Supplies",
  "Internet / Utilities",
  "Other",
];

const expenseClaimSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    category: {
      type: String,
      enum: EXPENSE_CATEGORIES,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
      max: 1e7,
    },
    receiptUrl: {
      type: String,
      default: "",
    },
    date: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
      maxlength: 500,
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "Reimbursed"],
      default: "Pending",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewRemarks: {
      type: String,
      default: "",
    },
    reimbursedInPayslipMonth: {
      type: String,
      default: null,
    },
    reimbursedPayslipId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payslip",
      default: null,
    },
  },
  { timestamps: true }
);

expenseClaimSchema.index({ employeeId: 1, status: 1 });
expenseClaimSchema.index({ status: 1, createdAt: -1 });

const ExpenseClaim = mongoose.model("ExpenseClaim", expenseClaimSchema);
export default ExpenseClaim;
