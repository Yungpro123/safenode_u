// checkBalance.js
const {TronWeb} = require('tronweb');

const ADDRESS = 'TUNji643Pw6c1YubFZPyAgARdU1FCsa97E'; // 👈 replace with your test address
const USDT_CONTRACT = 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf'; // Nile Testnet USDT
const TRON_FULL_HOST = 'https://api.nileex.io';

// We initialize tronWeb with the address set as "from"
const tronWeb = new TronWeb({
  fullHost: TRON_FULL_HOST,
});

// Optional: set the default address (required for contract calls)
tronWeb.setAddress(ADDRESS);

(async () => {
  try {
    // 🔹 1. Check TRX balance
    const trxBalanceSun = await tronWeb.trx.getBalance(ADDRESS);
    const trxBalance = tronWeb.fromSun(trxBalanceSun);

    // 🔹 2. Check USDT balance (TRC20)
    const contract = await tronWeb.contract().at(USDT_CONTRACT);
    const rawBalance = await contract.methods.balanceOf(ADDRESS).call({ from: ADDRESS });
    const usdtBalance = tronWeb.toDecimal(rawBalance) / 1e6; // 6 decimals

    console.log(`🔹 Address: ${ADDRESS}`);
    console.log(`💰 TRX Balance: ${trxBalance} TRX`);
    console.log(`💵 USDT Balance: ${usdtBalance} USDT`);
  } catch (err) {
    console.error('❌ Error checking balance:', err);
  }
})();