const User = require("../models/User");
const crypto = require("crypto");
require("dotenv").config();
const { createTronWallet } = require("../utils/tronWallet");
const FRONTEND_URL = process.env.FRONTEND_URL;

// =========================== BREVO SETUP ================================
const Brevo = require("@getbrevo/brevo");
const brevoApi = new Brevo.TransactionalEmailsApi();

brevoApi.setApiKey(
  Brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

// ======================= SEND BREVO EMAIL ===============================
async function sendBrevoEmail(to, subject, html) {
  try {
    await brevoApi.sendTransacEmail({
      sender: {
        email: process.env.BREVO_SENDER_EMAIL,
        name: process.env.APP_NAME || "SafeNode",
      },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    });

    console.log("📧 Email sent to", to);
    return true;
  } catch (err) {
    console.error("❌ Brevo Email Error:", err.response?.body || err.message);
    return false;
  }
}
function generateShortToken(length = 4) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Usage

/* =========================================================================
   🧩 REGISTER USER (BREVO VERSION)
=========================================================================== */
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password, country, currency } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: "All fields are required." });

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ success: false, message: "Email already registered." });
if (!existingUser)
      return res.status(400).json({ success: false, message: "User not found." });

    const hashedPassword = crypto.createHash("sha256").update(password).digest("hex");
    const userCurrency = currency || (country?.toLowerCase() === "nigeria" ? "NGN" : "USDT");
    const token = generateShortToken(4); // e.g., 'aB3dE9'
  
    let tronWallet = await createTronWallet();

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      country: country || "Unknown",
      currency: userCurrency,
      verified: false,
      verificationToken: token,
      wallet: {
        address: tronWallet.address,
        encryptedPrivateKey: tronWallet.encryptedPrivateKey,
        balance: 0,
        iv: tronWallet.iv,
      },
      disputes: 0,
    });

    await newUser.save();

    const verifyUrl = `${FRONTEND_URL}/api/auth/verify/${token}`;

    const html = `
      <div style="font-family:'Inter',sans-serif;background:#f5f9f7;padding:40px 0;">
        <table align="center" cellpadding="0" cellspacing="0"
          style="max-width:520px;width:100%;background:#ffffff;border-radius:16px;
                box-shadow:0 4px 16px rgba(0,0,0,0.06);overflow:hidden;">
          <tr>
            <td style="padding:18px 0;text-align:center;">
              <span style="font-weight:700;font-size:1.25rem;color:#00a86b;">SafeNode</span>
            </td>
          </tr>
          <tr>
            <td style="padding:35px 40px;text-align:left;">
              <h2 style="color:#083d2c;font-size:22px;font-weight:700;">Hi ${name},</h2>
              <p style="color:#333;font-size:15px;line-height:1.6;">
                Please verify your email to activate your SafeNode account.
              </p>
              <div style="text-align:center;margin:30px 0;">
                <a href="${verifyUrl}"
                  style="background:#00b55a;color:#fff;text-decoration:none;
                         font-weight:600;padding:12px 28px;border-radius:10px;">
                  Verify My Account
                </a>
              </div>
              <p style="color:#999;font-size:12px;text-align:center;">
                © ${new Date().getFullYear()} SafeNode. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </div>`;

    await sendBrevoEmail(email, "Verify Your SafeNode Account", html);

    return res.json({
      success: true,
      message: "Account created successfully. Please check your email to verify.",
    });
  } catch (error) {
    console.error("❌ Registration Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to register user." });
  }
};

/* =========================================================================
   🧩 VERIFY EMAIL
=========================================================================== */
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    const user = await User.findOne({ verificationToken: token });

    if (!user) return res.status(400).send("Pls check kf your Account has been verified , or this is an expired link");

    user.verified = true;
    user.verificationToken = null;
    await user.save();

    return res.send(`
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Account Verified — SafeNode</title>
          <style>
            body { font-family: Arial, sans-serif; background: #f9fffa; text-align: center; padding-top: 100px; }
            h2 { color: #00a86b; }
            a { padding: 10px 20px; background: #00a86b; color: #fff; border-radius: 6px; text-decoration: none; }
          </style>
        </head>
        <body>
          <h2>Your account has been successfully verified!</h2>
          <a href="/auth.html">Go to Login</a>
        </body>
      </html>`);
  } catch (error) {
    console.error("❌ Verification Error:", error.message);
    return res.status(500).send("Failed to verify account.");
  }
};

