import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, getActiveProfile, isSameOriginRequest } from "@/lib/http";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ratings = ["again", "good", "easy"] as const;

export async function GET() {
  if (!isSupabaseConfigured()) return errorResponse("Supabase is not configured.", 503);
  const session = await getActiveProfile();
  if (!session) return errorResponse("Authentication required.", 401);

  const [cards, reviews] = await Promise.all([
    session.client.from("flashcards").select("id,subject_id,chapter,prompt,answer,is_sample").eq("is_published", true),
    session.client.from("user_flashcard_reviews").select("flashcard_id,due_at,interval_seconds,repetitions,last_rating").eq("user_id", session.profile.id),
  ]);
  const error = cards.error ?? reviews.error;
  if (error) {
    console.error("Could not load flashcards and review schedule.", error);
    return errorResponse("Flashcards are temporarily unavailable.", 502);
  }
  const subjectIds = [...new Set((cards.data ?? []).map((card) => card.subject_id))];
  const { data: subjects, error: subjectError } = subjectIds.length
    ? await session.client.from("subjects").select("id,name").in("id", subjectIds)
    : { data: [], error: null };
  if (subjectError) {
    console.error("Could not load flashcard subjects.", subjectError);
    return errorResponse("Flashcard subjects are temporarily unavailable.", 502);
  }

  const subjectNames = new Map((subjects ?? []).map((subject) => [subject.id, subject.name]));
  const scheduleById = new Map((reviews.data ?? []).map((review) => [review.flashcard_id, review]));
  const flashcards = (cards.data ?? []).map((card) => ({
    id: card.id,
    subject: subjectNames.get(card.subject_id) ?? "Unassigned subject",
    chapter: card.chapter,
    prompt: card.prompt,
    answer: card.answer,
    sample: card.is_sample,
    dueAt: scheduleById.get(card.id)?.due_at ?? null,
    intervalSeconds: scheduleById.get(card.id)?.interval_seconds ?? 0,
    repetitions: scheduleById.get(card.id)?.repetitions ?? 0,
    lastRating: scheduleById.get(card.id)?.last_rating ?? null,
  })).sort((left, right) => {
    const leftDue = left.dueAt ? Date.parse(left.dueAt) : 0;
    const rightDue = right.dueAt ? Date.parse(right.dueAt) : 0;
    return leftDue - rightDue;
  });

  return NextResponse.json({ flashcards });
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return errorResponse("Invalid request origin.", 403);
  if (!isSupabaseConfigured()) return errorResponse("Supabase is not configured.", 503);
  const session = await getActiveProfile();
  if (!session) return errorResponse("Authentication required.", 401);

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("flashcardId" in body) || !("rating" in body)
    || typeof body.flashcardId !== "string" || !uuidPattern.test(body.flashcardId)
    || typeof body.rating !== "string" || !ratings.includes(body.rating as (typeof ratings)[number])) {
    return errorResponse("Choose a valid flashcard and rating.");
  }
  const { data, error } = await session.client.rpc("review_flashcard", {
    p_flashcard_id: body.flashcardId,
    p_rating: body.rating,
  });
  if (error) {
    console.error("Could not schedule flashcard review.", error);
    return errorResponse("The flashcard rating could not be saved.", 502);
  }
  const schedule = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ schedule });
}
