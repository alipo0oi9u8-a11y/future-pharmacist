import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, getActiveProfile, isSameOriginRequest } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function GET() {
  if (!isSupabaseConfigured()) return errorResponse("Supabase is not configured.", 503);
  const session = await getActiveProfile();
  if (!session) return errorResponse("Authentication required.", 401);
  const { data, error } = await session.client
    .from("books")
    .select("id,subject_id,title,author,edition,description,image_path,price_amount,price_currency,buy_url,price_verified_at,course_confirmed")
    .eq("is_active", true)
    .order("title");
  if (error) {
    console.error("Could not load book catalog.", error);
    return errorResponse("The book catalog is temporarily unavailable.", 502);
  }
  return NextResponse.json({ books: data });
}

export async function PUT(request: NextRequest) {
  if (!isSameOriginRequest(request)) return errorResponse("Invalid request origin.", 403);
  if (!isSupabaseConfigured()) return errorResponse("Supabase is not configured.", 503);
  const session = await getActiveProfile();
  if (!session) return errorResponse("Authentication required.", 401);
  if (session.profile.role !== "developer") return errorResponse("Developer permission required.", 403);

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return errorResponse("Invalid book listing.");
  const input = body as Record<string, unknown>;
  const id = typeof input.id === "string" ? input.id : "";
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const author = typeof input.author === "string" ? input.author.trim() : "";
  const edition = typeof input.edition === "string" ? input.edition.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const buyUrl = typeof input.buyUrl === "string" ? input.buyUrl.trim() : "";
  const imagePath = typeof input.imagePath === "string" ? input.imagePath : "";
  const amount = input.priceAmount === null || input.priceAmount === "" ? null : Number(input.priceAmount);
  const currency = input.priceCurrency === null || input.priceCurrency === "" ? null : String(input.priceCurrency).toUpperCase();
  const verifiedAt = typeof input.priceVerifiedAt === "string" ? input.priceVerifiedAt : null;
  const courseConfirmed = input.courseConfirmed === true;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(id) || title.length < 1 || title.length > 200 || author.length > 200 || edition.length > 80 || description.length > 1200) {
    return errorResponse("Book fields are invalid or exceed their length limits.");
  }
  if (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 9999999999.99)) return errorResponse("Enter a valid non-negative book price.");
  if ((amount === null) !== (currency === null) || (currency !== null && !/^[A-Z]{3}$/.test(currency))) return errorResponse("Price and three-letter currency must be provided together.");
  if (buyUrl && !isHttpsUrl(buyUrl)) return errorResponse("Buying links must use HTTPS.");
  if (verifiedAt && !/^\d{4}-\d{2}-\d{2}$/.test(verifiedAt)) return errorResponse("Price verification date is invalid.");
  if (imagePath && !/^books\/[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,160}$/.test(imagePath)) return errorResponse("Cover image path is invalid.");

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("books").update({
    title, author, edition, description, buy_url: buyUrl || null,
    price_amount: amount, price_currency: currency, price_verified_at: verifiedAt,
    course_confirmed: courseConfirmed, image_path: imagePath || null, updated_at: new Date().toISOString(),
  }).eq("id", id).select("id").maybeSingle();
  if (error || !data) {
    console.error("Could not update book catalog entry.", error);
    return errorResponse("The book listing could not be updated.", 502);
  }
  return NextResponse.json({ ok: true, id: data.id });
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
