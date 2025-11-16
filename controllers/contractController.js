const axios = require("axios");
const crypto = require("crypto");
const Contract = require("../models/Contract");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const FRONTEND_BASE_URL = process.env.FRONTEND_URL;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const {sendEmail ,sendTemplateEmail} = require("../utils/mailer");


exports.getUserBalance = async (req, res) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    // Determine wallet currency from country
    let currency = "NGN";
    if (user.country) {
      const c = user.country.toLowerCase();
      if (c === "nigeria" || c === "ng") currency = "NGN";
      else if (["usa", "us", "canada"].includes(c)) currency = "USD";
      else currency = "USDT";
    }

    res.json({
      success: true,
      email: user.email,
      balance: user.wallet.balance,
      currency,
    });
  } catch (err) {
    console.error("Error fetching balance:", err.message);
    res.status(500).json({ success: false, message: "Server error fetching balance." });
  }
};
// 🔹 Create new escrow contract and initialize Paystack payment
// 🔹 Create new escrow contract and handle wallet funding
exports.createContract = async (req, res) => {
  try {
    const { title, description, amount, buyerEmail, paymentMethod, chargePayer } = req.body;

    if (!title || !description || !amount || !buyerEmail || !paymentMethod) {
      return res.status(400).json({ success: false, message: "Missing required fields." });
    }

    // 🔹 Find buyer
    let buyer = await User.findOne({ email: buyerEmail });
    if (!buyer) {
      buyer = new User({
        name: buyerEmail.split("@")[0],
        email: buyerEmail,
        verified: true,
        wallet: { balance: 0 },
        disputes: 0,
        password: crypto.randomBytes(16).toString("hex"),
      });
      await buyer.save();
    }

    // 🔹 Determine currency based on user country
    let currency = "NGN";
    if (buyer.country) {
      const c = buyer.country.toLowerCase();
      if (["nigeria", "ng"].includes(c)) currency = "NGN";
      else if (["usa", "us", "canada"].includes(c)) currency = "USD";
      else currency = "USDT";
    }

    // 🔹 SafeNode fee logic
    const fee = amount * 0.06;
    let totalAmount = amount;
    if (chargePayer === "buyer") totalAmount += fee;
    else if (chargePayer === "split") totalAmount += fee / 2;

    const firstName = buyer.name.split(" ")[0] || "User";

    // 🔹 Initialize contract
    const contract = new Contract({
      title,
      description,
      amount,
      currency,
      buyer: buyer.email,
      buyername: firstName,
      chargePayer: chargePayer || "buyer",
      paymentMethod,
      status: "pending",
      createdAt: new Date(),
    });

    // 🔹 If payment method = wallet
    if (paymentMethod.toLowerCase() === "wallet") {
      const balance = buyer.wallet.balance;

      if (balance < totalAmount) {
        return res.status(400).json({
          success: false,
          message: `Insufficient wallet balance. You need ${currency}${totalAmount.toFixed(
            2
          )}, but your balance is ${currency}${balance.toFixed(2)}.`,
        });
      }
     await Transaction.create({
      userId: buyer._id,
      userEmail: buyerEmail,
      type: "payment",
      amount: "-" + totalAmount,
      currency: currency,
      note: `Payment charged for ${title}`,
    });
      // Deduct and fund contract
      buyer.wallet.balance -= totalAmount;
      await buyer.save();

      contract.status = "funded";
      await contract.save();

      console.log(`✅ Wallet funded contract: ${buyer.email} - ${currency}${totalAmount}`);
      return res.json({
        success: true,
        message: "Contract created and funded via wallet.",
        contractId: contract._id,
        currency,
      });
    }

    // 🔹 If payment method = Paystack
    if (paymentMethod.toLowerCase() === "paystack") {
      const paystackResponse = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email: buyerEmail,
          amount: totalAmount * 100,
          metadata: {
            contractId: contract._id.toString(),
            chargePayer: chargePayer || "buyer",
            safeNodeFee: fee,
          },
          callback_url: `${FRONTEND_BASE_URL}/api/contracts/verify-payment`,
        },
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      const paymentUrl = paystackResponse.data?.data?.authorization_url;
      const reference = paystackResponse.data?.data?.reference;

      if (!paymentUrl) {
        return res.status(500).json({ success: false, message: "Failed to initialize Paystack payment." });
      }

      contract.paymentReference = reference;
      await contract.save();

      return res.json({
        success: true,
        paymentUrl,
        contractId: contract._id,
        currency,
        message: "Contract created successfully. Redirecting to Paystack...",
      });
    }

    // 🔹 For other payment methods (like USDT)
    contract.status = "pending";
    await contract.save();

    res.json({
      success: true,
      message: `Contract created successfully using ${paymentMethod}. Awaiting confirmation.`,
      contractId: contract._id,
      currency,
    });
  } catch (err) {
    console.error("❌ Error creating contract:", err.message);
    res.status(500).json({ success: false, message: "Server error creating contract." });
  }
};


