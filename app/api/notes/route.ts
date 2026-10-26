import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, getActiveProfile, isSameOriginRequest } from "@/lib/http";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const notePath = /^\/document\/d\/[^/?#]+(?:[/?#].*)?$/;

function validDocsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "docs.google.com" && notePath.test(url.pathname);
  } catch {
    return false;
  }
}

export async function GET() {
  if (!isSupabaseConfigured()) return errorResponse("Supabase is not configured.", 503);
  const session = await getActiveProfile();
  if (!session) return errorResponse("Authentication required.", 401);

  const [notesResult, subjectsResult, booksResult] = await Promise.all([
    session.client.from("notes_public").select("*").order("created_at", { ascending: false }),
    session.client.from("subjects").select("id,slug,name,accent_color,display_order").eq("is_active", true).order("display_order"),
    session.client.from("books").select("id,subject_id,title,author,edition,description,image_path,price_amount,price_currency,buy_url,price_verified_at,course_confirmed").eq("is_active", true),
  ]);
  if (notesResult.error || subjectsResult.error || booksResult.error) {
    console.error("Could not load study data.", notesResult.error ?? subjectsResult.error ?? booksResult.error);
    return errorResponse("Study data is temporarily unavailable.", 502);
  }
  return NextResponse.json({ notes: notesResult.data, subjects: subjectsResult.data, books: booksResult.data });
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return errorResponse("Invalid request origin.", 403);
  if (!isSupabaseConfigured()) return errorResponse("Supabase is not configured.", 503);
  const session = await getActiveProfile();
  if (!session) return errorResponse("Authentication required.", 401);

  const { data: permission, error: permissionError } = await session.client
    .from("contribution_permissions")
    .select("content_type")
    .eq("user_id", session.profile.id)
    .eq("content_type", "note")
    .maybeSingle();
  if (session.profile.role !== "developer" && (permissionError || !permission)) {
    return errorResponse("The developer has not enabled note submissions for your account.", 403);
  }

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return errorResponse("Invalid note submission.");
  const input = body as Record<string, unknown>;
  const subjectId = typeof input.subjectId === "string" ? input.subjectId : "";
  const bookId = typeof input.bookId === "string" ? input.bookId : "";
  const chapter = typeof input.chapter === "string" ? input.chapter.trim() : "";
  const topic = typeof input.topic === "string" ? input.topic.trim() : "";
  const docsUrl = typeof input.docsUrl === "string" ? input.docsUrl.trim() : "";
  if (!subjectId || !bookId || chapter.length < 1 || chapter.length > 160 || topic.length < 1 || topic.length > 160) {
    return errorResponse("Choose a subject and book, then enter a chapter and topic within the length limits.");
  }
  if (docsUrl && (docsUrl.length > 2048 || !validDocsUrl(docsUrl))) {
    return errorResponse("Google Docs links must be valid HTTPS document URLs.");
  }

  const { data: book, error: bookError } = await session.client
    .from("books")
    .select("id,subject_id")
    .eq("id", bookId)
    .eq("subject_id", subjectId)
    .eq("is_active", true)
    .maybeSingle();
  if (bookError || !book) return errorResponse("Choose a valid book for the selected subject.");

  const { data, error } = await session.client.from("notes").insert({
    subject_id: subjectId,
    book_id: bookId,
    chapter,
    topic,
    docs_url: docsUrl || null,
    submitted_by: session.profile.id,
    status: "pending",
  }).select("id,status").single();
  if (error) {
    console.error("Could not save note submission.", error);
    return errorResponse("The note could not be submitted.", 502);
  }
  return NextResponse.json(data, { status: 201 });
}
