import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  getNotifications,
  getContractorNotifications,
  markAsRead,
  markContractorAsRead,
  markAllAsRead,
  markAllContractorAsRead,
} from "@/lib/notifications";

/**
 * The notifications API is shared between the condo and contractor
 * auth trees. We dispatch by `session.user.kind` so a single bell
 * component on either side hits the same endpoint and the server
 * routes the read/write through the matching FK column.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
    const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const limit = isNaN(rawLimit) ? 20 : Math.min(Math.max(rawLimit, 1), 100);

    const result =
      user.kind === "contractor"
        ? await getContractorNotifications(user.id, page, limit)
        : await getNotifications(user.id, page, limit);

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
    const isContractor = user.kind === "contractor";

    if (markAll) {
      if (isContractor) {
        await markAllContractorAsRead(user.id);
      } else {
        await markAllAsRead(user.id);
      }
      return NextResponse.json({ success: true });
    }

    if (notificationId) {
      if (isContractor) {
        await markContractorAsRead(notificationId, user.id);
      } else {
        await markAsRead(notificationId, user.id);
      }
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