// 🔹 Verify payment from Paystack
// 🔹 Verify payment from Paystack
exports.verifyPayment = async (req, res) => {
  try {
    const { reference } = req.query;
    if (!reference) return res.status(400).send("Missing transaction reference.");

    // 🔹 Find contract by payment reference
    const contract = await Contract.findOne({ paymentReference: reference });
    if (!contract) {
      console.log("⚠️ Contract not found for reference:", reference);
      return res.redirect(`${FRONTEND_BASE_URL}/contract/failed?reason=contract_not_found`);
    }

    // 🔹 Check if contract currency supports Paystack
    if (contract.currency !== "NGN") {
      console.log(`⚠️ Payment verification blocked: ${contract.currency} is not supported by Paystack`);
      return res.redirect(
        `${FRONTEND_BASE_URL}/contract/failed?reason=invalid_currency&expected=NGN&found=${contract.currency}`
      );
    }

    // 🔹 Proceed to verify with Paystack API
    const verifyRes = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
    );

    const data = verifyRes.data?.data;
    if (!data || data.status !== "success") {
      console.log("⚠️ Payment verification failed:", data?.status);
      return res.redirect(`${FRONTEND_BASE_URL}/contract/failed?reason=payment_failed`);
    }

    // ✅ Update contract status to funded
    await Contract.findByIdAndUpdate(contract._id, { status: "funded" });

    console.log(`✅ Contract ${contract._id} funded successfully`);

    // ✅ Redirect user to success page
    return res.redirect(`${FRONTEND_BASE_URL}/success?id=${contract._id}`);
  } catch (err) {
    console.error("❌ Verify payment error:", err.message);
    return res.redirect(`${FRONTEND_BASE_URL}/contract/failed?reason=server_error`);
  }
};

// 🔹 Get single contract
exports.getContractById = async (req, res) => {
  try {
    const contract = await Contract.findById(req.params.id)
      .populate("buyer", "name email country");

    if (!contract)
      return res.status(404).json({ success: false, message: "Contract not found." });

    res.json({ success: true, data: contract });
  } catch (err) {
    console.error("❌ Get contract error:", err.message);
    res.status(500).json({ success: false, message: "Server error loading contract." });
  }
};

// 🔹 Seller accepts contract// 🔹 Seller accepts contract
exports.acceptContract = async (req, res) => {
  try {
    const { id } = req.params;
    const contract = await Contract.findById(id);
    if (!contract) return res.status(404).json({ success: false, message: "Contract not found." });

    const sellerEmail = req.user?.email || req.cookies?.userEmail || req.body?.email;
    if (!sellerEmail)
      return res.status(401).json({ success: false, message: "Unauthorized: Please log in." });

    if (contract.sellerEmail && contract.sellerEmail === sellerEmail) {
      return res.status(400).json({ success: false, message: "You already accepted this contract." });
    }

    if (contract.status === "accepted") {
      return res.status(400).json({ success: false, message: "Contract already accepted by another seller." });
    }

    // 🔹 Find the seller user
    const seller = await User.findOne({ email: sellerEmail });
    if (!seller) return res.status(404).json({ success: false, message: "Seller not found." });

    const firstName = seller.name.split(" ")[0];
    contract.sellername = firstName;
    contract.sellerEmail = sellerEmail;
    contract.status = "accepted";
    await contract.save();

    // ✅ Send “Seller Accepted” email to the buyer
    const buyer = await User.findOne({ email: contract.buyer });
    if (buyer && buyer.email) {
      const emailData = {
        buyerName: buyer.name?.split(" ")[0] || "User",
        sellerName: firstName,
        contractTitle: contract.title,
        amount: contract.amount,
      };

      await sendTemplateEmail("sellerAccepted", buyer.email, emailData);
      console.log(`📧 Seller accepted email sent to ${buyer.email}`);
    }

    res.json({
      success: true,
      message: "Contract accepted successfully.",
      redirectUrl: `${FRONTEND_BASE_URL}/accepted.html?id=${contract._id}`,
    });
  } catch (err) {
    console.error("❌ Accept contract error:", err.message);
    res.status(500).json({ success: false, message: "Server error accepting contract." });
  }
};

