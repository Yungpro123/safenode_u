const axios = require("axios");
require("dotenv").config();

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || "no-reply@safenode.com";

// =========================================================
// 📩 BASE EMAIL TEMPLATE
// =========================================================
function baseTemplate(content) {
  const appName = process.env.APP_NAME || "SafeNode";
  return `
  <div style="font-family: 'Inter', Arial, sans-serif; background:#f5f9f7; padding:30px;">
    <div style="max-width:580px; margin:auto; background:#ffffff; border-radius:14px; 
      box-shadow:0 6px 20px rgba(0,0,0,0.05); padding:32px;">
      
      <div style="text-align:center; margin-bottom:20px;">
        <h2 style="margin:0; color:#00a86b; font-size:18px;">${appName}</h2>
        <p style="color:#6b7d7a; font-size:13px;">Escrow Made Simple & Safe</p>
      </div>

      ${content}

      <div style="border-top:1px solid #e5e7eb; margin-top:30px; padding-top:20px; 
        text-align:center; color:#6b7280; font-size:12px;">
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
          <h3>Welcome to ${appName}, ${data.name || "User"}!</h3>
          <p>Click below to verify your account.</p>
          <a href="${data.verifyLink}" 
             style="background:#00a86b;color:white;padding:12px 24px;border-radius:8px;
             text-decoration:none;display:inline-block;">Verify Email</a>
        `),
      };

    case "resetPassword":
      return {
        subject: `Reset Your ${appName} Password`,
        html: baseTemplate(`
          <h3>Hello ${data.name || "User"}</h3>
          <p>Click below to reset your password.</p>
          <a href="${data.resetLink}" 
             style="background:#00a86b;color:white;padding:12px 24px;border-radius:8px;
             text-decoration:none;display:inline-block;">Reset Password</a>
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

    default:
      return {
        subject: `${appName} Notification`,
        html: baseTemplate(`<p>${data.message || "You have a new update."}</p>`),
      };
  }
}

// =========================================================
// ✉️ SEND EMAIL VIA BREVO (AXIOS VERSION)
// =========================================================
async function sendTemplateEmail(template, to, data = {}) {
  const { subject, html } = getEmailTemplate(template, data);

  try {
    await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: { name: process.env.APP_NAME || "SafeNode", email: SENDER_EMAIL },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      },
      {
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(`✅ Brevo email sent to ${to} (${subject})`);
    return true;

  } catch (err) {
    console.error("❌ Brevo email failed:", err.response?.data || err.message);
    return false;
  }
}

module.exports = { sendTemplateEmail };