import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";

// Configure Nodemailer transporter (requires EMAIL_USER and EMAIL_PASS in .env)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const __testHooks = {
  capturePasswordResetEmail: null,
};

export const sendPasswordResetOtpEmail = async (user, otp) => {
  if (process.env.NODE_ENV === "test" && __testHooks.capturePasswordResetEmail) {
    await __testHooks.capturePasswordResetEmail({ type: "otp", user, otp });
    return;
  }
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("WARNING: EMAIL_USER or EMAIL_PASS not configured. Skipping password reset email.");
    return;
  }

  await transporter.sendMail({
    from: `"Hakirush Portal" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: "Hakirush password reset",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; border: 1px solid #e2e8f0; border-radius: 16px; background: #fff;">
        <h1 style="margin: 0; color: #7A2233; text-align: center; font-size: 25px;">Hakirush password reset</h1>
        <p style="margin: 24px 0 12px; color: #334155; text-align: center;">Use this one-time code to reset your password:</p>
        <p style="margin: 0; color: #7A2233; text-align: center; font-size: 38px; font-weight: 700; letter-spacing: 12px;">${otp}</p>
        <p style="margin: 20px 0; color: #64748b; text-align: center;">This code expires in 10 minutes.</p>
        <p style="margin: 0; color: #94a3b8; text-align: center; font-size: 13px;">Please ignore this email if you didn't request a password reset.</p>
      </div>
    `,
  });
};

export const sendPasswordChangedEmail = async (user) => {
  if (process.env.NODE_ENV === "test" && __testHooks.capturePasswordResetEmail) {
    await __testHooks.capturePasswordResetEmail({ type: "changed", user });
    return;
  }
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("WARNING: EMAIL_USER or EMAIL_PASS not configured. Skipping password change email.");
    return;
  }

  await transporter.sendMail({
    from: `"Hakirush Portal" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: "Your password was changed",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; border: 1px solid #e2e8f0; border-radius: 16px; background: #fff;">
        <h1 style="margin: 0; color: #7A2233; text-align: center; font-size: 25px;">Your password was changed</h1>
        <p style="margin: 24px 0 0; color: #334155; text-align: center;">Your Hakirush Portal password has been updated. If you didn't make this change, contact your administrator immediately.</p>
      </div>
    `,
  });
};

export const sendWelcomeEmail = async (user, employee) => {
  // Generate a special 24-hour setup token
  const setupToken = jwt.sign(
    { _id: user._id, role: user.role, type: "setup" },
    process.env.JWT_KEY,
    { expiresIn: "24h" }
  );

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const setupLink = `${frontendUrl}/setup-password?token=${setupToken}`;

  const mailOptions = {
    from: `"Hakirush Portal" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: "Welcome to Hakirush Portal - Setup Your Account",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #7A2233; text-align: center;">Welcome to Hakirush, ${user.name}!</h2>
        <p>Your employee account has been successfully created.</p>
        <p><strong>Department:</strong> ${employee.department ? "Assigned" : "Pending"}</p>
        <p><strong>Employee ID:</strong> ${employee.employeeId}</p>
        <br/>
        <p>To access the Hakirush Web Portal and Mobile App, please set up your secure password by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${setupLink}" style="background-color: #7A2233; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Set Up My Password</a>
        </div>
        <p style="font-size: 12px; color: #888; text-align: center;">This link expires in 24 hours. If you did not expect this email, please contact your administrator.</p>
      </div>
    `,
  };

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("WARNING: EMAIL_USER or EMAIL_PASS not configured in .env. Skipping welcome email.");
    console.log("Mock Setup Link:", setupLink);
    return;
  }

  await transporter.sendMail(mailOptions);
};

export const sendLeaveRequestToManagerEmail = async (managerUser, employee, leave) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const loginLink = `${frontendUrl}/login`;

  const mailOptions = {
    from: `"Hakirush Portal" <${process.env.EMAIL_USER}>`,
    to: managerUser.email,
    subject: `Leave Request: ${employee.name} (${leave.days} days)`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #7A2233; text-align: center;">New Leave Request</h2>
        <p>Hello ${managerUser.name},</p>
        <p><strong>${employee.name}</strong> has requested a <strong>${leave.leaveType}</strong>.</p>
        <ul>
          <li><strong>Duration:</strong> ${leave.days} days</li>
          <li><strong>Reason:</strong> ${leave.reason || "N/A"}</li>
        </ul>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${loginLink}" style="background-color: #7A2233; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Review in Portal</a>
        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions).catch(console.error);
};

export const sendLeaveRequestToAdminEmail = async (employee, leave) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const loginLink = `${frontendUrl}/login`;

  try {
    const User = (await import("../models/User.js")).default;
    const admins = await User.find({ role: "admin" }).select("email").lean();
    if (!admins.length) return;

    const mailOptions = {
      from: `"Hakirush Portal" <${process.env.EMAIL_USER}>`,
      to: admins.map((a) => a.email).join(","),
      subject: `Manager Leave FYI: ${employee.name} (${leave.days} days)`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <h2 style="color: #7A2233; text-align: center;">Manager Leave Taken</h2>
          <p>Hello Admin,</p>
          <p>This is an automated notification. The manager <strong>${employee.name}</strong> has applied for <strong>${leave.leaveType}</strong>.</p>
          <p><em>As a manager, this leave has been automatically approved.</em></p>
          <ul>
            <li><strong>Duration:</strong> ${leave.days} days</li>
            <li><strong>Reason:</strong> ${leave.reason || "N/A"}</li>
          </ul>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error(err);
  }
};

