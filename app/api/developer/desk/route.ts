import { NextResponse } from "next/server";
import { errorResponse, getActiveProfile } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function GET() {
  if (!isSupabaseConfigured()) return errorResponse("Supabase is not configured.", 503);
  const caller = await getActiveProfile();
  if (!caller) return errorResponse("Authentication required.", 401);
  if (caller.profile.role !== "developer") return errorResponse("Developer permission required.", 403);

  const admin = createSupabaseAdminClient();
  const [notesResult, membersResult, auditResult, reportsResult, analyticsResult] = await Promise.all([
    admin.from("notes")
      .select("id,subject_id,book_id,chapter,topic,docs_url,submitted_by,created_at,subjects(name),books(title),profiles!notes_submitted_by_fkey(full_name,email)")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    admin.from("profiles")
      .select("id,email,full_name,role,status,contribution_permissions(content_type)")
      .neq("role", "developer")
      .order("created_at", { ascending: false }),
    admin.from("audit_events")
      .select("id,action,entity_type,entity_id,metadata,created_at")
      .order("created_at", { ascending: false })
      .limit(30),
    admin.from("note_reports")
      .select("id,note_id,user_id,reason,status,created_at")
      .eq("status", "open")
      .order("created_at", { ascending: true }),
    caller.client.rpc("developer_analytics"),
  ]);
  const error = notesResult.error ?? membersResult.error ?? auditResult.error ?? reportsResult.error ?? analyticsResult.error;
  if (error) {
    console.error("Could not load developer desk data.", error);
    return errorResponse("Developer desk data is temporarily unavailable.", 502);
  }

  return NextResponse.json({
    pendingNotes: notesResult.data,
    members: membersResult.data,
    audit: auditResult.data,
    reports: reportsResult.data,
    analytics: analyticsResult.data,
  });
}
