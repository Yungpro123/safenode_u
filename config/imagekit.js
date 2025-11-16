const ImageKit = require("imagekit");
const dotenv = require("dotenv");
dotenv.config();
const IMAGEKIT_URL = process.env.IMAGEKIT_URL_ENDPOINT 
const IMAGEKIT_PRIVATE_KEY = process.env.IMAGEKIT_PRIVATE_KEY ; // Replace
const IMAGEKIT_PUBLIC_KEY = process.env.IMAGEKIT_PUBLIC_KEY ;   // Replace

const imagekit = new ImageKit({
  publicKey: IMAGEKIT_PUBLIC_KEY,
  privateKey: IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: IMAGEKIT_URL,
});

module.exports = imagekit;