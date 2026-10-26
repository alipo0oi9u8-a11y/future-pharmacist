import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, getActiveProfile, isSameOriginRequest } from "@/lib/http";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const defaultPreferences = {
  theme: "dark" as const,
  reduceAnimations: false,
  soundEnabled: false,
  leaderboardOptIn: false,
};

function toClientPreferences(row: {
  theme: "dark" | "light";
  reduce_animations: boolean;
  sound_enabled: boolean;
  leaderboard_opt_in: boolean;
}) {
  return {
    theme: row.theme,
    reduceAnimations: row.reduce_animations,
    soundEnabled: row.sound_enabled,
    leaderboardOptIn: row.leaderboard_opt_in,
  };
}

export async function GET() {
  if (!isSupabaseConfigured()) return errorResponse("Supabase is not configured.", 503);
  const session = await getActiveProfile();
  if (!session) return errorResponse("Authentication required.", 401);

  const { data, error } = await session.client.from("user_preferences")
    .select("theme,reduce_animations,sound_enabled,leaderboard_opt_in")
    .eq("user_id", session.profile.id)
    .maybeSingle();
  if (error) {
    console.error("Could not load account preferences.", error);
    return errorResponse("Account preferences are temporarily unavailable.", 502);
  }
  return NextResponse.json({ preferences: data ? toClientPreferences(data) : defaultPreferences });
}

export async function PATCH(request: NextRequest) {
  if (!isSameOriginRequest(request)) return errorResponse("Invalid request origin.", 403);
  if (!isSupabaseConfigured()) return errorResponse("Supabase is not configured.", 503);
  const session = await getActiveProfile();
  if (!session) return errorResponse("Authentication required.", 401);

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return errorResponse("Provide valid preference changes.");
  const input = body as Record<string, unknown>;
  const allowedKeys = ["theme", "reduceAnimations", "soundEnabled", "leaderboardOptIn"];
  if (!Object.keys(input).length || Object.keys(input).some((key) => !allowedKeys.includes(key))) {
    return errorResponse("Provide at least one supported preference.");
  }
  if (Object.hasOwn(input, "theme") && input.theme !== "dark" && input.theme !== "light") {
    return errorResponse("Theme must be dark or light.");
  }
  for (const key of ["reduceAnimations", "soundEnabled", "leaderboardOptIn"]) {
    if (Object.hasOwn(input, key) && typeof input[key] !== "boolean") {
      return errorResponse(`${key} must be true or false.`);
    }
  }

  const { data, error } = await session.client.rpc("save_user_preferences", {
    p_theme: typeof input.theme === "string" ? input.theme : null,
    p_reduce_animations: typeof input.reduceAnimations === "boolean" ? input.reduceAnimations : null,
    p_sound_enabled: typeof input.soundEnabled === "boolean" ? input.soundEnabled : null,
    p_leaderboard_opt_in: typeof input.leaderboardOptIn === "boolean" ? input.leaderboardOptIn : null,
  });
  if (error) {
    console.error("Could not save account preferences.", error);
    return errorResponse("Account preferences could not be saved.", 502);
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return errorResponse("The saved preferences could not be confirmed.", 502);
  return NextResponse.json({ preferences: toClientPreferences(row) });
}
