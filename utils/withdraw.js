require('dotenv').config();
const { TronWeb } = require('tronweb');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

const TRON_FULL_HOST = process.env.TRON_FULL_HOST;

const MAIN_PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY;
const MAIN_ADDRESS = process.env.MAIN_WALLET_ADDRESS;
const USDT_CONTRACT = process.env.USDT_CONTRACT

// Fees & conversion
const WITHDRAW_FIXED_FEE_USDT = parseFloat(process.env.WITHDRAW_FIXED_FEE_USDT || '0.8');
const USDT_TO_NGN_RATE = parseFloat(process.env.USDT_TO_NGN_RATE || '1600');

const tronWeb = new TronWeb({
  fullHost: TRON_FULL_HOST,
  privateKey: MAIN_PRIVATE_KEY,
});

function isValidTronAddress(address) {
  try {
    return TronWeb.isAddress(address);
  } catch {
    return false;
  }
}

async function withdrawToUser(req, res) {
  try {
    const user = req.user; // injected by auth middleware
    const { amount, currency, walletAddress } = req.body;

    // Validate input
    if (!amount || !currency || !walletAddress) {
      return res.status(400).json({ status: false, message: 'Amount, currency, and wallet address are required' });
    }

    if (!isValidTronAddress(walletAddress)) {
      return res.status(400).json({ status: false, message: 'Invalid TRON address' });
    }

    if (!user.wallet || typeof user.wallet.balance !== 'number') {
      return res.status(400).json({ status: false, message: 'User wallet not found' });
    }

    // Determine withdrawal amount in USDT
    let withdrawAmount = parseFloat(amount) - 0.8;
    if (withdrawAmount <= 0) {
      return res.status(400).json({ status: false, message: 'Withdrawal amount after fee must be greater than zero' });
    }

    if (currency.toUpperCase() === 'NGN') {
      withdrawAmount = withdrawAmount / USDT_TO_NGN_RATE;
    }

    // Determine user balance in USDT
    const userBalanceInUSDT = (user.currency?.toUpperCase() === 'NGN')
      ? user.wallet.balance / USDT_TO_NGN_RATE
      : user.wallet.balance;

    if (withdrawAmount > userBalanceInUSDT) {
      return res.status(400).json({ status: false, message: 'Insufficient balance for this withdrawal' });
    }

    // Send USDT via Tron
    const contract = await tronWeb.contract().at(USDT_CONTRACT);
    const amountInSun = Math.floor(withdrawAmount * 1e6); // 6 decimals
    const tx = await contract.transfer(walletAddress, amountInSun).send({ feeLimit: 100_000_000 });
    let real_amount = parseFloat(amount)
    // Deduct from user balance
    const deductAmount = (user.currency?.toUpperCase() === 'NGN')
      ? real_amount * USDT_TO_NGN_RATE
      : real_amount;

    user.wallet.balance -= deductAmount;
    await user.save();

    // Log transaction
    await Transaction.create({
      userId: user._id,
      userEmail: user.email,
      type: 'withdraw',
      amount: real_amount.toFixed(6),
      currency: 'USDT',
      reference: tx?.transaction?.txID || JSON.stringify(tx),
      note: `Withdrawal to ${walletAddress}`,
    });

    return res.json({ status: true, message: 'Withdrawal successful', tx: tx?.transaction?.txID || tx });
  } catch (err) {
    console.error('Withdrawal error:', err);
    return res.status(500).json({ status: false, message: err.message });
  }
}

module.exports = withdrawToUser;