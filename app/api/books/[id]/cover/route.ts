import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, getActiveProfile, isSameOriginRequest } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const acceptedTypes = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);
const maxBytes = 5 * 1024 * 1024;

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return errorResponse("Invalid request origin.", 403);
  if (!isSupabaseConfigured()) return errorResponse("Supabase is not configured.", 503);
  const session = await getActiveProfile();
  if (!session) return errorResponse("Authentication required.", 401);
  if (session.profile.role !== "developer") return errorResponse("Developer permission required.", 403);
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return errorResponse("Invalid book identifier.");

  const form = await request.formData().catch(() => null);
  const file = form?.get("cover");
  if (!(file instanceof File) || file.size < 1 || file.size > maxBytes) return errorResponse("Choose an image smaller than 5 MB.");
  const extension = acceptedTypes.get(file.type);
  if (!extension) return errorResponse("Cover images must be JPEG, PNG, or WebP.");

  const objectPath = `books/${id}/${crypto.randomUUID()}.${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage.from("book-covers").upload(objectPath, bytes, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });
  if (error) {
    console.error("Could not upload book cover.", error);
    return errorResponse("The book cover could not be uploaded.", 502);
  }
  return NextResponse.json({ path: objectPath }, { status: 201 });
}
