import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, getActiveProfile, isSameOriginRequest } from "@/lib/http";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const modes = ["standard", "timed", "daily-challenge", "review-mistakes"] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return errorResponse("Invalid request origin.", 403);
  if (!isSupabaseConfigured()) return errorResponse("Supabase is not configured.", 503);
  const session = await getActiveProfile();
  if (!session) return errorResponse("Authentication required.", 401);

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return errorResponse("Choose a quiz mode.");
  const input = body as Record<string, unknown>;
  if (typeof input.mode !== "string" || !modes.includes(input.mode as (typeof modes)[number])) {
    return errorResponse("Choose a supported quiz mode.");
  }
  if (input.quizId !== undefined && (typeof input.quizId !== "string" || !uuidPattern.test(input.quizId))) {
    return errorResponse("Invalid quiz identifier.");
  }

  const mode = input.mode;
  const { data, error } = await session.client.rpc("start_quiz_attempt", {
    p_mode: mode,
    p_quiz_id: typeof input.quizId === "string" ? input.quizId : null,
    p_time_limit_seconds: mode === "timed" ? 300 : null,
  });
  if (error) {
    console.error("Could not start quiz attempt.", error);
    return errorResponse("The quiz attempt could not be started.", 502);
  }
  return NextResponse.json({ attemptId: data, timeLimitSeconds: mode === "timed" ? 300 : null });
}

export async function PATCH(request: NextRequest) {
  if (!isSameOriginRequest(request)) return errorResponse("Invalid request origin.", 403);
  if (!isSupabaseConfigured()) return errorResponse("Supabase is not configured.", 503);
  const session = await getActiveProfile();
  if (!session) return errorResponse("Authentication required.", 401);
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("attemptId" in body)
    || typeof body.attemptId !== "string" || !uuidPattern.test(body.attemptId)) {
    return errorResponse("Invalid quiz attempt identifier.");
  }
  const { error } = await session.client.rpc("finish_quiz_attempt", { p_attempt_id: body.attemptId });
  if (error) {
    console.error("Could not finish quiz attempt.", error);
    return errorResponse("The quiz attempt could not be completed.", 502);
  }
  return NextResponse.json({ ok: true });
}
