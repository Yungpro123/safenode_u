const User = require("../models/User");
const Contract = require("../models/Contract");
const Transaction = require("../models/Transaction");
const { sendTemplateEmail } = require("../utils/mailer");

const FRONTEND_URL = process.env.FRONTEND_URL;
/* =======================================================
   🏠 GET DASHBOARD DATA
   ======================================================= */
exports.getDashboardData = async (req, res) => {
  try {
    const userId = req.headers.userid;

    if (!userId || userId === "null" || userId === "undefined") {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing user ID",
      });
    }

    const user = await User.findById(userId).select("-password");
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    // Get user's contracts
    const contracts = await Contract.find({
      $or: [{ buyer: user.email }, { sellerEmail: user.email }],
    }).sort({ createdAt: -1 });
    // Get user's transactions (by userId)
    const transactions = await Transaction.find({
      userId: user._id,
    }).sort({ createdAt: -1 });

    const currency = user.country?.toLowerCase().includes("nigeria")
      ? "NGN"
      : "USD";

    res.json({
      success: true,
      user: {
        name: user.name,
        email: user.email,
        country: user.country,
        currency,
        wallet: Number(user.wallet?.balance || 0),
        usdt: Number(user.wallet?.usdt || 0),
        disputes: user.disputeCount || 0,
        verified: user.verified,
      },
      contracts,
      transactions, // 👈 Now fetched directly via userId
    });
  } catch (err) {
    console.error("Dashboard fetch error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* =======================================================
   💰 WALLET DEPOSIT
   ======================================================= */
exports.depositToWallet = async (req, res) => {
  try {
    const userId = req.headers.userid;
    const { amount } = req.body;

    if (!userId || !amount)
      return res
        .status(400)
        .json({ success: false, message: "Invalid request" });

    const user = await User.findById(userId);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0)
      return res
        .status(400)
        .json({ success: false, message: "Invalid amount" });

    user.wallet = user.wallet || {};
    user.wallet.balance = Number(user.wallet.balance || 0) + depositAmount;
    await user.save();

    await Transaction.create({
      userId: user._id,
      userEmail: user.email,
      type: "deposit",
      amount: depositAmount,
      currency: "NGN",
      note: "Manual deposit to wallet",
    });

    res.json({
      success: true,
      message: "Deposit successful",
      wallet: Number(user.wallet.balance),
    });
  } catch (err) {
    console.error("Deposit error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* =======================================================
   💸 WALLET WITHDRAW
   ======================================================= */
exports.withdrawFromWallet = async (req, res) => {
  try {
    const userId = req.headers.userid;
    const { amount } = req.body;

    if (!userId || !amount)
      return res
        .status(400)
        .json({ success: false, message: "Invalid request" });

    const user = await User.findById(userId);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0)
      return res
        .status(400)
        .json({ success: false, message: "Invalid withdrawal amount" });

    if (Number(user.wallet?.balance || 0) < amt)
      return res
        .status(400)
        .json({ success: false, message: "Insufficient funds" });

    user.wallet.balance = Number(user.wallet.balance) - amt;
    await user.save();

    await Transaction.create({
      userId: user._id,
      userEmail: user.email,
      type: "withdraw",
      amount: amt,
      currency: "NGN",
      note: "Wallet withdrawal",
    });

    res.json({
      success: true,
      message: "Withdrawal successful",
      wallet: Number(user.wallet.balance),
    });
  } catch (err) {
    console.error("Withdraw error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* =======================================================
   ⚙️ UPDATE USER SETTINGS
   ======================================================= */
exports.updateSettings = async (req, res) => {
  try {
    const userId = req.headers.userid;
    const { name, country } = req.body;

    if (!userId)
      return res
        .status(400)
        .json({ success: false, message: "Missing user ID" });

    const user = await User.findById(userId);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    if (name) user.name = name;
    if (country) user.country = country;
    await user.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      user,
    });
  } catch (err) {
    console.error("Settings update error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

/* =======================================================
   ⚖️ RAISE DISPUTE
   ======================================================= */

/* =======================================================
   🔁 RELEASE FUNDS (Supports NGN ↔ USDT Conversion)
   ======================================================= */
/* =======================================================
   🔁 RELEASE FUNDS (Fixed Conversion Logic NGN ↔ USDT)
   ======================================================= */
exports.releaseFunds = async (req, res) => {
  try {
    const { contractId } = req.body;

    // 🔍 Find contract
    const contract = await Contract.findById(contractId);
    if (!contract)
      return res.status(404).json({ success: false, message: "Contract not found" });

    if (!["accepted", "funded"].includes(contract.status))
      return res.status(400).json({ success: false, message: "Funds cannot be released yet" });

    // 🔍 Find buyer and seller
    const seller = await User.findOne({ email: contract.sellerEmail });
    const buyer = await User.findOne({ email: contract.buyer });

    if (!seller || !buyer)
      return res.status(404).json({ success: false, message: "Buyer or seller not found" });

    // ⚙️ Conversion settings
    const NGN_TO_USDT = 1500;
    const fromCurrency = contract.currency;

    // 🔍 Determine seller's preferred payout currency from their country
    const sellerCurrency = seller.country?.toLowerCase().includes("nigeria")
      ? "NGN"
      : "USDT";

    let amount = Number(contract.amount);
    const fee = (amount * 6) / 100;

    // 💸 Deduct fees
    if (contract.chargePayer === "seller") amount -= fee;
    else if (contract.chargePayer === "split") amount -= fee / 2;

    let creditedAmount = 0;
 
 let ngnBalance = 0 ;
 let usdtBalance = 0;
    // 🔄 Conversion Logic
    if (fromCurrency === sellerCurrency) {
      creditedAmount = amount;
      usdtBalance = creditedAmount
      ngnBalance = creditedAmount
    } else if (fromCurrency === "NGN" && sellerCurrency === "USDT") {
      creditedAmount = amount / NGN_TO_USDT
      usdtBalance = creditedAmount
      ;
    } else if (fromCurrency === "USDT" && sellerCurrency === "NGN") {
      creditedAmount = amount * NGN_TO_USDT
      ngnBalance = creditedAmount
    }

    // 💰 Credit seller wallet
    userwallet = seller.wallet || {};
if (sellerCurrency === "NGN") {
  seller.wallet.balance = seller.wallet.balance + creditedAmount;
} else {
  seller.wallet.balance = seller.wallet.balance + usdtBalance;
}
await seller.save();

    // 🧾 Log release transaction
    await Transaction.create({
      userId: seller._id,
      userEmail: seller.email,
      type: "release",
      amount: "+" + creditedAmount,
      currency: sellerCurrency,
      note: `Funds released from escrow (${contract.title})`,
    });

    // 🧾 Log system fee
    await Transaction.create({
      userId: buyer._id,
      userEmail: "system@safenode",
      type: "fee",
      amount: fee,
      currency: fromCurrency,
      note: `Fee charged for ${contract.title}`,
    });
    console.log(contract.buyername,contract.sellername)
    contract.status = "completed";
    await contract.save();
   await sendTemplateEmail("fundReleased", contract.sellerEmail, {
  buyerName: contract.buyername,
  sellerName: contract.sellername,
  contractTitle: contract.title,
  amount: contract.amount,
  dashboardLink: `${FRONTEND_URL}/dashboard/`
});
    // ✅ Mark contract completed
    

    res.json({
      success: true,
      message: `Funds released successfully to seller in ${fromCurrency}`,
      creditedAmount: creditedAmount.toFixed(2),
      currency: sellerCurrency,
      feeApplied: fee.toFixed(2),
      rateUsed: NGN_TO_USDT,
    });
  } catch (err) {
    console.error("ReleaseFunds Error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/* =======================================================
   📜 GET TRANSACTIONS BY USER ID
   ======================================================= */

exports.getTransactionsByUserId = async (req, res) => {
  try {
    const userId = req.headers.userid;

    // ✅ Validate
    if (!userId || userId === "undefined" || userId === "null") {
      return res.status(400).json({
        success: false,
        message: "User ID is required in headers",
      });
    }

    // ✅ Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ✅ Fetch all transactions by user email
    const transactions = await Transaction.find({ userEmail: user.email }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: transactions.length,
      transactions,
    });
  } catch (err) {
    console.error("getTransactionsByUserId Error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};