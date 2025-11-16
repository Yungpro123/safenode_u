const nodemailer = require("nodemailer");

// ✅ Create mail transporter using environment variables
const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: parseInt(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

// ✅ Basic send email function
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
    return false;
  }
}

/* --------------------------------------------------------------------------
   📦 SafeNode Email Template Wrapper
-------------------------------------------------------------------------- */
function baseTemplate(content) {
  const logoUrl = `../public/logo.png`;
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

/* --------------------------------------------------------------------------
   🧩 EMAIL TEMPLATES
-------------------------------------------------------------------------- */
function getEmailTemplate(template, data = {}) {
  const appName = process.env.APP_NAME || "SafeNode";

  switch (template) {
    case "verification":
      return {
        subject: `Verify your ${appName} account`,
        html: baseTemplate(`
          <h3 style="color:#111827;">Welcome to ${appName}, ${data.name || "User"}!</h3>
          <p>Click the button below to verify your email address and activate your account.</p>
          <a href="${data.verifyLink}" style="background:#00a86b;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:10px;">Verify Email</a>
          <p style="font-size:13px;color:#6b7280;margin-top:20px;">If you didn’t sign up, you can safely ignore this email.</p>
        `),
      };

    case "resetPassword":
      return {
        subject: "Reset Your SafeNode Password",
        html: baseTemplate(`
          <h3 style="color:#111827;">Hello ${data.name || "User"},</h3>
          <p>You requested to reset your password. Click the button below to create a new one.</p>
          <a href="${data.resetLink}" style="display:inline-block;background:#00a86b;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:10px;">Reset Password</a>
          <p style="font-size:13px;color:#6b7280;margin-top:20px;">If you didn’t request this, please ignore it. The link will expire in 10 minutes.</p>
        `),
      };

    case "refund":
      return {
        subject: `Refund Processed - ${appName}`,
        html: baseTemplate(`
          <h3 style="color:#111827;">Hello ${data.name || "User"},</h3>
          <p>Your refund for <strong>${data.contractTitle || "a contract"}</strong> has been processed.</p>
          <p>Amount refunded: <strong>₦${data.amount || "0"}</strong></p>
          <p>Thank you for using ${appName}. We’re here to keep your transactions safe!</p>
        `),
      };
case "fundReleased":
      return {
        subject: `Funds Released - ${appName}`,
        html: baseTemplate(`
          <h3 style="color:#111827;">Good news, ${data.sellerName || "Seller"}!</h3>
          <p>The buyer <strong>${data.buyerName || "a buyer"}</strong> has released the funds for your contract titled 
          <strong>"${data.contractTitle || "Unnamed Contract"}"</strong>.</p>

          <p style="margin-top:10px;">Amount Released: <strong>₦${data.amount || "0"}</strong></p>

          <p style="margin-top:20px;">The funds have been credited to your SafeNode wallet. You can now withdraw or use them for other transactions.</p>

          <a href="${data.dashboardLink || "#"}" 
            style="display:inline-block;background:#00a86b;color:white;padding:12px 24px;
            border-radius:8px;text-decoration:none;margin-top:20px;">
            View Transaction
          </a>

          <p style="font-size:13px;color:#6b7280;margin-top:20px;">
            Thank you for using ${appName}. We’re glad to be part of your safe transaction!
          </p>
        `),
      };
    case "dispute":
      return {
        subject: `Dispute Opened - ${appName}`,
        html: baseTemplate(`
          <h3 style="color:#111827;">Dispute Opened</h3>
          <p>A dispute has been initiated for the contract: <strong>${data.contractTitle}</strong>.</p>
          <p>Reason: <em>Please do well to contribute to the dispute or else the other party will be credited after 3 days </em></p>
          <p>Our team will review the case and notify both parties soon.</p>
        `),
      };

    case "withdrawal":
      return {
        subject: `Withdrawal Processed - ${appName}`,
        html: baseTemplate(`
          <h3 style="color:#111827;">Hello ${data.name || "User"},</h3>
          <p>Your withdrawal of <strong>₦${data.amount}</strong> has been processed successfully.</p>
          <p>If you didn’t request this, contact SafeNode support immediately.</p>
        `),
      };

    case "sellerAccepted":
      return {
        subject: `Seller Accepted Your Contract - ${appName}`,
        html: baseTemplate(`
          <h3 style="color:#111827;">Good news, ${data.buyerName || "Buyer"}!</h3>
          <p>The seller <strong style="color:#00a86b;">${data.sellerName || "a seller"}</strong> has accepted your contract titled 
          <strong>"${data.contractTitle}"</strong>.</p>
          <p>Amount: <strong>₦${data.amount}</strong></p>
          <p style="margin-top:10px;">You can now proceed with the next steps in your dashboard.</p>
        `),
      };
case "requestFunds":
      return {
        subject: `Seller Requested Payment - ${appName}`,
        html: baseTemplate(`
          <h3 style="color:#111827;">Hello ${data.buyerName || "Buyer"},</h3>
          <p>The seller <strong style="color:#00a86b;">${data.sellerName || "a seller"}</strong> has requested payment for your contract titled 
          <strong>"${data.contractTitle || "Unnamed Contract"}"</strong>.</p>
          
          <p style="margin-top:10px;">Amount Requested: <strong>₦${data.amount || "0"}</strong></p>
          <p style="margin-top:15px;">Please review the contract and release payment if the service or product has been delivered as agreed.</p>

          <a href="${data.reviewLink || "#"}" 
            style="display:inline-block;background:#00a86b;color:white;padding:12px 24px;
            border-radius:8px;text-decoration:none;margin-top:20px;">
            Review & Release Payment
          </a>

          <p style="font-size:13px;color:#6b7280;margin-top:20px;">
            Thank you for using ${appName}. We’re ensuring your transactions remain secure and transparent.
          </p>
        `),
      };
    default:
      return {
        subject: `${appName} Notification`,
        html: baseTemplate(`
          <p>${data.message || "You have a new notification from SafeNode."}</p>
        `),
      };
  }
}

/* --------------------------------------------------------------------------
   ✉️ sendTemplateEmail(template, to, data)
-------------------------------------------------------------------------- */
async function sendTemplateEmail(template, to, data = {}) {
  const { subject, html } = getEmailTemplate(template, data);
  return await sendEmail(to, subject, html);
}

module.exports = { sendEmail, sendTemplateEmail };