require('dotenv').config();
const { TronWeb } = require('tronweb');

// Config
const TRON_FULL_HOST = process.env.TRON_FULL_HOST || 'https://api.trongrid.io';
const USDT_CONTRACT = process.env.USDT_CONTRACT || 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf';

// Sender wallet
const SENDER_PRIVATE_KEY = process.env.MASTER_WALLET_PRIVATE_KEY;
const SENDER_ADDRESS = process.env.MAIN_WALLET_ADDRESS; // Optional, derived from private key

// Recipient wallet
const RECEIVER_ADDRESS = 'TKf35SckPPwv96UXZBWWVfLfLNtzhFkEvJ';
const AMOUNT_USDT = parseFloat(process.env.AMOUNT_USDT || '10'); // 10 USDT

// Initialize TronWeb
const tronWeb = new TronWeb({
  fullHost: TRON_FULL_HOST,
  privateKey: SENDER_PRIVATE_KEY,
});

async function sendUSDT() {
  try {
    // Get USDT contract
    const contract = await tronWeb.contract().at(USDT_CONTRACT);

    // Convert amount to USDT "sun" (6 decimals)
    const amountInSun = Math.floor(AMOUNT_USDT * 1e6);

    // Send USDT
    const tx = await contract.transfer(RECEIVER_ADDRESS, amountInSun).send({
      feeLimit: 100_000_000, // 100 TRX max fee limit
    });

    console.log('✅ USDT Sent!');
    console.log(`To: ${RECEIVER_ADDRESS}`);
    console.log(`Amount: ${AMOUNT_USDT} USDT`);
    console.log(`TX Hash: ${tx}`);
  } catch (err) {
    console.error('❌ Error sending USDT:', err.message);
  }
}

// Run script
sendUSDT();