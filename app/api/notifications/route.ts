import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, getActiveProfile, isSameOriginRequest } from "@/lib/http";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  if (!isSupabaseConfigured()) return errorResponse("Supabase is not configured.", 503);
  const session = await getActiveProfile();
  if (!session) return errorResponse("Authentication required.", 401);

  const [events, reads] = await Promise.all([
    session.client.from("notification_events")
      .select("id,event_type,title,message,created_at")
      .order("created_at", { ascending: false }),
    session.client.from("user_notification_reads")
      .select("notification_id")
      .eq("user_id", session.profile.id),
  ]);
  const error = events.error ?? reads.error;
  if (error) {
    console.error("Could not load account notifications.", error);
    return errorResponse("Notifications are temporarily unavailable.", 502);
  }
  const readIds = new Set((reads.data ?? []).map((read) => read.notification_id));
  const items = (events.data ?? []).map((event) => ({ ...event, isRead: readIds.has(event.id) }));
  return NextResponse.json({ items, unreadCount: items.filter((item) => !item.isRead).length });
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return errorResponse("Invalid request origin.", 403);
  if (!isSupabaseConfigured()) return errorResponse("Supabase is not configured.", 503);
  const session = await getActiveProfile();
  if (!session) return errorResponse("Authentication required.", 401);

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return errorResponse("Provide a notification to mark as read.");
  const input = body as Record<string, unknown>;
  if (Object.keys(input).length === 1 && input.all === true) {
    const { data, error } = await session.client.rpc("mark_notification_read", { p_notification_id: null });
    if (error) {
      console.error("Could not mark notifications as read.", error);
      return errorResponse("Notifications could not be marked as read.", 502);
    }
    return NextResponse.json({ ok: true, markedCount: data });
  }
  if (Object.keys(input).length !== 1 || typeof input.notificationId !== "string" || !uuidPattern.test(input.notificationId)) {
    return errorResponse("Provide one valid notification identifier or mark all as read.");
  }

  const { data, error } = await session.client.rpc("mark_notification_read", {
    p_notification_id: input.notificationId,
  });
  if (error) {
    if (error.code === "P0002") return errorResponse("Notification not found.", 404);
    console.error("Could not mark notification as read.", error);
    return errorResponse("Notification could not be marked as read.", 502);
  }
  return NextResponse.json({ ok: true, markedCount: data });
}
