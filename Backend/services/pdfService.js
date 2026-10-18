import PDFDocument from "pdfkit";

export const generatePayslipPdf = async (payslipData, employee, user) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      // --- Colors ---
      const brandRed = "#7A2233";
      const brandGold = "#B8912E";
      const ink = "#1C1A17";
      const textLight = "#8A8478";

      // --- Header ---
      doc.fontSize(24).fillColor(brandRed).font("Helvetica-Bold").text("HAKIRUSH", { align: "center" });
      doc.fontSize(10).fillColor(textLight).font("Helvetica").text("Official Payslip Document", { align: "center" });
      doc.moveDown(2);

      // --- Title ---
      doc.fontSize(16).fillColor(ink).font("Helvetica-Bold").text(`Payslip for ${payslipData.month}`, { align: "left" });
      doc.moveTo(50, doc.y + 5).lineTo(550, doc.y + 5).strokeColor(brandGold).stroke();
      doc.moveDown(1.5);

      // --- Employee Details ---
      doc.fontSize(10).fillColor(textLight).font("Helvetica-Bold").text("Employee Details");
      doc.moveDown(0.5);
      
      const leftColX = 50;
      const rightColX = 300;
      let startY = doc.y;

      doc.fillColor(ink).font("Helvetica").text(`Name: ${user.name}`, leftColX, startY);
      doc.text(`Employee ID: ${employee.employeeId}`, leftColX, startY + 15);
      doc.text(`Designation: ${employee.designation}`, leftColX, startY + 30);
      
      doc.text(`Date of Joining: ${employee.dateOfJoining ? employee.dateOfJoining.toISOString().split("T")[0] : "N/A"}`, rightColX, startY);
      doc.text(`PAN: ${employee.pancard || "N/A"}`, rightColX, startY + 15);
      doc.text(`PF Number: ${employee.pfNumber || "N/A"}`, rightColX, startY + 30);

      doc.moveDown(3);

      // --- Earnings & Deductions Tables ---
      startY = doc.y + 20;
      
      // Earnings Column
      doc.font("Helvetica-Bold").fillColor(brandRed).text("EARNINGS", leftColX, startY);
      doc.moveTo(leftColX, startY + 15).lineTo(280, startY + 15).strokeColor("#E7E1D3").stroke();
      
      let eY = startY + 25;
      doc.font("Helvetica").fillColor(ink);
      doc.text("Basic Salary", leftColX, eY); doc.text(`INR ${payslipData.basicSalary.toLocaleString()}`, 200, eY, { align: "right", width: 80 }); eY += 20;
      if (payslipData.hra) { doc.text("HRA", leftColX, eY); doc.text(`INR ${payslipData.hra.toLocaleString()}`, 200, eY, { align: "right", width: 80 }); eY += 20; }
      if (payslipData.conveyanceAllowance) { doc.text("Conveyance", leftColX, eY); doc.text(`INR ${payslipData.conveyanceAllowance.toLocaleString()}`, 200, eY, { align: "right", width: 80 }); eY += 20; }
      if (payslipData.bonus) { doc.text("Bonus", leftColX, eY); doc.text(`INR ${payslipData.bonus.toLocaleString()}`, 200, eY, { align: "right", width: 80 }); eY += 20; }
      
      // Deductions Column
      doc.font("Helvetica-Bold").fillColor(brandRed).text("DEDUCTIONS", rightColX, startY);
      doc.moveTo(rightColX, startY + 15).lineTo(550, startY + 15).strokeColor("#E7E1D3").stroke();
      
      let dY = startY + 25;
      doc.font("Helvetica").fillColor(ink);
      if (payslipData.providentFund) { doc.text("Provident Fund", rightColX, dY); doc.text(`INR ${payslipData.providentFund.toLocaleString()}`, 470, dY, { align: "right", width: 80 }); dY += 20; }
      if (payslipData.professionalTax) { doc.text("Professional Tax", rightColX, dY); doc.text(`INR ${payslipData.professionalTax.toLocaleString()}`, 470, dY, { align: "right", width: 80 }); dY += 20; }
      if (payslipData.incomeTax) { doc.text("Income Tax", rightColX, dY); doc.text(`INR ${payslipData.incomeTax.toLocaleString()}`, 470, dY, { align: "right", width: 80 }); dY += 20; }
      if (payslipData.lossOfPay) { doc.text("Loss of Pay", rightColX, dY); doc.text(`INR ${payslipData.lossOfPay.toLocaleString()}`, 470, dY, { align: "right", width: 80 }); dY += 20; }

      // --- Totals ---
      const tableBottom = Math.max(eY, dY) + 20;
      doc.moveTo(50, tableBottom).lineTo(550, tableBottom).strokeColor("#E7E1D3").stroke();
      
      doc.font("Helvetica-Bold");
      doc.text("Gross Earnings:", leftColX, tableBottom + 10);
      doc.text(`INR ${payslipData.grossSalary.toLocaleString()}`, 200, tableBottom + 10, { align: "right", width: 80 });
      
      doc.text("Total Deductions:", rightColX, tableBottom + 10);
      doc.text(`INR ${payslipData.totalDeductions.toLocaleString()}`, 470, tableBottom + 10, { align: "right", width: 80 });

      // --- Net Pay Highlight ---
      doc.moveDown(4);
      const netY = doc.y;
      doc.rect(50, netY, 500, 40).fillAndStroke(brandGold, brandGold);
      doc.fillColor(ink).fontSize(14).text(`NET PAY: INR ${payslipData.netSalary.toLocaleString()}`, 50, netY + 12, { align: "center" });

      // --- Footer ---
      doc.moveDown(4);
      doc.fontSize(8).fillColor(textLight).text("This is a computer-generated document and requires no physical signature.", { align: "center" });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
