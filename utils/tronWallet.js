// tronWallet.js
const { TronWeb } = require('tronweb');
const crypto = require('crypto');
require('dotenv').config();

const TRON_FULL_HOST = process.env.TRON_FULL_HOST;

const SECRET = process.env.PRIVATE_KEY_SECRET;

if (!SECRET) {
  throw new Error('Missing environment variable PRIVATE_KEY_SECRET for encrypting private keys');
}

// derive 32-byte key
const SECRET_KEY = crypto.createHash('sha256').update(SECRET).digest();

const tronWeb = new TronWeb({ fullHost: TRON_FULL_HOST });

/**
 * Create a wallet and encrypt the private key
 */
async function createTronWallet() {
  const account = await tronWeb.createAccount();

  if (!account || !account.privateKey || !account.address?.base58) {
    throw new Error('Failed to create account');
  }

  // AES-256-CBC encryption
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', SECRET_KEY, iv);
  const encryptedBuffer = Buffer.concat([
    cipher.update(Buffer.from(account.privateKey, 'hex')),
    cipher.final()
  ]);

  return {
    address: account.address.base58,
    encryptedPrivateKey: encryptedBuffer.toString('hex'),
    iv: iv.toString('hex'),
  };
}

/**
 * Decrypts a wallet's private key
 */
function decryptTronPrivateKey(wallet) {
  if (!wallet?.encryptedPrivateKey || !wallet?.iv) {
    throw new Error('Invalid wallet object. Expect { encryptedPrivateKey, iv }');
  }

  try {
    const iv = Buffer.from(wallet.iv, 'hex');
    const encryptedBuffer = Buffer.from(wallet.encryptedPrivateKey, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-cbc', SECRET_KEY, iv);
    const decryptedBuffer = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);

    const privateKey = decryptedBuffer.toString('hex');

    // validate 64-char hex key
    if (!/^([A-Fa-f0-9]{64})$/.test(privateKey)) {
      throw new Error('Decrypted private key is invalid');
    }

    return privateKey;
  } catch (err) {
    console.error('Failed to decrypt private key:', err.message);
    return null;
  }
}

module.exports = { createTronWallet, decryptTronPrivateKey };