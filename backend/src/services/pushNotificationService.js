const env = require("../config/env");
const User = require("../models/User");
const { logSecurityEvent } = require("./securityEventLogger");

let webPush = null;
let vapidConfigured = false;

const isPushConfigured = () =>
  Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_EMAIL);

const getWebPush = () => {
  if (!isPushConfigured()) {
    return null;
  }

  if (!webPush) {
    webPush = require("web-push");
    webPush.setVapidDetails(
      `mailto:${env.VAPID_EMAIL}`,
      env.VAPID_PUBLIC_KEY,
      env.VAPID_PRIVATE_KEY
    );
    vapidConfigured = true;
  }

  return vapidConfigured ? webPush : null;
};

const normalizeSubscription = (subscription) => ({
  endpoint: subscription.endpoint,
  keys: {
    auth: subscription.keys.auth,
    p256dh: subscription.keys.p256dh,
  },
  createdAt: new Date(),
});

const registerSubscription = async (userId, subscription) => {
  const user = await User.findById(userId).select("pushSubscriptions");

  if (!user) {
    return null;
  }

  const normalized = normalizeSubscription(subscription);
  const existingSubscriptions = user.pushSubscriptions.filter(
    (currentSubscription) => currentSubscription.endpoint !== normalized.endpoint
  );

  user.pushSubscriptions = [normalized, ...existingSubscriptions].slice(0, 5);
  await user.save({ validateBeforeSave: false });
  return normalized;
};

const unregisterSubscription = async (userId, endpoint) => {
  await User.findByIdAndUpdate(userId, {
    $pull: {
      pushSubscriptions: { endpoint },
    },
  });
};

const removeExpiredSubscription = async (userId, endpoint) => {
  await unregisterSubscription(userId, endpoint);
};

const sendToUser = async (userId, payload) => {
  const service = getWebPush();

  if (!service) {
    return {
      attempted: 0,
      sent: 0,
    };
  }

  const user = await User.findById(userId).select("pushSubscriptions").lean();
  const subscriptions = user?.pushSubscriptions || [];

  if (!subscriptions.length) {
    return {
      attempted: 0,
      sent: 0,
    };
  }

  const results = await Promise.allSettled(
    subscriptions.map((subscription) =>
      service.sendNotification(subscription, JSON.stringify(payload))
    )
  );

  await Promise.allSettled(
    results.map((result, index) => {
      const statusCode = result.reason?.statusCode;

      if (result.status === "rejected" && [404, 410].includes(statusCode)) {
        return removeExpiredSubscription(userId, subscriptions[index].endpoint);
      }

      if (result.status === "rejected") {
        logSecurityEvent({
          severity: "warning",
          type: "push_notification_delivery_failed",
          userId: userId.toString(),
          details: {
            statusCode,
          },
        });
      }

      return Promise.resolve();
    })
  );

  return {
    attempted: subscriptions.length,
    sent: results.filter((result) => result.status === "fulfilled").length,
  };
};

module.exports = {
  registerSubscription,
  sendToUser,
  unregisterSubscription,
};
