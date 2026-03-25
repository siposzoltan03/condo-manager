import webpush from "web-push";

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject =
  process.env.VAPID_SUBJECT ?? "mailto:admin@condo-manager.local";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export async function sendPush(
  subscription: PushSubscription,
  title: string,
  body: string
): Promise<void> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("VAPID keys not configured; skipping push notification.");
    return;
  }

  const payload = JSON.stringify({ title, body });

  await webpush.sendNotification(subscription, payload);

  console.log(`Push notification sent to ${subscription.endpoint}`);
}
