const axios = require("axios");

/* ==========================================================================
   📧 SEND EMAIL (BREVO + AXIOS)
========================================================================== */
async function sendEmailBrevo(to, subject, html) {
  try {
    await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          email: process.env.BREVO_SENDER_EMAIL,
          name: process.env.BREVO_SENDER_NAME,
        },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": process.env.BREVO_API_KEY,
        }
      }
    );

    console.log(`✅ Email sent to ${to} (${subject})`);
    return true;

  } catch (err) {
    if (err.response) {
      console.error("❌ BREVO API ERROR:", err.response.data);
    } else {
      console.error("❌ BREVO NETWORK ERROR:", err.message);
    }
    return false;
  }
}

/* ==========================================================================
   📦 BASE TEMPLATE
========================================================================== */
function baseTemplate(content) {
  const appName = process.env.APP_NAME || "SafeNode";
  const logoUrl = process.env.LOGO_URL || "";

  return `
  <div style="font-family:Inter,Arial,sans-serif;background:#f6f9fc;padding:30px;">
    <div style="max-width:600px;margin:auto;background:white;border-radius:16px;padding:30px;box-shadow:0 4px 25px rgba(0,0,0,0.07);">
      
      <div style="text-align:center;margin-bottom:20px;">
        ${logoUrl ? `<img src="${logoUrl}" width="70" style="margin-bottom:10px;" />` : ""}
        <h2 style="color:#00a86b;margin:0;font-size:20px;">${appName}</h2>
      </div>

      ${content}

      <div style="margin-top:30px;text-align:center;color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb;padding-top:15px;">
        © ${new Date().getFullYear()} ${appName}. All rights reserved.
      </div>
    </div>
  </div>`;
}

/* ==========================================================================
   🧩 TEMPLATES
========================================================================== */
function getEmailTemplate(template, data = {}) {
  const appName = process.env.APP_NAME || "SafeNode";

  switch (template) {
    case "verification":
      return {
        subject: `Verify Your ${appName} Account`,
        html: baseTemplate(`
          <h3>Welcome, ${data.name || "User"}!</h3>
          <p>Click below to verify your email:</p>
          <a href="${data.verifyLink}" style="background:#00a86b;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Verify Email</a>
        `)
      };

    case "resetPassword":
      return {
        subject: "Reset Your Password",
        html: baseTemplate(`
          <h3>Hello ${data.name || "User"},</h3>
          <p>Click below to reset your password:</p>
          <a href="${data.resetLink}" style="background:#00a86b;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Reset Password</a>
          <p style="font-size:12px;color:#6b7280;">Link expires in 10 minutes.</p>
        `)
      };

  case "refund":
  return {
    subject: "Sispute Resolved: Refund Processed for ${data.contractTitle}",
    html: baseTemplate(`
      <h3>Hello ${data.name},</h3>
      
      <div style="background:#f0fff8; border:1px solid #cce8da; border-radius:10px; padding:20px; margin-bottom:20px;">
        <h4 style="color:var(--primary); margin-top:0;">Dispute Resolution Complete</h4>
        <p style="color:#555;">
          This email confirms that the dispute regarding the contract <strong>${data.contractTitle}</strong> (ID: ${data.contractId}) has been **successfully resolved**. 
          We have processed the agreed-upon refund amount.
        </p>
      </div>

      <p style="font-size:16px;">
        The refund amount has been credited back to your original payment method:
      </p>
      
      <table style="width:100%; margin:20px 0; border-collapse:collapse; text-align:left;">
        <tr>
          <td style="padding:10px 0; border-bottom:1px solid #eee;">**Contract Title:**</td>
          <td style="padding:10px 0; border-bottom:1px solid #eee; text-align:right;">${data.contractTitle}</td>
        </tr>
        <tr>
          <td style="padding:10px 0; font-size:18px; font-weight:700;">**Refund Amount:**</td>
          <td style="padding:10px 0; font-size:18px; font-weight:700; color:var(--primary); text-align:right;">₦${data.amount}</td>
        </tr>
      </table>

      <p style="margin-top:30px; font-size:14px; color:#777;">
        **Next Steps:** Please allow **3-5 business days** for the funds to reflect in your bank or wallet statement, as processing times vary by financial institution.
      </p>

      <p style="font-size:14px; color:#777;">
        If you have any questions about the dispute resolution, please reply to this email.
      </p>
    `)
  };


    case "fundReleased":
      return {
        subject: "Funds Released",
        html: baseTemplate(`
          <h3>Hello ${data.sellerName},</h3>
          <p>The buyer <strong>${data.buyerName}</strong> released the funds.</p>
          <p>Amount: <strong>₦${data.amount}</strong></p>
        `)
      };
    case "Invite":
      return {
        subject: "Contract invite",
        html: baseTemplate(`
          <h3>Hello ${data.sellerName},</h3>
          <p>This buyer <strong>${data.buyerName}</strong> just created a contract with you as the seller.</p>
          <p>Amount: <strong>₦${data.amount}</strong></p>
          <a href="${data.dashboardLink}" style="background:#00a86b;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Reset Password</a>
        `)
      };
      case "dispute":
      return {
        subject: `Dispute Opened - ${appName}`,
        html: baseTemplate(`
          <h3 style="color:#111827;">Dispute Opened</h3>
          <p>A dispute has been initiated for the contract: <strong>${data.contractTitle}</strong>.</p>
          <p>Note: <em>Please do well to contribute to the dispute or else the other party will be credited after 3 days </em></p>
          <p>Our team will review the case and notify both parties soon.</p>
        `),
      };
    

    case "withdrawal":
      return {
        subject: "Withdrawal Processed",
        html: baseTemplate(`
          <h3>Hello ${data.name},</h3>
          <p>Your withdrawal of <strong>₦${data.amount}</strong> is successful.</p>
        `)
      };

    case "sellerAccepted":
      return {
        subject: "Seller Accepted Your Contract",
        html: baseTemplate(`
          <h3>Hello ${data.buyerName},</h3>
          <p>The seller <strong>${data.sellerName}</strong> has accepted your contract.</p>
          <p>Amount: <strong>₦${data.amount}</strong></p>
        `)
      };

    case "requestFunds":
      return {
        subject: "Payment Requested",
        html: baseTemplate(`
          <h3>Hello ${data.buyerName},</h3>
          <p>The seller <strong>${data.sellerName}</strong> requested payment for the contract:</p>
          <p><strong>${data.contractTitle}</strong></p>
          <p>Amount: ₦${data.amount}</p>
        `)
      };

    default:
      return {
        subject: `${appName} Notification`,
        html: baseTemplate(`<p>${data.message || "Notification"}</p>`)
      };
  }
}

/* ==========================================================================
   ✉️ SEND TEMPLATE EMAIL
========================================================================== */
async function sendTemplateEmail(template, to, data = {}) {
  const { subject, html } = getEmailTemplate(template, data);
  return await sendEmailBrevo(to, subject, html);
}

module.exports = { sendEmailBrevo, sendTemplateEmail };