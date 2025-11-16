const axios = require("axios");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const nodemailer = require("nodemailer");


/**
 * @route POST /api/deposit/initiate
 * @desc Initialize Paystack payment
 * @access Private (user must be logged in)
 */
exports.initiateDeposit = async (req, res) => {
  try {
    const { amount, email } = req.body;

    if (!amount || !email) {
      return res.status(400).json({ message: "Amount and email are required" });
    }

    const koboAmount = Math.round(amount * 100); // Paystack uses kobo (₦100 = 10000)

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email,
        amount: koboAmount,
        callback_url: `${process.env.BASE_URL}/api/deposit/verify`,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const { authorization_url, reference } = response.data.data;

    // Optionally, record pending transaction
    await Transaction.create({
      userEmail: email,
      type: "deposit",
      amount,
      status: "pending",
      reference,
      currency: "NGN",
    });

    res.json({ authorization_url, reference });
  } catch (error) {
    console.error("Error initiating deposit:", error.message);
    res.status(500).json({ message: "Unable to initiate deposit" });
  }
};

/**
 * @route GET /api/deposit/verify?reference=xxxx
 * @desc Verify Paystack payment
 * @access Public (Paystack callback)
 */
exports.verifyDeposit = async (req, res) => {
  try {
    const { reference } = req.query;
    if (!reference) return res.status(400).json({ message: "Missing reference" });

    // Verify transaction with Paystack
    const verifyRes = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const data = verifyRes.data.data;

    if (data.status === "success") {
      // Find and update transaction
      const transaction = await Transaction.findOneAndUpdate(
        { reference },
        { status: "success" },
        { new: true }
      );

      // Credit user wallet
      const user = await User.findOne({ email: data.customer.email });
      if (user) {
        user.wallet.balance = (user.wallet.balance || 0) + data.amount / 100;
        await user.save();
      }

      return res.redirect(`${process.env.FRONTEND_URL}/deposit-success?amount=${data.amount / 100}`);
    } else {
      await Transaction.findOneAndUpdate({ reference }, { status: "failed" });
      return res.redirect(`${process.env.FRONTEND_URL}/deposit-failed`);
    }
  } catch (error) {
    console.error("Verification error:", error.message);
    res.status(500).json({ message: "Verification failed" });
  }
};

exports.requestWithdrawal = async (req, res) => {
  try {
    const { id, amount, currency, bankName, accountNumber } = req.body;
    if (!id || !amount || !currency || !bankName || !accountNumber) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Find user by ID
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (amount > (user.wallet.balance || 0)) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    // Deduct the amount immediately
    user.wallet.balance = (user.wallet.balance || 0) - amount;
    await user.save();

    // Record withdrawal request
    const transaction = await Transaction.create({
      userEmail: user.email,
      type: "withdraw",
      userId: id,
      amount,
      currency,
      status: "pending",
      walletAddress: `${bankName} | ${accountNumber}`,
    });

    // Send email to admin
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: `"SafeNode" <${process.env.SMTP_USER}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `New Withdrawal Request from ${user.name}`,
      html: `
        <h3>Withdrawal Request</h3>
        <p><strong>User:</strong> ${user.name} (${user.email})</p>
        <p><strong>Amount:</strong> ${amount} ${currency}</p>
        <p><strong>Bank:</strong> ${bankName} | ${accountNumber}</p>
        <p><strong>Transaction ID:</strong> ${transaction._id}</p>
      `,
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (emailErr) {
      console.error("Email sending failed:", emailErr.message);
    }

    res.json({
      success: true,
      message: `Withdrawal request submitted. ₦${amount} has been deducted from your wallet.`,
    });

  } catch (err) {
    console.error("Withdrawal request error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};