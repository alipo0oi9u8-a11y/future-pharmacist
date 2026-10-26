import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActiveProfile = {
  id: string;
  email: string;
  full_name: string;
  role: "developer" | "teacher" | "student";
  status: "invited" | "active" | "disabled";
};

export async function getActiveProfile(): Promise<{ client: Awaited<ReturnType<typeof createSupabaseServerClient>>; profile: ActiveProfile } | null> {
  const client = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return null;

  const { data, error } = await client
    .from("profiles")
    .select("id,email,full_name,role,status")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !data || data.status !== "active") return null;
  if (data.role !== "developer" && data.role !== "teacher" && data.role !== "student") return null;

  return { client, profile: data as ActiveProfile };
}

export function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function invalidOriginResponse() {
  return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
