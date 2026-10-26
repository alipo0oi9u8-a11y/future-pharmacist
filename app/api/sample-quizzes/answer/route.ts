import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, isSameOriginRequest } from "@/lib/http";

const sampleAnswers = [0, 2, 0, 0, 0];

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return errorResponse("Invalid request origin.", 403);
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return errorResponse("Choose an answer.");
  const input = body as Record<string, unknown>;
  const questionIndex = input.questionIndex;
  const selectedIndex = input.selectedIndex;
  if (!Number.isInteger(questionIndex) || !Number.isInteger(selectedIndex)
    || typeof questionIndex !== "number" || typeof selectedIndex !== "number"
    || questionIndex < 0 || questionIndex >= sampleAnswers.length
    || selectedIndex < 0 || selectedIndex > 7) {
    return errorResponse("The sample answer is invalid.");
  }
  return NextResponse.json({ correct: sampleAnswers[questionIndex] === selectedIndex });
}
