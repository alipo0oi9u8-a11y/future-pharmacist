import { NextResponse } from "next/server";
import { errorResponse, getActiveProfile } from "@/lib/http";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const modes = ["standard", "timed", "daily-challenge", "review-mistakes"] as const;
type QuizMode = (typeof modes)[number];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) return errorResponse("Supabase is not configured.", 503);
  const session = await getActiveProfile();
  if (!session) return errorResponse("Authentication required.", 401);
  const url = new URL(request.url);
  const requestedMode = url.searchParams.get("mode") ?? "standard";
  if (!modes.includes(requestedMode as QuizMode)) return errorResponse("Choose a supported quiz mode.");
  const quizId = url.searchParams.get("quizId");
  if (quizId && !uuidPattern.test(quizId)) return errorResponse("Invalid quiz identifier.");
  const { data, error } = await session.client
    .from("quiz_questions_public")
    .select("id,quiz_id,subject,quiz_title,chapter,prompt,options,is_sample")
    .order("quiz_id")
    .order("subject")
    .order("chapter");
  if (error) {
    console.error("Could not load published quiz questions.", error);
    return errorResponse("Quiz content is temporarily unavailable.", 502);
  }
  let questions = data ?? [];
  if (quizId) questions = questions.filter((question) => question.quiz_id === quizId);
  if (requestedMode === "review-mistakes") {
    const { data: mistakes, error: mistakesError } = await session.client
      .from("quiz_attempt_answers")
      .select("question_id")
      .eq("user_id", session.profile.id)
      .eq("is_correct", false);
    if (mistakesError) {
      console.error("Could not load missed quiz questions.", mistakesError);
      return errorResponse("Review questions are temporarily unavailable.", 502);
    }
    const missedIds = new Set((mistakes ?? []).map((answer) => answer.question_id));
    questions = questions.filter((question) => missedIds.has(question.id));
  } else if (requestedMode === "daily-challenge" && questions.length > 5) {
    const utcDay = Math.floor(Date.now() / 86_400_000);
    const start = utcDay % questions.length;
    questions = Array.from({ length: 5 }, (_, index) => questions[(start + index) % questions.length]);
  }
  return NextResponse.json({
    questions: questions.map((question) => ({ ...question, sample: question.is_sample })),
  });
}
