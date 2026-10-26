import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, getActiveProfile, isSameOriginRequest } from "@/lib/http";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  if (!isSupabaseConfigured()) return errorResponse("Supabase is not configured.", 503);
  const session = await getActiveProfile();
  if (!session) return errorResponse("Authentication required.", 401);
  const [announcements, exams] = await Promise.all([
    session.client.from("announcements").select("id,title,body,published_at").not("published_at", "is", null).order("published_at", { ascending: false }),
    session.client.from("exam_dates").select("id,title,details,starts_at,subjects(name)").gte("starts_at", new Date().toISOString()).order("starts_at"),
  ]);
  const error = announcements.error ?? exams.error;
  if (error) {
    console.error("Could not load course updates.", error);
    return errorResponse("Course updates are temporarily unavailable.", 502);
  }
  return NextResponse.json({ announcements: announcements.data, exams: exams.data });
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return errorResponse("Invalid request origin.", 403);
  if (!isSupabaseConfigured()) return errorResponse("Supabase is not configured.", 503);
  const session = await getActiveProfile();
  if (!session) return errorResponse("Authentication required.", 401);
  if (session.profile.role !== "developer") return errorResponse("Developer permission required.", 403);
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return errorResponse("Invalid course update.");
  const input = body as Record<string, unknown>;
  const kind = input.kind;
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title || title.length > 160) return errorResponse("Title must be between 1 and 160 characters.");

  if (kind === "announcement") {
    const text = typeof input.body === "string" ? input.body.trim() : "";
    if (!text || text.length > 4000) return errorResponse("Announcement text must be between 1 and 4,000 characters.");
    const { data, error } = await session.client.from("announcements").insert({
      title,
      body: text,
      published_at: new Date().toISOString(),
      created_by: session.profile.id,
    }).select("id").single();
    if (error) {
      console.error("Could not publish announcement.", error);
      return errorResponse("The announcement could not be saved.", 502);
    }
    return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
  }

  if (kind === "exam") {
    const details = typeof input.details === "string" ? input.details.trim() : "";
    const subjectId = typeof input.subjectId === "string" ? input.subjectId : null;
    const startsAt = typeof input.startsAt === "string" ? input.startsAt : "";
    if (details.length > 1000 || !startsAt || Number.isNaN(Date.parse(startsAt))) {
      return errorResponse("Provide a valid date and details up to 1,000 characters.");
    }
    if (subjectId && !uuidPattern.test(subjectId)) return errorResponse("Choose a valid subject.");
    const { data, error } = await session.client.from("exam_dates").insert({
      title,
      details,
      subject_id: subjectId,
      starts_at: new Date(startsAt).toISOString(),
      created_by: session.profile.id,
    }).select("id").single();
    if (error) {
      console.error("Could not save exam date.", error);
      return errorResponse("The exam date could not be saved.", 502);
    }
    return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
  }
  return errorResponse("Choose an announcement or exam update.");
}