// 🔹 Get all contracts
exports.getAllContracts = async (req, res) => {
  try {
    const contracts = await Contract.find()
      .populate("buyer", "email name")
      .sort({ createdAt: -1 });
    res.json({ success: true, data: contracts });
  } catch (err) {
    console.error("Error fetching contracts:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// 🔹 Get all contracts by user email
exports.getContractsByEmail = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const contracts = await Contract.find({
      $or: [{ buyer: user._id }, { sellerEmail: email }],
    })
      .populate("buyer", "name email country")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: contracts });
  } catch (err) {
    console.error("Error fetching contracts:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// 🔹 Cancel (Delete) Contract// 🔹 Cancel (Delete) Contract with fee refund
exports.cancelContract = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the contract
    const contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({ success: false, message: "Contract not found." });
    }

    // Prevent deletion if already accepted
    if (contract.status === "accepted") {
      return res.status(400).json({
        success: false,
        message: "Contract has already been accepted by the seller and cannot be deleted.",
      });
    }

    // Refund buyer if funded
    if (contract.status === "funded") {
      const buyer = await User.findOne({ email: contract.buyer });
      if (buyer) {
        // Calculate fee
        let refundAmount = contract.amount;
        const fee = contract.amount * 0.06; // 6% fee
        if (contract.chargePayer === "buyer") refundAmount += fee;
        else if (contract.chargePayer === "split") refundAmount += fee / 2;

        // Refund
        buyer.wallet.balance += refundAmount;
        await buyer.save();

        // Record refund transaction

        console.log(`✅ Refunded ${refundAmount} ${contract.currency} to ${buyer.email}`);
      }
    }

    // Delete the contract
    await Contract.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Contract deleted successfully and refund processed if applicable.",
    });
  } catch (err) {
    console.error("❌ Delete contract error:", err.message);
    res.status(500).json({ success: false, message: "Server error deleting contract." });
  }
};


// 🔹 Seller requests payment release
exports.requestPayment = async (req, res) => {
  try {
    const id  = req.body.id;
   const ui = req.body.ui 
    console.log(id)
    // Find contract
    const contract = await Contract.findById(id);
    if (!contract) {
      return res.status(404).json({ success: false, message: "Contract not found." });
    }
    const user = await User.findById(ui)
    // Verify seller is the owner
    if (!contract.sellerEmail == user.email) {
      return res.status(403).json({ success: false, message: "You are not authorized to request payment for this contract." });
    }

    // Only funded or accepted contracts can request payment
    if (!["funded", "in_progress", "accepted"].includes(contract.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot request payment for contract with status "${contract.status}".`,
      });
    }

    

    // Notify buyer
    const buyer = await User.findOne({ email: contract.buyer });
    if (buyer && buyer.email) {
      const emailData = {
        buyerName: buyer.name?.split(" ")[0] || "User",
        sellerName: contract.sellername || "Seller",
        contractTitle: contract.title,
        amount: contract.amount,
       
      };

      await sendTemplateEmail("requestFunds", buyer.email, emailData);
      console.log(`📧 Payment request email sent to ${buyer.email}`);
    }

    res.json({
      success: true,
      message: "Payment request sent to the buyer successfully.",
      status: contract.status,
    });
  } catch (err) {
    console.error("❌ Request payment error:", err.message);
    res.status(500).json({ success: false, message: "Server error requesting payment." });
  }
};