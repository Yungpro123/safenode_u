const fetch = require("node-fetch");
const dotenv = require("dotenv");
dotenv.config();
const IMAGEKIT_URL = process.env.IMAGEKIT_URL_ENDPOINT 
const IMAGEKIT_PRIVATE_KEY = process.env.IMAGEKIT_PRIVATE_KEY ; // Replace
const IMAGEKIT_PUBLIC_KEY = process.env.IMAGEKIT_PUBLIC_KEY ;   // Replace

exports.uploadBase64 = async (base64String, fileName = "upload.jpg") => {
  try {
    const res = await fetch(IMAGEKIT_URL, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(IMAGEKIT_PRIVATE_KEY + ":").toString("base64"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file: base64String,
        fileName,
        folder: "/safenode_disputes",
      }),
    });

    const data = await res.json();
    if (!data.url) throw new Error(data.message || "Upload failed");
    return data.url;
  } catch (err) {
    console.error("❌ ImageKit upload error:", err.message);
    return null;
  }
};