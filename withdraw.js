// scripts/generateSafeNodeWallet.js
require("dotenv").config();
const {TronWeb} = require("tronweb");

async function main() {
  try {
    const tronWeb = new TronWeb({
      fullHost: "https://api.trongrid.io",
    });

    const wallet = await tronWeb.createAccount();

    console.log("🎯 SafeNode Wallet Generated!");
    console.log("Address (to receive funds):", wallet.address.base58);
    console.log("Private Key (keep secret!):", wallet.privateKey);
    console.log("\n➡️  Add these to your .env file:");
    console.log(`SAFENODE_ADDRESS=${wallet.address.base58}`);
    console.log(`SAFENODE_PRIVATE_KEY=${wallet.privateKey}`);
  } catch (err) {
    console.error("❌ Error generating wallet:", err);
  }
}

main();