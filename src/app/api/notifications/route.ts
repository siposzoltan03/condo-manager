import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
} from "@/lib/notifications";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const page = searchParams.get("page")
      ? parseInt(searchParams.get("page")!, 10)
      : 1;
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!, 10)
      : 20;

    const result = await getNotifications(user.id, page, limit);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { notificationId, markAll } = body as {
      notificationId?: string;
      markAll?: boolean;
    };

    if (markAll) {
      await markAllAsRead(user.id);
      return NextResponse.json({ success: true });
    }

    if (notificationId) {
      await markAsRead(notificationId, user.id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Provide notificationId or markAll: true" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Failed to update notifications:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