export const sendLeaveStatusEmail = async (employeeUser, leave, status, managerName) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
  const color = status === "Approved" ? "#2E7D32" : "#C62828";
  
  const mailOptions = {
    from: `"Hakirush Portal" <${process.env.EMAIL_USER}>`,
    to: employeeUser.email,
    subject: `Leave Request ${status}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: ${color}; text-align: center;">Leave ${status}</h2>
        <p>Hello ${employeeUser.name},</p>
        <p>Your request for <strong>${leave.leaveType}</strong> (${leave.days} days) has been <strong>${status}</strong> by ${managerName}.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions).catch(console.error);
};

export const sendAssetAssignmentEmail = async (employeeUser, employee, asset) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("WARNING: EMAIL_USER or EMAIL_PASS not configured in .env. Skipping asset assignment email.");
    return;
  }

  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const mailOptions = {
    from: `"Hakirush Portal" <${process.env.EMAIL_USER}>`,
    to: employeeUser.email,
    subject: "Hakirush asset has been assigned to you",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #7A2233; text-align: center;">An asset has been assigned to you</h2>
        <p>Hello ${escapeHtml(employeeUser.name)},</p>
        <p>Hakirush asset has been assigned to you:</p>
        <ul>
          <li><strong>Asset:</strong> ${escapeHtml(asset.name)}</li>
          <li><strong>Type:</strong> ${escapeHtml(asset.assetType)}</li>
          ${asset.serialNumber ? `<li><strong>Serial number:</strong> ${escapeHtml(asset.serialNumber)}</li>` : ""}
          <li><strong>Employee ID:</strong> ${escapeHtml(employee.employeeId)}</li>
          <li><strong>Assigned on:</strong> ${escapeHtml(new Date(asset.issueDate).toISOString().slice(0, 10))}</li>
        </ul>
        <p>Please contact your administrator if you have any questions about this asset.</p>
        <p><a href="${escapeHtml(frontendUrl)}/login" style="color: #7A2233;">Open Hakirush Portal</a></p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

export const sendBirthdayEmail = async (user) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;

  const mailOptions = {
    from: `"Hakirush Portal" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: `🎂 Happy Birthday, ${user.name}! From Hakirush Portal`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 10px; background: #fff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #7A2233; font-size: 26px; margin: 0;">🎉 Happy Birthday, ${user.name}! 🎂</h1>
          <p style="color: #666; font-size: 14px;">Wishing you joy, good health, and immense success!</p>
        </div>
        <p style="font-size: 15px; color: #333; line-height: 1.6;">
          On this special day, the entire team at Hakirush celebrates you and the enthusiasm you bring to our workplace every day.
        </p>
        <p style="font-size: 15px; color: #333; line-height: 1.6;">
          May this upcoming year be packed with memorable moments, personal growth, and fulfilling milestones!
        </p>
        <div style="margin-top: 30px; padding: 15px; background: #FAF8F5; border-radius: 8px; text-align: center; border: 1px dashed #B8912E;">
          <p style="margin: 0; color: #7A2233; font-weight: bold; font-size: 15px;">Have a wonderful day ahead!</p>
          <p style="margin: 5px 0 0 0; color: #888; font-size: 12px;">Warm regards, Team Hakirush</p>
        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions).catch((err) => console.error("Birthday email failed:", err.message));
};

export const sendWorkAnniversaryEmail = async (user, years) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;

  const yearText = years === 1 ? "1 Year" : `${years} Years`;

  const mailOptions = {
    from: `"Hakirush Portal" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject: `🏆 Happy ${yearText} Work Anniversary, ${user.name}!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e0e0e0; border-radius: 10px; background: #fff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #7A2233; font-size: 26px; margin: 0;">🏆 Happy ${yearText} Work Anniversary! 🌟</h1>
          <p style="color: #666; font-size: 14px;">Celebrating your dedication at Hakirush</p>
        </div>
        <p style="font-size: 15px; color: #333; line-height: 1.6;">
          Congratulations on reaching this milestone! Thank you for ${yearText} of passion, innovation, and valuable contributions to Hakirush.
        </p>
        <p style="font-size: 15px; color: #333; line-height: 1.6;">
          We are truly grateful to have you on our team and look forward to achieving many more great achievements together.
        </p>
        <div style="margin-top: 30px; padding: 15px; background: #FAF8F5; border-radius: 8px; text-align: center; border: 1px dashed #7A2233;">
          <p style="margin: 0; color: #7A2233; font-weight: bold; font-size: 15px;">Cheers to many more years of shared success!</p>
          <p style="margin: 5px 0 0 0; color: #888; font-size: 12px;">Warm regards, Team Hakirush</p>
        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions).catch((err) => console.error("Work anniversary email failed:", err.message));
};
