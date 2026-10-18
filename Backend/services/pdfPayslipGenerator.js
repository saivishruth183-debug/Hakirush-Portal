import PDFDocument from "pdfkit";

export const formatPayPeriod = (month) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
};

/**
 * Generates a branded, professional company payslip as a PDF Buffer using pdfkit.
 * @param {Object} employee - Employee document (populated with userId and department)
 * @param {Object} figures - Computed salary figures
 * @param {string} month - Format YYYY-MM
 * @param {string} paymentStatus - Paid or Pending
 * @returns {Promise<Buffer>}
 */
export const generatePayslipPdfBuffer = async ({
  employee,
  figures,
  month,
  paymentStatus = "Paid",
}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 40,
        size: "A4",
      });

      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const MAROON = "#7A2233";
      const CHARCOAL = "#1C1A17";
      const SLATE = "#555555";
      const LIGHT_BG = "#F9F8F5";
      const BORDER_COLOR = "#E2DDD3";

      // 1. HEADER
      doc
        .rect(40, 40, 515, 65)
        .fill(MAROON);

      doc
        .fillColor("#FFFFFF")
        .font("Helvetica-Bold")
        .fontSize(20)
        .text("HAKIRUSH PORTAL", 55, 52);

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#F0E6D2")
        .text("CONFIDENTIAL SALARY PAYSLIP", 55, 78);

      doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .fillColor("#FFFFFF")
        .text(`PAY PERIOD: ${formatPayPeriod(month)}`, 400, 65, { align: "right", width: 140 });

      // 2. EMPLOYEE DETAILS BOX
      const empY = 120;
      doc
        .rect(40, empY, 515, 75)
        .fillAndStroke(LIGHT_BG, BORDER_COLOR);

      const empName = employee.userId?.name || employee.name || "Employee";
      const empCode = employee.employeeId || "N/A";
      const designation = employee.designation || "Staff";
      const department = employee.department?.dep_name || "General";

      doc.font("Helvetica-Bold").fontSize(10).fillColor(CHARCOAL);
      doc.text("Employee Name:", 55, empY + 12);
      doc.text("Employee ID:", 55, empY + 32);
      doc.text("Designation:", 55, empY + 52);

      doc.font("Helvetica").fontSize(10).fillColor(SLATE);
      doc.text(empName, 155, empY + 12);
      doc.text(empCode, 155, empY + 32);
      doc.text(designation, 155, empY + 52);

      doc.font("Helvetica-Bold").fontSize(10).fillColor(CHARCOAL);
      doc.text("Department:", 320, empY + 12);
      doc.text("Payment Status:", 320, empY + 32);
      doc.text("Generated On:", 320, empY + 52);

      doc.font("Helvetica").fontSize(10).fillColor(SLATE);
      doc.text(department, 420, empY + 12);
      doc
        .font("Helvetica-Bold")
        .fillColor(paymentStatus === "Paid" ? "#2E7D32" : "#D32F2F")
        .text(paymentStatus.toUpperCase(), 420, empY + 32);
      doc.font("Helvetica").fillColor(SLATE).text(new Date().toISOString().slice(0, 10), 420, empY + 52);

      // 3. SALARY BREAKDOWN TABLE
      const tableY = 210;
      const colWidth = 252;

      // Earnings Table Header
      doc.rect(40, tableY, colWidth, 22).fill(MAROON);
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#FFFFFF").text("EARNINGS", 50, tableY + 6);
      doc.text("AMOUNT (INR)", 210, tableY + 6, { width: 75, align: "right" });

      // Deductions Table Header
      doc.rect(302, tableY, colWidth, 22).fill(MAROON);
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#FFFFFF").text("DEDUCTIONS", 312, tableY + 6);
      doc.text("AMOUNT (INR)", 470, tableY + 6, { width: 75, align: "right" });

      // Rows
      const earningsRows = [
        ["Basic Salary", figures.basicSalary || 0],
        ["House Rent Allowance (HRA)", figures.hra || 0],
        ["Conveyance Allowance", figures.conveyanceAllowance || 0],
        ["Medical Allowance", figures.medicalAllowance || 0],
        ["Other Allowances", figures.otherAllowances || 0],
        ["Performance Bonus", figures.bonus || 0],
        [`Overtime (${figures.overtimeHours || 0} hrs)`, figures.overtimePay || 0],
        ["Reimbursements / Claims", figures.reimbursements || 0],
      ];

      const deductionRows = [
        ["Provident Fund (PF)", figures.providentFund || 0],
        ["Professional Tax (PT)", figures.professionalTax || 0],
        ["TDS / Income Tax", figures.incomeTax || 0],
        ["Loss of Pay (LOP)", figures.lossOfPay || 0],
        ["Other Deductions", figures.otherDeductions || 0],
      ];

      let rowY = tableY + 26;
      const maxRows = Math.max(earningsRows.length, deductionRows.length);

      for (let i = 0; i < maxRows; i++) {
        const bg = i % 2 === 0 ? "#FFFFFF" : "#FAF8F5";
        doc.rect(40, rowY, colWidth, 20).fill(bg);
        doc.rect(302, rowY, colWidth, 20).fill(bg);

        // Earnings item
        if (i < earningsRows.length) {
          const [label, val] = earningsRows[i];
          doc.font("Helvetica").fontSize(9).fillColor(CHARCOAL).text(label, 50, rowY + 5);
          doc.font("Helvetica-Bold").text(Number(val).toLocaleString("en-IN", { minimumFractionDigits: 2 }), 195, rowY + 5, {
            width: 90,
            align: "right",
          });
        }

        // Deductions item
        if (i < deductionRows.length) {
          const [label, val] = deductionRows[i];
          doc.font("Helvetica").fontSize(9).fillColor(CHARCOAL).text(label, 312, rowY + 5);
          doc.font("Helvetica-Bold").text(Number(val).toLocaleString("en-IN", { minimumFractionDigits: 2 }), 455, rowY + 5, {
            width: 90,
            align: "right",
          });
        }

        rowY += 21;
      }

      // Total rows
      doc.rect(40, rowY, colWidth, 24).fillAndStroke("#EFECE6", BORDER_COLOR);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(CHARCOAL).text("Gross Earnings", 50, rowY + 7);
      doc.text(`INR ${Number(figures.grossSalary || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 160, rowY + 7, {
        width: 125,
        align: "right",
      });

      doc.rect(302, rowY, colWidth, 24).fillAndStroke("#EFECE6", BORDER_COLOR);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(CHARCOAL).text("Total Deductions", 312, rowY + 7);
      doc.text(`INR ${Number(figures.totalDeductions || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 420, rowY + 7, {
        width: 125,
        align: "right",
      });

      // 4. NET PAYABLE BANNER
      const netY = rowY + 38;
      doc.rect(40, netY, 515, 50).fill(MAROON);

      doc.font("Helvetica-Bold").fontSize(12).fillColor("#FFFFFF").text("NET TAKE-HOME PAYABLE:", 60, netY + 18);
      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor("#FFFFFF")
        .text(`INR ${Number(figures.netSalary || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 320, netY + 16, {
          width: 220,
          align: "right",
        });

      // 5. FOOTER
      const footerY = netY + 80;
      doc
        .font("Helvetica-Oblique")
        .fontSize(8)
        .fillColor("#888888")
        .text("Note: This is a system-generated payslip produced by Hakirush Portal and does not require a physical signature.", 40, footerY, {
          align: "center",
          width: 515,
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
