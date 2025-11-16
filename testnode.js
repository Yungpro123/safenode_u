// processUsersSafe.js
const os = require("os");
const { TronWeb } = require("tronweb");
const pLimit = require("p-limit").default;
const { decryptTronPrivateKey } = require("./utils/tronWallet");
const User = require("./models/User");
const Transaction = require("./models/Transaction");
const TRON_FULL_HOST = process.env.TRON_FULL_HOST;

const USDT_CONTRACT = process.env.USDT_CONTRACT
const MAIN_PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY;
const MAIN_ADDRESS = process.env.MAIN_WALLET_ADDRESS;
const MIN_TRX_GAS = parseFloat(process.env.MIN_TRX_GAS || "10"); // minimum TRX for gas
const SWEEP_TRX = process.env.SWEEP_TRX === "true";

if (!MAIN_PRIVATE_KEY || !MAIN_ADDRESS) throw new Error("Missing MAIN_WALLET_PRIVATE_KEY or MAIN_WALLET_ADDRESS");

const mainTronWeb = new TronWeb({ fullHost: TRON_FULL_HOST, privateKey: MAIN_PRIVATE_KEY });
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

/** Retry helper with exponential backoff */
async function retry(fn, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i < retries - 1) await sleep(delay * (i + 1));
      else throw err;
    }
  }
}

async function getTrxBalance(address) {
  const sun = await retry(() => mainTronWeb.trx.getBalance(address));
  return mainTronWeb.fromSun(sun); // convert sun → TRX
}

async function getUsdtBalance(address) {
  const contract = await retry(() => mainTronWeb.contract().at(USDT_CONTRACT));
  const raw = await retry(() => contract.methods.balanceOf(address).call({ from: address }));
  return mainTronWeb.toDecimal(raw) / 1e6; // USDT has 6 decimals
}

async function fundUserWithTrx(to, amountTrx) {
  return await retry(() => mainTronWeb.trx.sendTransaction(to, mainTronWeb.toSun(amountTrx)));
}

async function sweepUserUsdt(privateKey, amountUsdt) {
  const tronWeb = new TronWeb({ fullHost: TRON_FULL_HOST, privateKey });
  const contract = await tronWeb.contract().at(USDT_CONTRACT);
  return await retry(() =>
    contract.transfer(MAIN_ADDRESS, Math.floor(amountUsdt * 1e6)).send({ feeLimit: 100_000_000 })
  );
}

async function sweepUserTrx(privateKey, amountTrx) {
  const tronWeb = new TronWeb({ fullHost: TRON_FULL_HOST, privateKey });
  return await retry(() => tronWeb.trx.sendTransaction(MAIN_ADDRESS, tronWeb.toSun(amountTrx)));
}

/** Dynamically set concurrency based on free memory */
function estimateConcurrency() {
  const freeMemMB = os.freemem() / 1024 / 1024;
  const maxConcurrent = Math.floor(freeMemMB / 50);
  return Math.max(1, Math.min(maxConcurrent, 2)); // capped at 2
}

async function processUsers() {
  try {
    if (require("mongoose").connection.readyState !== 1) {
      console.warn("❌ MongoDB not connected. Aborting.");
      return;
    }

    const users = await User.find({});
    if (!users.length) return;

    const concurrency = estimateConcurrency();
    const limit = pLimit(concurrency);

    console.log(`🚀 Processing ${users.length} users with concurrency: ${concurrency}`);

    let processed = 0,
        sweptUSDT = 0;

    for (let i = 0; i < users.length; i++) {
      const user = users[i];

      await limit(async () => {
        try {
          const { wallet } = user;
          if (!wallet?.encryptedPrivateKey || !wallet?.address || !wallet?.iv) return;

          const address = wallet.address;
          const privateKey = decryptTronPrivateKey(wallet);
          let trxBalance = await getTrxBalance(address);
          let usdtBalance = await getUsdtBalance(address);

          // Only fund TRX if USDT exists and TRX < MIN_TRX_GAS
          if (usdtBalance > 0 && trxBalance < MIN_TRX_GAS) {
            const topUp = parseFloat((MIN_TRX_GAS - trxBalance).toFixed(6));
            console.log(`⛽ Funding ${user.email} with ${topUp} TRX...`);
            await fundUserWithTrx(address, topUp);
            await sleep(3000); // wait for blockchain confirmation
            trxBalance = await getTrxBalance(address);
          } else if (usdtBalance > 0) {
            console.log(`✅ ${user.email} has sufficient TRX (${trxBalance} TRX). Skipping funding.`);
          }

          // Sweep USDT if TRX >= MIN_TRX_GAS
          if (usdtBalance > 0 && trxBalance >= MIN_TRX_GAS) {
            await sweepUserUsdt(privateKey, usdtBalance);

            const USDT_TO_NGN_RATE = parseFloat(process.env.USDT_TO_NGN_RATE || "1600");
            const TRX_TO_USDT_RATE = parseFloat(process.env.TRX_TO_USDT_RATE || "0.1");
            const GAS_FEE_TRX = parseFloat(process.env.GAS_FEE_TRX || "1");

            const gasFeeInUSDT = GAS_FEE_TRX * TRX_TO_USDT_RATE;
            let netUSDT = Math.max(usdtBalance - gasFeeInUSDT, 0);
            let creditAmount = user.currency?.toUpperCase() === "NGN" ? netUSDT * USDT_TO_NGN_RATE : netUSDT;

            // Proper rounding
            creditAmount = user.currency?.toUpperCase() === "NGN"
              ? parseFloat(creditAmount.toFixed(2))
              : parseFloat(creditAmount.toFixed(6));
            user.wallet.balance = (user.wallet.balance || 0) + creditAmount ;
            await user.save();

            await Transaction.create({
              userId: user._id,
              userEmail: user.email,
              type: "deposit",
              amount: creditAmount.toString(),
              currency: user.currency?.toUpperCase() || "USDT",
              note: "Auto credit after sweep",
            });

            sweptUSDT += netUSDT;
            console.log(`✅ Swept ${netUSDT} USDT from ${user.email}`);
          } else if (usdtBalance > 0) {
            console.log(`⚠️ Not enough TRX to sweep USDT for ${user.email} (${trxBalance} TRX)`);
          }

          // Sweep TRX if enabled and user has excess
          if (SWEEP_TRX && trxBalance > MIN_TRX_GAS + 1) {
            const sweepAmount = trxBalance - MIN_TRX_GAS;
            await sweepUserTrx(privateKey, sweepAmount);
            console.log(`💸 Swept ${sweepAmount} TRX from ${user.email}`);
          }

          processed++;
        } catch (err) {
          console.error(`❌ Failed ${user.email}: ${err.message}`);
        }

        // Pause every 20 users to reduce rate-limit issues
        if ((i + 1) % 20 === 0) await sleep(3000);
      });
    }

    console.log(`\n✅ Batch finished at ${new Date().toLocaleTimeString()}`);
    console.log(`🔹 Users processed: ${processed}`);
    console.log(`🔹 Total USDT swept: ${sweptUSDT.toFixed(2)}`);
  } catch (err) {
    console.error("❌ Global error:", err.message);
  }
}

module.exports = { processUsers };