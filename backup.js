// testnode.js
const os = require("os");
const { TronWeb } = require("tronweb");
const pLimit = require("p-limit").default;
const { decryptTronPrivateKey } = require("./utils/tronWallet");
const User = require("./models/User");
const Transaction = require("./models/Transaction");

const USDT_CONTRACT = process.env.USDT_CONTRACT || "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf";
const TRON_FULL_HOST = process.env.TRON_FULL_HOST || "https://api.nileex.io";
const MAIN_PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY;
const MAIN_ADDRESS = process.env.MAIN_WALLET_ADDRESS;
const MIN_TRX_GAS = parseFloat(process.env.MIN_TRX_GAS || "10"); // TRX
const SWEEP_TRX = process.env.SWEEP_TRX === "true";

if (!MAIN_PRIVATE_KEY || !MAIN_ADDRESS) {
  throw new Error("Missing MAIN_WALLET_PRIVATE_KEY or MAIN_WALLET_ADDRESS in .env");
}

const mainTronWeb = new TronWeb({ fullHost: TRON_FULL_HOST, privateKey: MAIN_PRIVATE_KEY });
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function getTrxBalance(address) {
  const sun = await mainTronWeb.trx.getBalance(address);
  return mainTronWeb.fromSun(sun);
}

async function getUsdtBalance(address) {
  const contract = await mainTronWeb.contract().at(USDT_CONTRACT);
  const raw = await contract.methods.balanceOf(address).call({ from: address });
  return mainTronWeb.toDecimal(raw) / 1e6;
}

async function fundUserWithTrx(to, amountTrx) {
  const tx = await mainTronWeb.trx.sendTransaction(to, mainTronWeb.toSun(amountTrx));
  return tx;
}

async function sweepUserUsdt(privateKey, amountUsdt) {
  const tronWeb = new TronWeb({ fullHost: TRON_FULL_HOST, privateKey });
  const contract = await tronWeb.contract().at(USDT_CONTRACT);
  const tx = await contract.transfer(MAIN_ADDRESS, Math.floor(amountUsdt * 1e6)).send({ feeLimit: 100_000_000 });
  return tx;
}

async function sweepUserTrx(privateKey, amountTrx) {
  const tronWeb = new TronWeb({ fullHost: TRON_FULL_HOST, privateKey });
  return await tronWeb.trx.sendTransaction(MAIN_ADDRESS, tronWeb.toSun(amountTrx));
}

function estimateConcurrency() {
  const freeMemMB = os.freemem() / 1024 / 1024;
  const maxConcurrent = Math.floor(freeMemMB / 50);
  return Math.max(1, Math.min(maxConcurrent, 5));
}

async function processUsers() {
  try {
    if (require("mongoose").connection.readyState !== 1) {
      console.warn("❌ MongoDB not connected yet. Aborting processUsers.");
      return;
    }

    const users = await User.find({});
    if (!users.length) return;

    const concurrency = estimateConcurrency();
    const limit = pLimit(concurrency);

    console.log(`🚀 Processing ${users.length} users with concurrency: ${concurrency}`);

    let processed = 0,
      sweptUSDT = 0;

    const tasks = users.map((user) =>
      limit(async () => {
        const { wallet } = user;
        if (!wallet?.encryptedPrivateKey || !wallet?.address || !wallet?.iv) return;

        const address = wallet.address;
        try {
          const privateKey = decryptTronPrivateKey(wallet);
          const trxBalance = await getTrxBalance(address);
          const usdtBalance = await getUsdtBalance(address);

          // ✅ Check TRX funding needs more carefully
          if (usdtBalance > 0) {
            let currentTrx = trxBalance;
            const tolerance = 0.05;

            if (currentTrx + tolerance < MIN_TRX_GAS) {
              const topUp = parseFloat((MIN_TRX_GAS - currentTrx).toFixed(6));
              console.log(`⛽ Funding ${user.email} with ${topUp} TRX for gas (balance: ${currentTrx})...`);

              try {
                await fundUserWithTrx(address, topUp);
                await sleep(3000); // wait for TX confirmation

                currentTrx = await getTrxBalance(address);
                if (currentTrx + tolerance < MIN_TRX_GAS) {
                  console.warn(`⚠️ ${user.email} still low on TRX after funding (balance: ${currentTrx})`);
                  return;
                }
              } catch (err) {
                console.error(`❌ TRX funding failed for ${user.email}: ${err.message}`);
                return;
              }
            } else {
              console.log(`✅ ${user.email} already has enough TRX: ${currentTrx}`);
            }

            // ✅ Sweep USDT to main wallet
            await sweepUserUsdt(privateKey, usdtBalance);

            const USDT_TO_NGN_RATE = parseFloat(process.env.USDT_TO_NGN_RATE || "1600");
            const TRX_TO_USDT_RATE = parseFloat(process.env.TRX_TO_USDT_RATE || "0.1");
            const GAS_FEE_TRX = parseFloat(process.env.GAS_FEE_TRX || "1");

            const gasFeeInUSDT = GAS_FEE_TRX * TRX_TO_USDT_RATE;
            let netUSDT = usdtBalance - gasFeeInUSDT;
            if (netUSDT < 0) netUSDT = 0;

            let creditAmount = netUSDT;
            if (user.currency?.toUpperCase() === "NGN") {
              creditAmount = netUSDT * USDT_TO_NGN_RATE;
            }

            user.wallet.balance = (user.wallet.balance || 0) + creditAmount;
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
          }

          // ✅ Sweep excess TRX if enabled
          if (SWEEP_TRX && trxBalance > MIN_TRX_GAS + 1) {
            const sweepAmount = trxBalance - MIN_TRX_GAS;
            await sweepUserTrx(privateKey, sweepAmount);
          }

          processed++;
        } catch (err) {
          console.error(`❌ Failed ${user.email}:`, err.message);
        }
      })
    );

    await Promise.all(tasks);

    console.log(`\n✅ Batch finished at ${new Date().toLocaleTimeString()}`);
    console.log(`🔹 Users processed: ${processed}`);
    console.log(`🔹 Total USDT swept: ${sweptUSDT.toFixed(2)}`);
    console.log(`💾 RAM Usage: ${(
      ((os.totalmem() - os.freemem()) / os.totalmem()) *
      100
    ).toFixed(1)}%`);
  } catch (err) {
    console.error("❌ Global error:", err.message);
  }
}

module.exports = { processUsers };