// sweepTron.js
const { TronWeb } = require("tronweb");
const { decryptTronPrivateKey } = require("./tronWallet");

const MASTER_WALLET_ADDRESS = process.env.MASTER_WALLET_ADDRESS;
const MASTER_WALLET_PRIVATE_KEY = process.env.MASTER_WALLET_PRIVATE_KEY;
const TRON_FULL_HOST = process.env.TRON_FULL_HOST;

// Master wallet TronWeb instance
const masterTronWeb = new TronWeb({
  fullHost: TRON_FULL_HOST,
  privateKey: MASTER_WALLET_PRIVATE_KEY,
});

// USDT contract on Shasta
const USDT_CONTRACT_ADDRESS = process.env.USDT_CONTRACT;

// Fee for transaction in SUN
const FEE_SUN = 1000000; // 1 TRX = 1e6 SUN
const FUND_AMOUNT_SUN = 3 * 1e6; // Max fund 3 TRX if wallet needs fees

/**
 * Sweep user wallet (TRX and optional USDT)
 * @param {Object} userWallet { encryptedPrivateKey, iv, address }
 */
async function sweepUserWallet(userWallet) {
  try {
    const privateKey = decryptTronPrivateKey(userWallet);

    const userTronWeb = new TronWeb({
      fullHost: TRON_FULL_HOST,
      privateKey,
    });

    // --- 1️⃣ Ensure enough TRX for fee ---
    let balance = await userTronWeb.trx.getBalance(userWallet.address);
    if (balance < FEE_SUN) {
      // Only fund the missing amount, max 3 TRX
      const required = FEE_SUN - balance;
      const fundAmount = required > FUND_AMOUNT_SUN ? FUND_AMOUNT_SUN : required;

      await masterTronWeb.trx.sendTransaction(userWallet.address, fundAmount);
      console.log(`Funded ${fundAmount / 1e6} TRX to ${userWallet.address} for transaction fees`);

      balance = await userTronWeb.trx.getBalance(userWallet.address);
    }

    // --- 2️⃣ Sweep all TRX except the fee ---
    if (balance > FEE_SUN) {
      const tx = await userTronWeb.trx.sendTransaction(
        MASTER_WALLET_ADDRESS,
        balance - FEE_SUN,
        privateKey
      );
      console.log(`Swept ${(balance - FEE_SUN) / 1e6} TRX from ${userWallet.address} to master wallet`, tx);
    } else {
      console.log(`Not enough TRX in ${userWallet.address} to sweep after funding`);
    }

    // --- 3️⃣ Sweep USDT ---
    const contract = await userTronWeb.contract().at(USDT_CONTRACT_ADDRESS);
    const usdtBalance = parseInt(await contract.methods.balanceOf(userWallet.address).call());
    if (usdtBalance > 0) {
      const tx = await contract.methods
        .transfer(MASTER_WALLET_ADDRESS, usdtBalance)
        .send({ feeLimit: 100_000_000 });
      console.log(`Swept ${usdtBalance / 1e6} USDT from ${userWallet.address} to master wallet`, tx);
    } else {
      console.log("No USDT to sweep for", userWallet.address);
    }

  } catch (err) {
    console.error("Sweep failed:", err);
    throw err;
  }
}

module.exports = { sweepUserWallet };