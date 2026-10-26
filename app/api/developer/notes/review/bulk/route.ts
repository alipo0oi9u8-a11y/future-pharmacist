import { NextResponse, type NextRequest } from "next/server";
import type { NoteStatus } from "@/lib/supabase/types";
import { errorResponse, getActiveProfile, isSameOriginRequest } from "@/lib/http";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return errorResponse("Invalid request origin.", 403);
  if (!isSupabaseConfigured()) return errorResponse("Supabase is not configured.", 503);
  const session = await getActiveProfile();
  if (!session) return errorResponse("Authentication required.", 401);
  if (session.profile.role !== "developer") return errorResponse("Developer permission required.", 403);

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return errorResponse("Provide a bulk review decision.");
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some((key) => !["noteIds", "status", "reason"].includes(key))) {
    return errorResponse("Unsupported bulk review fields.");
  }
  const noteIds = Array.isArray(input.noteIds)
    ? input.noteIds.filter((id): id is string => typeof id === "string" && uuidPattern.test(id))
    : [];
  if (noteIds.length < 1 || noteIds.length > 50
    || !Array.isArray(input.noteIds) || noteIds.length !== input.noteIds.length
    || new Set(noteIds).size !== noteIds.length) {
    return errorResponse("Select between 1 and 50 unique valid notes.");
  }
  if (input.status !== "approved" && input.status !== "rejected") return errorResponse("Choose approve or reject.");
  const status: NoteStatus = input.status;
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (input.status === "rejected" && (!reason || reason.length > 1000)) {
    return errorResponse("Enter a rejection reason of up to 1,000 characters.");
  }
  if (input.status === "approved" && input.reason !== undefined) return errorResponse("Approval decisions do not accept a rejection reason.");

  const { data, error } = await session.client.rpc("review_notes_bulk", {
    p_note_ids: noteIds,
    p_status: status,
    p_rejection_reason: status === "rejected" ? reason : null,
  });
  if (error) {
    if (error.code === "P0002") return errorResponse("One or more selected notes are no longer pending.", 409);
    if (error.code === "42501") return errorResponse("Developer permission required.", 403);
    if (error.code === "22023") return errorResponse(error.message);
    console.error("Could not complete bulk note review.", error);
    return errorResponse("The bulk review could not be completed.", 502);
  }
  return NextResponse.json({ reviewedCount: data, status });
}
