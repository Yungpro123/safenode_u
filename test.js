require("dotenv").config();
const Brevo = require("@getbrevo/brevo");

const brevoApi = new Brevo.TransactionalEmailsApi();
brevoApi.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

async function test() {
  try {
    await brevoApi.sendTransacEmail({
      sender: { email: process.env.BREVO_SENDER_EMAIL, name: "SafeNode" },
      to: [{ email: 'ciprusrime82@gmail.com' }],
      subject: "Test Brevo Email",
      htmlContent: "<h1>Hello from Brevo!</h1>",
    });
    console.log("✅ Email sent!");
  } catch (err) {
    console.error("❌ Brevo Email Error:", err.response?.body || err.message);
  }
}

test();