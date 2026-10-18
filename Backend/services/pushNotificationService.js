import PushToken from "../models/PushToken.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Validates Expo push token pattern (ExponentPushToken[...] or ExpoPushToken[...])
 */
const isExpoToken = (token) => {
  return typeof token === "string" && /^(ExponentPushToken|ExpoPushToken)\[.*\]$/.test(token.trim());
};

/**
 * Register or refresh a push token for a user.
 */
export const registerPushToken = async ({ userId, token, platform = "unknown" }) => {
  if (!userId || !token) return null;
  const cleanToken = token.trim();
  if (!isExpoToken(cleanToken)) return null;

  return PushToken.findOneAndUpdate(
    { userId, token: cleanToken },
    { $set: { platform, lastUsedAt: new Date() } },
    { upsert: true, returnDocument: "after" }
  );
};

/**
 * Unregister a push token when user logs out.
 */
export const unregisterPushToken = async ({ userId, token }) => {
  if (!userId || !token) return null;
  return PushToken.deleteOne({ userId, token: token.trim() });
};

/**
 * Send real-time push notification to a list of users.
 * @param {Array<string|ObjectId>} userIds - Recipient user IDs
 * @param {Object} message - { title, body, data, priority, sound }
 */
export const sendPushToUsers = async (userIds, { title, body, data = {}, sound = "default", priority = "high" }) => {
  if (!userIds || !userIds.length || !body) return { sent: 0 };

  const idList = Array.isArray(userIds) ? userIds : [userIds];

  const records = await PushToken.find({ userId: { $in: idList } }).lean();
  if (!records.length) return { sent: 0 };

  const validTokens = [...new Set(records.map((r) => r.token).filter(isExpoToken))];
  if (!validTokens.length) return { sent: 0 };

  // Prepare batch payloads (Expo limits to 100 per request)
  const messages = validTokens.map((token) => ({
    to: token,
    sound,
    title,
    body,
    data,
    priority,
  }));

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();

    // Check for invalid tokens and prune them
    if (result?.data && Array.isArray(result.data)) {
      const tokensToRemove = [];
      result.data.forEach((item, index) => {
        if (item.status === "error" && item.details?.error === "DeviceNotRegistered") {
          tokensToRemove.push(validTokens[index]);
        }
      });

      if (tokensToRemove.length) {
        await PushToken.deleteMany({ token: { $in: tokensToRemove } }).catch(() => {});
      }
    }

    return { sent: messages.length, result };
  } catch (err) {
    console.error("Push notification send error:", err.message);
    return { sent: 0, error: err.message };
  }
};
