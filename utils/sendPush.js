const webpush = require("web-push");
const Subscription = require("../models/Subscription");

webpush.setVapidDetails(
  "mailto:support@safenode.com",
  process.env.VAPID_PUBLIC,
  process.env.VAPID_PRIVATE
);

async function sendDisputePush(contractId) {
  const subs = await Subscription.find();

  const payload = JSON.stringify({
    title: "New Dispute Message",
    body: "A new message was posted to your dispute.",
    url: `https://your-domain/disputes/${contractId}`
  });

  subs.forEach(sub => {
    webpush.sendNotification(sub, payload).catch(() => {});
  });
}

module.exports = sendDisputePush;