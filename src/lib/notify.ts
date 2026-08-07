import { prisma } from "./prisma";
import webpush from "web-push";

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:info@sportscontentplaybook.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export async function createNotification(title: string, message: string, type = "content") {
  const notification = await prisma.notification.create({
    data: { title, message, type },
  });

  // Send web push to all subscriptions
  const subs = await prisma.pushSubscription.findMany();
  const payload = JSON.stringify({ title, body: message, type });

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
      } catch (err: unknown) {
        // Remove expired/invalid subscriptions
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          await prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } });
        }
      }
    })
  );

  return notification;
}
