// scripts/getFees.js
const mongoose = require("mongoose");
const Transaction = require("./models/Transaction"); // adjust path if needed

// 🧠 Replace this with your actual database name or URI
const MONGO_URI = "mongodb+srv://Keta:h18jQGRxpEMNO41C@keta.1p6otqs.mongodb.net/escrowdb?retryWrites=true&w=majority&appName=Keta";

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to database");

    // Fetch all transactions that are fees
    const fees = await Transaction.find({ type: "fee" });

    if (fees.length === 0) {
      console.log("⚠️ No fee transactions found.");
      return;
    }

    let total = 0;
    console.log("📊 Fee Transactions:\n");

    fees.forEach((tx, index) => {
      console.log(
        `#${index + 1} | Email: ${tx.userEmail} | Amount: ₦${tx.amount} | Note: ${tx.note} | Date: ${tx.createdAt.toLocaleString()}`
      );
      total += tx.amount;
    });

    console.log("\n💰 Total Fees Collected: ₦" + total.toLocaleString());
  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    mongoose.connection.close();
  }
})();