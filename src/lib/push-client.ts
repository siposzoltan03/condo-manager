/**
 * Client-side push notification subscription helpers.
 * These functions run in the browser only.
 */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  // 1. Check browser support
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("Push notifications are not supported in this browser.");
    return null;
  }

  // 2. Get VAPID public key from server
  const vapidRes = await fetch("/api/push/vapid-key");
  if (!vapidRes.ok) {
    console.error("Failed to fetch VAPID public key");
    return null;
  }
  const { publicKey } = await vapidRes.json();

  // 3. Request notification permission
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.warn("Notification permission denied.");
    return null;
  }

  // 4. Subscribe via service worker push manager
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey).buffer as ArrayBuffer,
  });

  // 5. Send subscription to backend
  const keys = subscription.toJSON().keys!;
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    }),
  });

  if (!res.ok) {
    console.error("Failed to save push subscription on server");
    return null;
  }

  return subscription;
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (!subscription) return;

  // Unsubscribe from browser push manager
  await subscription.unsubscribe();

  // Remove from server
  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch {
    return false;
  }
}
