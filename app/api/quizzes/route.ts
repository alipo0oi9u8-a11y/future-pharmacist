import { NextResponse } from "next/server";
import { errorResponse, getActiveProfile } from "@/lib/http";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function GET() {
  if (!isSupabaseConfigured()) return errorResponse("Supabase is not configured.", 503);
  const session = await getActiveProfile();
  if (!session) return errorResponse("Authentication required.", 401);
  const { data, error } = await session.client
    .from("quiz_questions_public")
    .select("id,quiz_id,subject,quiz_title,chapter,prompt,options")
    .order("subject")
    .order("chapter");
  if (error) {
    console.error("Could not load published quiz questions.", error);
    return errorResponse("Quiz content is temporarily unavailable.", 502);
  }
  return NextResponse.json({ questions: data });
}
