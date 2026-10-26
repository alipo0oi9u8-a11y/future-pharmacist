import { NextResponse, type NextRequest } from "next/server";
import type { AppRole } from "@/lib/supabase/types";
import { errorResponse, getActiveProfile, isSameOriginRequest } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return errorResponse("Invalid request origin.", 403);
  if (!isSupabaseConfigured()) return errorResponse("Supabase is not configured.", 503);
  const caller = await getActiveProfile();
  if (!caller) return errorResponse("Authentication required.", 401);
  if (caller.profile.role !== "developer") return errorResponse("Developer permission required.", 403);
  const { id } = await context.params;
  if (!uuidPattern.test(id) || id === caller.profile.id) return errorResponse("Invalid member identifier.");

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return errorResponse("Invalid permission update.");
  const input = body as Record<string, unknown>;
  if ((input.role !== "teacher" && input.role !== "student") || typeof input.canSubmitNotes !== "boolean") {
    return errorResponse("Role and note-submission permission are required.");
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("owner_update_member", {
    p_user_id: id,
    p_role: input.role as AppRole,
    p_can_submit_notes: input.canSubmitNotes,
    p_actor_id: caller.profile.id,
  });
  if (error) {
    console.error("Could not update member permissions.", error);
    return errorResponse("Supabase could not update this member.", 502);
  }
  return NextResponse.json({ ok: true });
}
