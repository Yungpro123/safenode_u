const axios = require("axios");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const FRONTEND_BASE_URL = process.env.FRONTEND_URL;

// 🔹 1. Initialize deposit (no DB transaction yet)
exports.initiateDeposit = async (req, res) => {
  try {
    const { userId, amount } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({ success: false, message: "UserId and amount are required." });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    if (amount <= 0) {
      return res.status(400).json({ success: false, message: "Amount must be greater than zero." });
    }

    // Initialize Paystack transaction
    const paystackRes = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: user.email,
        amount: amount * 100, // Paystack expects kobo
        callback_url: `${FRONTEND_BASE_URL}/api/deposit/verify`,
        metadata: { userId: user._id.toString(), amount },
      },
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const { authorization_url, reference } = paystackRes.data.data;

    // Return Paystack URL & reference to frontend
    return res.json({
      success: true,
      message: "Paystack transaction initialized.",
      paymentUrl: authorization_url,
      reference,
    });
  } catch (err) {
    console.error("❌ Deposit initialization error:", err.message);
    return res.status(500).json({ success: false, message: "Server error initializing deposit." });
  }
};

// 🔹 2. Verify deposit (credit wallet AFTER successful payment)const axios = require("axios");

// 🔹 Verify deposit & credit user wallet// 🔹 2. Verify deposit (credit wallet AFTER successful payment)
/* =========================================================================
   🔹 Helper: Live currency conversion (with fallback)
=========================================================================== */

const EXCHANGE_API_KEY = "73d27833fb6ecdc13cd67fa7"; // your key

// 🔹 Helper: Get conversion rate using ExchangeRate-API
async function getConversionRate(from, to) {
  try {
    if (from === to) return 1;

    const res = await axios.get(
      `https://v6.exchangerate-api.com/v6/${EXCHANGE_API_KEY}/pair/${from}/${to}`
    );

    if (res.data && res.data.result === "success" && res.data.conversion_rate) {
      const rate = res.data.conversion_rate;
      console.log(`🌍 Live rate fetched: 1 ${from} = ${rate} ${to}`);
      return rate;
    } else {
      throw new Error("Invalid response from ExchangeRate-API");
    }
  } catch (err) {
    console.error("⚠️ Live rate fetch failed:", err.message);

    // Fallback static rates
    const fallbackRates = {
      "NGN_USDT": 1 / 1500,
      "USDT_NGN": 1500,
      "NGN_USD": 1 / 1600,
      "USD_NGN": 1600,
    };

    const key = `${from}_${to}`;
    return fallbackRates[key] || 1;
  }
}

// 🔹 Verify deposit & credit user wallet
exports.verifyDeposit = async (req, res) => {
  try {
    const { reference } = req.query;
    if (!reference) return res.status(400).send("Missing transaction reference.");

    // 🔍 Verify Paystack transaction
    const verifyRes = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
    );

    const data = verifyRes.data?.data;
    if (!data || data.status !== "success") {
      console.log("⚠️ Deposit verification failed for reference:", reference);
      return res.redirect(`${FRONTEND_BASE_URL}/dashboard?status=failed`);
    }

    const { amount, metadata } = data; // amount in kobo
    const userId = metadata.userId;
    const depositAmount = amount / 100; // NGN

    // 🔹 Find user
    const user = await User.findById(userId);
    if (!user) {
      console.log("⚠️ User not found for deposit:", userId);
      return res.redirect(`${FRONTEND_BASE_URL}/dashboard?status=user_not_found`);
    }

    // 🧱 Prevent duplicate transactions
    let existingTx = await Transaction.findOne({ reference });
    if (existingTx) {
      return res.redirect(`${FRONTEND_BASE_URL}/dashboard?status=already_verified`);
    }

    // ✅ Ensure wallet consistency before crediting
    if (!user.wallet) user.wallet = { balance: 0, currency: user.currency || "NGN" };
    if (typeof user.wallet.balance !== "number") user.wallet.balance = 0;
    if (!user.wallet.currency) user.wallet.currency = user.currency || "NGN";

    // 👇 Determine target currency
    const walletCurrency = user.wallet.currency.toUpperCase();
    const targetCurrency = walletCurrency === "USDT" ? "USD" : walletCurrency;

    // 🔁 Convert deposit if needed
    let creditAmount = depositAmount;
    if (targetCurrency !== "NGN") {
      const rate = await getConversionRate("NGN", targetCurrency);
      creditAmount = depositAmount / rate;
      console.log(`💱 Converted ₦${depositAmount} → ${creditAmount.toFixed(2)} ${targetCurrency}`);
    }

    // ✅ Credit user wallet
    user.wallet.balance += creditAmount;
    user.wallet.currency = walletCurrency; // keep wallet currency as original
    user.markModified("wallet");
    await user.save();

    // ✅ Record transaction
    await Transaction.create({
      userId: user._id,
      type: "deposit",
      amount: creditAmount,
      currency: walletCurrency,
      userEmail: user.email,
      status: "success",
      reference,
      note: `Deposit successful (${walletCurrency})`,
    });

    console.log(`✅ Deposit verified & wallet credited: ${user.email} +${creditAmount.toFixed(2)} ${walletCurrency}`);

    return res.redirect(`${FRONTEND_BASE_URL}/dashboard?status=success`);
  } catch (err) {
    console.error("❌ Deposit verification error:", err.message);
    return res.redirect(`${FRONTEND_BASE_URL}/dashboard?status=server_error`);
  }
};


// 🔹 3. Get all user transactions
exports.getUserTransactions = async (req, res) => {
  try {
    const userId = req.headers.userid || req.query.userId;
    if (!userId) return res.status(400).json({ success: false, message: "Missing userId" });

    const transactions = await Transaction.find({ userId }).sort({ createdAt: -1 });
    return res.json({ success: true, transactions });
  } catch (err) {
    console.error("❌ Error fetching transactions:", err.message);
    return res.status(500).json({ success: false, message: "Server error fetching transactions." });
  }
};