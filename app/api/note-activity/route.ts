import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, getActiveProfile, isSameOriginRequest } from "@/lib/http";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  if (!isSupabaseConfigured()) return errorResponse("Supabase is not configured.", 503);
  const session = await getActiveProfile();
  if (!session) return errorResponse("Authentication required.", 401);
  const [bookmarks, reactions, reports] = await Promise.all([
    session.client.from("bookmarks").select("note_id").eq("user_id", session.profile.id),
    session.client.from("note_reactions").select("note_id").eq("user_id", session.profile.id).eq("helpful", true),
    session.client.from("note_reports").select("note_id").eq("user_id", session.profile.id),
  ]);
  const error = bookmarks.error ?? reactions.error ?? reports.error;
  if (error) {
    console.error("Could not load note activity.", error);
    return errorResponse("Your note activity is temporarily unavailable.", 502);
  }
  return NextResponse.json({
    bookmarks: (bookmarks.data ?? []).map((item) => item.note_id),
    helpful: (reactions.data ?? []).map((item) => item.note_id),
    reported: (reports.data ?? []).map((item) => item.note_id),
  });
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return errorResponse("Invalid request origin.", 403);
  if (!isSupabaseConfigured()) return errorResponse("Supabase is not configured.", 503);
  const session = await getActiveProfile();
  if (!session) return errorResponse("Authentication required.", 401);
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return errorResponse("Invalid note activity.");
  const input = body as Record<string, unknown>;
  const noteId = typeof input.noteId === "string" ? input.noteId : "";
  const action = input.action;
  const enabled = input.enabled === true;
  if (!uuidPattern.test(noteId)) return errorResponse("Invalid note identifier.");

  if (action === "bookmark") {
    const result = enabled
      ? await session.client.from("bookmarks").upsert({ user_id: session.profile.id, note_id: noteId }, { onConflict: "user_id,note_id" })
      : await session.client.from("bookmarks").delete().eq("user_id", session.profile.id).eq("note_id", noteId);
    if (result.error) {
      console.error("Could not update note bookmark.", result.error);
      return errorResponse("The bookmark could not be updated.", 502);
    }
  } else if (action === "helpful") {
    if (enabled) {
      const { error } = await session.client.from("note_reactions").upsert(
        { user_id: session.profile.id, note_id: noteId, helpful: true },
        { onConflict: "user_id,note_id" },
      );
      if (error) {
        console.error("Could not record note reaction.", error);
        return errorResponse("The reaction could not be recorded.", 502);
      }
    }
  } else if (action === "report") {
    const { error } = await session.client.from("note_reports").insert({
      user_id: session.profile.id,
      note_id: noteId,
      reason: "Possible broken Google Docs link reported by a reader.",
    });
    if (error) {
      if (error.code === "23505") return errorResponse("You have already reported this note.", 409);
      console.error("Could not report note link.", error);
      return errorResponse("The broken-link report could not be saved.", 502);
    }
  } else {
    return errorResponse("Choose a supported note activity.");
  }
  return NextResponse.json({ ok: true });
}
