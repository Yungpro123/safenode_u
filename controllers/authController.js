const User = require("../models/User");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
require("dotenv").config();
const { createTronWallet } = require("../utils/tronWallet");
const FRONTEND_URL = process.env.FRONTEND_URL;

/* =========================================================================
   🧩 CREATE MAIL TRANSPORTER (Render safe using STARTTLS port 587)
=========================================================================== */
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // use STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS, // Gmail App Password
  },
});

/* =========================================================================
   🧩 REGISTER USER
=========================================================================== */
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password, country, currency } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Email already registered." });
    }

    const hashedPassword = crypto.createHash("sha256").update(password).digest("hex");
    const userCurrency = currency || (country?.toLowerCase() === "nigeria" ? "NGN" : "USDT");
    const token = crypto.randomBytes(20).toString("hex");

    let tronWallet = null;
    try {
      tronWallet = await createTronWallet();
    } catch (err) {
      console.error("❌ Failed to generate TRON wallet:", err.message);
      return res.status(500).json({ success: false, message: "Failed to generate wallet." });
    }

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
    console.log("Verification URL:", verifyUrl);

    // Send verification email
    await transporter.sendMail({
      from: `"${process.env.APP_NAME || "SafeNode"} Verification" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Verify Your SafeNode Account",
      html: `
        <div style="font-family:'Inter',sans-serif;background:#f5f9f7;padding:40px 0;">
          <table align="center" cellpadding="0" cellspacing="0"
            style="max-width:520px;width:100%;background:#ffffff;border-radius:16px;
                   box-shadow:0 4px 16px rgba(0,0,0,0.06);overflow:hidden;">
            <tr>
              <td style="padding:18px 0;text-align:center;">
                <span style="font-weight:700;font-size:1.25rem;color:#00a86b;">
                  SafeNode
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:35px 40px;">
                <h2 style="color:#083d2c;font-size:22px;font-weight:700;">Hi ${name},</h2>
                <p style="color:#333;font-size:15px;line-height:1.6;">
                  Please verify your email to activate your SafeNode account.
                </p>
                <div style="text-align:center;margin:30px 0;">
                  <a href="${verifyUrl}"
                     style="background:#00b55a;color:#fff;text-decoration:none;
                            font-weight:600;padding:12px 28px;border-radius:10px;
                            display:inline-block;">Verify My Account</a>
                </div>
                <p style="color:#999;font-size:12px;text-align:center;">
                  © ${new Date().getFullYear()} SafeNode. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </div>`,
    });

    console.log("✅ Verification email sent to:", email);
    return res.json({
      success: true,
      message: "Account created successfully. Please check your email to verify your account.",
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

    if (!user) return res.status(400).send("Invalid or expired verification link.");

    user.verified = true;
    user.verificationToken = null;
    await user.save();

    return res.send(`
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Account Verified — SafeNode</title>
          <style>
            body { font-family: Arial, sans-serif; background: #f9fffa; text-align: center; margin:0; padding-top: 100px; }
            h2 { color: #00a86b; }
            a { display: inline-block; margin-top: 20px; padding: 10px 20px; background: #00a86b; color: #fff; border-radius: 6px; text-decoration: none; }
          </style>
        </head>
        <body>
          <h2>Your account has been successfully verified!</h2>
          <a href="/auth.html">Go to Login</a>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("❌ Verification Error:", error.message);
    return res.status(500).send("Failed to verify account.");
  }
};

/* =========================================================================
   🧩 LOGIN USER
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
    const sessionExpiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    user.sessionId = sessionId;
    user.sessionExpiresAt = sessionExpiresAt;
    await user.save();

    res.cookie("sessionId", sessionId, {
      httpOnly: true,
      sameSite: "Lax",
      maxAge: 14 * 24 * 60 * 60 * 1000,
    });

    // Send login alert email
    try {
      await transporter.sendMail({
        from: `"SafeNode" <${process.env.SMTP_USER}>`,
        to: user.email,
        subject: "New Login Detected — SafeNode",
        html: `
          <div style="background:#f4f6f8;padding:40px 0;font-family:'Inter',sans-serif;">
            <table align="center" cellpadding="0" cellspacing="0"
              style="max-width:520px;width:100%;background:#fff;border-radius:14px;
                     box-shadow:0 4px 16px rgba(0,0,0,0.08);overflow:hidden;">
              <tr>
                <td style="text-align:center;padding:25px 0;background:#00b55a;">
                  <h1 style="color:#fff;font-size:24px;font-weight:700;">SafeNode</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:35px 40px;">
                  <h2 style="color:#083d2c;font-size:22px;margin-bottom:10px;">New Login Detected</h2>
                  <p style="color:#333;font-size:15px;line-height:1.6;margin-bottom:20px;">
                    Hi ${user.name}, your SafeNode account was just accessed successfully.
                  </p>
                  <p style="color:#555;font-size:14px;line-height:1.6;">
                    <strong>Time:</strong> ${new Date().toLocaleString()}<br/>
                    <strong>Device:</strong> ${req.headers["user-agent"] || "Unknown Device"}
                  </p>
                  <div style="text-align:center;margin:30px 0;">
                    <a href="${FRONTEND_URL}/reset"
                      style="background:#00b55a;color:#fff;text-decoration:none;font-weight:600;
                             padding:12px 28px;border-radius:8px;display:inline-block;">
                      Reset Password
                    </a>
                  </div>
                </td>
              </tr>
            </table>
          </div>`,
      });
    } catch (err) {
      console.error("⚠️ Login email failed:", err.message);
    }

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
   🧩 FORGOT PASSWORD
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

    await transporter.sendMail({
      from: `"SafeNode" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: "Reset Your SafeNode Password",
      html: `
      <div style="background:#f4f6f8;padding:40px 0;font-family:'Inter',sans-serif;">
        <table align="center" cellpadding="0" cellspacing="0"
          style="max-width:520px;width:100%;background:#fff;border-radius:14px;
                 box-shadow:0 4px 16px rgba(0,0,0,0.08);overflow:hidden;">
          <tr>
            <td style="text-align:center;padding:25px 0;background:#00b55a;">
              <h1 style="color:#fff;font-size:24px;font-weight:700;">SafeNode</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:35px 40px;">
              <h2 style="color:#083d2c;font-size:22px;margin-bottom:10px;">Reset Your Password</h2>
              <p style="color:#333;font-size:15px;line-height:1.6;margin-bottom:25px;">
                Hi ${user.name}, click the button below to reset your password.
                This link expires in 1 hour.
              </p>
              <div style="text-align:center;margin:30px 0;">
                <a href="${resetLink}"
                  style="background:#00b55a;color:#fff;text-decoration:none;font-weight:600;
                         padding:12px 28px;border-radius:8px;display:inline-block;">
                  Reset Password
                </a>
              </div>
            </td>
          </tr>
        </table>
      </div>`,
    });

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

    if (!user) return res.status(400).json({ success: false, message: "Invalid or expired token" });

    const newPasswordHash = crypto.createHash("sha256").update(password).digest("hex");

    user.password = newPasswordHash;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.json({ success: true, message: "Password reset successful. You can now log in." });
  } catch (err) {
    console.error("❌ Reset password error:", err.message);
    res.status(500).json({ success: false, message: "Server error resetting password." });
  }
};