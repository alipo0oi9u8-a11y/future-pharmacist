import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/http";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Sign-in is not configured yet." }, { status: 503 });

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("email" in body) || !("password" in body)) {
    return NextResponse.json({ error: "Enter your invited email and password." }, { status: 400 });
  }
  const { email, password } = body as { email: unknown; password: unknown };
  if (typeof email !== "string" || typeof password !== "string" || email.length > 254 || password.length > 1024) {
    return NextResponse.json({ error: "The sign-in details are invalid." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error || !data.user) return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError || !profile || profile.status !== "active") {
    await supabase.auth.signOut();
    return NextResponse.json({ error: "This account is not active. Ask the developer to send a valid invitation." }, { status: 403 });
  }

  return NextResponse.json({ ok: true, next: "/app" });
}