/* =========================================================================
   🧩 LOGIN USER + LOGIN ALERT EMAIL
=========================================================================== */
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.json({ success: false, message: "Invalid credentials." });

    const passwordHash = crypto.createHash("sha256").update(password).digest("hex");
    if (user.password !== passwordHash)
      return res.json({ success: false, message: "Invalid credentials." });

    if (!user.verified)
      return res.json({ success: false, message: "Please verify your account first." });

    const sessionId = crypto.randomBytes(16).toString("hex");
    user.sessionId = sessionId;
    user.sessionExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    await user.save();

    res.cookie("sessionId", sessionId, {
      httpOnly: true,
      sameSite: "Lax",
      maxAge: 14 * 24 * 60 * 60 * 1000,
    });

    const loginHtml = `
      <div style="background:#f4f6f8;padding:40px 0;font-family:'Inter',sans-serif;">
        <table align="center" cellpadding="0" cellspacing="0"
          style="max-width:520px;width:100%;background:#fff;border-radius:14px;
                box-shadow:0 4px 16px rgba(0,0,0,0.08);overflow:hidden;">
          <tr>
            <td style="background:#00b55a;padding:25px 0;text-align:center;">
              <h1 style="color:#fff;font-size:24px;font-weight:700;">SafeNode</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:35px 40px;text-align:left;">
              <h2 style="color:#083d2c;font-size:22px;">New Login Detected</h2>
              <p style="color:#333;font-size:15px;line-height:1.6;">
                Hi ${user.name}, your SafeNode account was just accessed.
              </p>
              <p style="color:#555;font-size:14px;">
                <strong>Time:</strong> ${new Date().toLocaleString()}<br>
                <strong>Device:</strong> ${req.headers["user-agent"] || "Unknown"}
              </p>
              <div style="text-align:center;margin:30px 0;">
                <a href="${FRONTEND_URL}/reset"
                  style="background:#00b55a;color:#fff;font-weight:600;
                        padding:12px 28px;border-radius:8px;text-decoration:none;">
                  Reset Password
                </a>
              </div>
            </td>
          </tr>
        </table>
      </div>`;
    sendBrevoEmail(user.email, "New Login Detected — SafeNode", loginHtml);

    return res.json({
      success: true,
      message: "Login successful.",
      userId: user._id,
      name: user.name,
      email: user.email,
      country: user.country,
      currency: user.currency,
      wallet: user.wallet,
    });
    
  } catch (err) {
    console.error("❌ Login Error:", err.message);
    res.status(500).json({ success: false, message: "Server error." });
  }
};

/* =========================================================================
   🧩 FORGOT PASSWORD (BREVO)
=========================================================================== */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");

    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000;
    await user.save();

    const resetLink = `${FRONTEND_URL}/reset?token=${resetToken}`;

    const html = `
      <div style="background:#f4f6f8;padding:40px 0;font-family:'Inter',sans-serif;">
        <table align="center" cellpadding="0" cellspacing="0"
          style="max-width:520px;width:100%;background:#fff;border-radius:14px;
               box-shadow:0 4px 16px rgba(0,0,0,0.08);overflow:hidden;">
          <tr>
            <td style="background:#00b55a;padding:25px 0;text-align:center;">
              <h1 style="color:#fff;font-size:24px;font-weight:700;">SafeNode</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:35px 40px;text-align:left;">
              <h2 style="color:#083d2c;font-size:22px;">Reset Your Password</h2>
              <p style="color:#333;font-size:15px;">
                Hi ${user.name}, click below to reset your password. This link expires in 1 hour.
              </p>
              <div style="text-align:center;margin:30px 0;">
                <a href="${resetLink}"
                  style="background:#00b55a;color:#fff;font-weight:600;
                         padding:12px 28px;border-radius:8px;text-decoration:none;">
                  Reset Password
                </a>
              </div>
            </td>
          </tr>
        </table>
      </div>`;

    await sendBrevoEmail(user.email, "Reset Your SafeNode Password", html);

    return res.json({ success: true, message: "Password reset link sent successfully." });
  } catch (err) {
    console.error("❌ Forgot password error:", err.message);
    res.status(500).json({ success: false, message: "Server error sending reset link." });
  }
};

/* =========================================================================
   🧩 RESET PASSWORD
=========================================================================== */
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!token || !password)
      return res.status(400).json({ success: false, message: "Missing token or password" });

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: tokenHash,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user)
      return res.status(400).json({ success: false, message: "Invalid or expired token." });

    user.password = crypto.createHash("sha256").update(password).digest("hex");
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    await user.save();

    return res.json({ success: true, message: "Password reset successful." });
  } catch (err) {
    console.error("❌ ResetPassword Error:", err.message);
    res.status(500).json({ success: false, message: "Server error resetting password." });
  }
};