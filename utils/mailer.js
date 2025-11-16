const nodemailer = require("nodemailer");

// =========================================================
// 🚀 CREATE TRANSPORTER (Gmail Safe Version)
// =========================================================
// Gmail recommended ports:
// 465  = SSL (secure: true)
// 587  = TLS (secure: false)

const port = parseInt(process.env.SMTP_PORT) || 587;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port,
  secure: port === 465, // Gmail SSL
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
  connectionTimeout: 20000, // 20 secs
  socketTimeout: 20000,
});

// Verify transporter connection on startup
transporter.verify((err, success) => {
  if (err) {
    console.error("❌ SMTP Connection Failed:", err.message);
  } else {
    console.log("📨 SMTP Ready:", success);
  }
});

// =========================================================
// 📩 BASIC SEND EMAIL FUNCTION
// =========================================================
async function sendEmail(to, subject, html) {
  try {
    const mailOptions = {
      from: `"${process.env.APP_NAME || "SafeNode"}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to} (${subject})`);
    return true;
  } catch (err) {
    console.error("❌ Email failed:", err.message);

    // Gmail specific authentication errors
    if (err.message.includes("Invalid login")) {
      console.log("⚠️ Gmail login failed. Enable 'App Passwords' or set correct SMTP_PASS.");
    }

    if (err.message.includes("Timed out") || err.message.includes("ETIMEDOUT")) {
      console.log("⚠️ SMTP Timeout. Use port 587 instead of 465.");
    }

    return false;
  }
}

// =========================================================
// 📦 BASE EMAIL TEMPLATE WRAPPER
// =========================================================
function baseTemplate(content) {
  const appName = process.env.APP_NAME || "SafeNode";

  return `
  <div style="font-family: 'Inter', Arial, sans-serif; background:#f5f9f7; padding:30px;">
    <div style="max-width:580px; margin:auto; background:#ffffff; border-radius:14px; box-shadow:0 6px 20px rgba(0,0,0,0.05); padding:32px;">
      <div style="text-align:center; margin-bottom:20px;">
        <h2 style="margin:0; color:#00a86b; font-size:18px;">${appName}</h2>
        <p style="color:#6b7d7a; font-size:13px;">Escrow Made Simple & Safe</p>
      </div>

      ${content}

      <div style="border-top:1px solid #e5e7eb; margin-top:30px; padding-top:20px; text-align:center; color:#6b7280; font-size:12px;">
        © ${new Date().getFullYear()} ${appName}. All rights reserved.
      </div>
    </div>
  </div>`;
}

// =========================================================
// 🧩 EMAIL TEMPLATES
// =========================================================
function getEmailTemplate(template, data = {}) {
  const appName = process.env.APP_NAME || "SafeNode";

  switch (template) {
    case "verification":
      return {
        subject: `Verify your ${appName} account`,
        html: baseTemplate(`
          <h3 style="color:#111827;">Welcome to ${appName}, ${data.name || "User"}!</h3>
          <p>Click below to verify your account.</p>
          <a href="${data.verifyLink}" style="background:#00a86b;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:10px;display:inline-block;">Verify Email</a>
        `),
      };

    case "resetPassword":
      return {
        subject: "Reset Your SafeNode Password",
        html: baseTemplate(`
          <h3 style="color:#111827;">Hello ${data.name || "User"}</h3>
          <p>Click below to reset your password.</p>
          <a href="${data.resetLink}" style="background:#00a86b;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:10px;display:inline-block;">Reset Password</a>
        `),
      };

    case "refund":
      return {
        subject: `Refund Processed - ${appName}`,
        html: baseTemplate(`
          <h3>Hello ${data.name}</h3>
          <p>Your refund for <strong>${data.contractTitle}</strong> has been processed.</p>
          <p>Amount refunded: <strong>₦${data.amount}</strong></p>
        `),
      };

    case "fundReleased":
      return {
        subject: `Funds Released`,
        html: baseTemplate(`
          <h3>Funds Released!</h3>
          <p>${data.buyerName} released funds for "<strong>${data.contractTitle}</strong>".</p>
          <p>Amount: <strong>₦${data.amount}</strong></p>
        `),
      };

    case "dispute":
      return {
        subject: `Dispute Opened`,
        html: baseTemplate(`
          <h3>Dispute Opened</h3>
          <p>A dispute was opened for: <strong>${data.contractTitle}</strong>.</p>
        `),
      };

    case "withdrawal":
      return {
        subject: `Withdrawal Processed`,
        html: baseTemplate(`
          <h3>Withdrawal Successful</h3>
          <p>You withdrew <strong>₦${data.amount}</strong>.</p>
        `),
      };

    case "sellerAccepted":
      return {
        subject: `Seller Accepted Your Contract`,
        html: baseTemplate(`
          <h3>Good news!</h3>
          <p>${data.sellerName} accepted your contract "<strong>${data.contractTitle}</strong>".</p>
        `),
      };

    case "requestFunds":
      return {
        subject: `Seller Requested Payment`,
        html: baseTemplate(`
          <h3>Payment Requested</h3>
          <p>${data.sellerName} requested funds for contract "<strong>${data.contractTitle}</strong>".</p>
        `),
      };

    default:
      return {
        subject: `${appName} Notification`,
        html: baseTemplate(`<p>${data.message || "You have a new update."}</p>`),
      };
  }
}

// =========================================================
// ✉️ FINAL EXPORT FUNCTION
// =========================================================
async function sendTemplateEmail(template, to, data = {}) {
  const { subject, html } = getEmailTemplate(template, data);
  return await sendEmail(to, subject, html);
}

module.exports = { sendEmail, sendTemplateEmail };