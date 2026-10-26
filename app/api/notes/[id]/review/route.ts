import { NextResponse, type NextRequest } from "next/server";
import type { NoteStatus } from "@/lib/supabase/types";
import { errorResponse, getActiveProfile, isSameOriginRequest } from "@/lib/http";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return errorResponse("Invalid request origin.", 403);
  if (!isSupabaseConfigured()) return errorResponse("Supabase is not configured.", 503);
  const session = await getActiveProfile();
  if (!session) return errorResponse("Authentication required.", 401);
  if (session.profile.role !== "developer") return errorResponse("Developer permission required.", 403);
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return errorResponse("Invalid note identifier.");

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return errorResponse("Invalid review decision.");
  const input = body as Record<string, unknown>;
  if (input.status !== "approved" && input.status !== "rejected") return errorResponse("Choose approve or reject.");
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (input.status === "rejected" && (reason.length < 1 || reason.length > 1000)) {
    return errorResponse("Enter a rejection reason of up to 1,000 characters.");
  }

  const { error } = await session.client.rpc("review_note", {
    p_note_id: id,
    p_status: input.status as NoteStatus,
    p_rejection_reason: input.status === "rejected" ? reason : null,
  });
  if (error) {
    console.error("Could not review note.", error);
    return errorResponse("The note could not be reviewed.", 502);
  }
  return NextResponse.json({ ok: true, status: input.status });
}
