import { NextResponse, type NextRequest } from "next/server";
import type { AppRole } from "@/lib/supabase/types";
import { errorResponse, getActiveProfile, isSameOriginRequest } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return errorResponse("Invalid request origin.", 403);
  if (!isSupabaseConfigured()) return errorResponse("Supabase is not configured.", 503);
  const caller = await getActiveProfile();
  if (!caller) return errorResponse("Authentication required.", 401);
  if (caller.profile.role !== "developer") return errorResponse("Developer permission required.", 403);

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return errorResponse("Invalid invitation details.");
  const input = body as Record<string, unknown>;
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const role = input.role;
  const canSubmitNotes = input.canSubmitNotes === true;
  if (!validEmail.test(email) || email.length > 254 || name.length < 1 || name.length > 100) {
    return errorResponse("Enter a valid email address and a name up to 100 characters.");
  }
  if (role !== "teacher" && role !== "student") {
    return errorResponse("Invitations can be assigned teacher or student roles only.");
  }
  if (email === caller.profile.email.toLowerCase()) return errorResponse("The developer account cannot be invited as a member.");

  const admin = createSupabaseAdminClient();
  const redirectTo = new URL("/auth/callback?next=%2Fapp", process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin).toString();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { full_name: name },
  });
  if (error || !data.user) {
    console.error("Could not invite user through Supabase Auth.", error);
    return errorResponse("Supabase could not create the invitation.", 502);
  }

  const { error: profileError } = await admin.rpc("owner_apply_invited_profile", {
    p_user_id: data.user.id,
    p_email: email,
    p_full_name: name,
    p_role: role as AppRole,
    p_can_submit_notes: canSubmitNotes,
    p_actor_id: caller.profile.id,
  });
  if (profileError) {
    const { error: cleanupError } = await admin.auth.admin.deleteUser(data.user.id);
    console.error("Invitation profile provisioning failed; compensation attempted.", {
      profileError,
      cleanupError,
      invitedUserId: data.user.id,
    });
    return errorResponse(
      cleanupError
        ? "Invitation was sent, but its role setup and cleanup failed. Reconcile the account in Supabase Auth."
        : "Invitation setup failed and the incomplete Supabase Auth account was removed. Please try again.",
      502,
    );
  }

  return NextResponse.json({ ok: true, userId: data.user.id, status: "invited" }, { status: 201 });
}
