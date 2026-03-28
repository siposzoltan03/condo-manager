import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { endpoint, p256dh, auth } = await request.json();

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: "Missing required fields: endpoint, p256dh, auth" },
        { status: 400 }
      );
    }

    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { p256dh, auth, userId: user.id },
      create: {
        userId: user.id,
        endpoint,
        p256dh,
        auth,
      },
    });

    return NextResponse.json({ id: subscription.id });
  } catch (error) {
    console.error("Push subscribe error:", error);
    return NextResponse.json(
      { error: "Failed to save subscription" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { endpoint } = await request.json();

    if (!endpoint) {
      return NextResponse.json(
        { error: "Missing required field: endpoint" },
        { status: 400 }
      );
    }

    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Push unsubscribe error:", error);
    return NextResponse.json(
      { error: "Failed to remove subscription" },
      { status: 500 }
    );
  }
}
