import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, getActiveProfile, isSameOriginRequest } from "@/lib/http";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return errorResponse("Invalid request origin.", 403);
  if (!isSupabaseConfigured()) return errorResponse("Supabase is not configured.", 503);
  const session = await getActiveProfile();
  if (!session) return errorResponse("Authentication required.", 401);
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return errorResponse("Invalid question identifier.");

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("selectedIndex" in body) || !Number.isInteger(body.selectedIndex)
    || !("attemptId" in body) || typeof body.attemptId !== "string" || !uuidPattern.test(body.attemptId)) {
    return errorResponse("Choose one of the available answers.");
  }
  const selectedIndex = body.selectedIndex;
  if (typeof selectedIndex !== "number" || selectedIndex < 0 || selectedIndex > 7) return errorResponse("The selected answer is invalid.");

  const { data, error } = await session.client.rpc("submit_quiz_attempt_answer", {
    p_attempt_id: body.attemptId,
    p_question_id: id,
    p_selected_index: selectedIndex,
  });
  if (error) {
    console.error("Could not record quiz answer.", error);
    return errorResponse("The answer could not be submitted.", 502);
  }
  const result = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ correct: result?.correct === true, explanation: result?.explanation ?? "" });
}
