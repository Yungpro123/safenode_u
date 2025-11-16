const TronWeb = require("tronweb");
const fs = require("fs");

// TRONGRID MAINNET
const tronWeb = new TronWeb({
  fullHost: "https://api.trongrid.io",
  headers: { "TRON-PRO-API-KEY": "" }, // optional key
  privateKey: "" // empty because we're creating a wallet, not signing
});

(async () => {
  try {
    const wallet = await tronWeb.createAccount();

    console.log("=== SAFE NODE MASTER WALLET CREATED ===");
    console.log("Address:", wallet.address.base58);
    console.log("Hex:", wallet.address.hex);
    console.log("Private Key:", wallet.privateKey);

    // Save backup file (optional)
    const backup = `
====== SAFE NODE MASTER WALLET ======
Address: ${wallet.address.base58}
Hex: ${wallet.address.hex}
Private Key: ${wallet.privateKey}
=====================================
`;

    fs.writeFileSync("master_wallet_backup.txt", backup);

    console.log("\nBackup saved: master_wallet_backup.txt");
    console.log("⚠️ KEEP YOUR PRIVATE KEY SAFE!");
  } catch (error) {
    console.error("Error creating wallet:", error);
  }
})();